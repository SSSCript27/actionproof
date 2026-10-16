import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { digest } from "./engine.mjs";
import { fail } from "../shared/domain.js";
export const token = () => randomBytes(32).toString("base64url");
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function passwordMatches(password, stored) {
  try {
    const [salt, hash] = stored.split(":"),
      actual = scryptSync(password, salt, 64);
    return timingSafeEqual(actual, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
export function auth(db, { bootstrapToken, secure = false } = {}) {
  const cleanUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  });
  function credentials(input) {
    const email = String(input.email || "")
        .trim()
        .toLowerCase(),
      name = String(input.name || "").trim(),
      password = String(input.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
      fail(400, "Enter a valid email address.");
    if (password.length < 12 || password.length > 200)
      fail(400, "Use a password of 12–200 characters.");
    if (!name || name.length > 80)
      fail(400, "A name of 1–80 characters is required.");
    return { email, name, password };
  }
  function issueSession(user) {
    const value = token();
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(value),
      user.id,
      Date.now() + 12 * 3600000,
    );
    return {
      user: cleanUser(user),
      cookie: `ap_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure ? "; Secure" : ""}`,
    };
  }
  function setup(input) {
    const c = credentials(input);
    if (
      !bootstrapToken ||
      !input.bootstrapToken ||
      !timingSafeEqual(
        Buffer.from(digest(input.bootstrapToken)),
        Buffer.from(digest(bootstrapToken)),
      )
    )
      fail(
        403,
        "The bootstrap token is incorrect. Use the setup link generated on the server.",
      );
    db.exec("BEGIN IMMEDIATE");
    try {
      if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n)
        fail(409, "Setup is already complete. Sign in or use an invitation.");
      const u = { id: randomUUID(), ...c, role: "admin" };
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
        u.id,
        u.name,
        u.email,
        passwordHash(c.password),
        u.role,
        new Date().toISOString(),
      );
      db.prepare("INSERT INTO settings VALUES('workspace',?)").run(
        JSON.stringify({
          name: String(input.workspace || "My workspace").slice(0, 80),
        }),
      );
      db.exec("COMMIT");
      return issueSession(u);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function login(input) {
    const email = String(input.email || "")
        .trim()
        .toLowerCase(),
      password = String(input.password || "");
    if (password.length > 200) fail(401, "Email or password is incorrect.");
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    const hash =
      u?.password ||
      "00000000000000000000000000000000:" + Buffer.alloc(64).toString("hex");
    const matches = passwordMatches(password, hash);
    if (!u || !matches) fail(401, "Email or password is incorrect.");
    return issueSession(u);
  }
  function identify(req) {
    const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (bearer) {
      const k = db
        .prepare("SELECT * FROM api_keys WHERE hash=? AND expires>?")
        .get(digest(bearer), Date.now());
      if (!k) fail(401, "API key is invalid, revoked, or expired.");
      return {
        id: k.id,
        name: k.name,
        role: "operator",
        machine: true,
        scopes: JSON.parse(k.scopes),
      };
    }
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("ap_session="))
      ?.slice(11);
    if (!raw) fail(401, "Sign in to continue.");
    const u = db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>?",
      )
      .get(digest(raw), Date.now());
    if (!u) fail(401, "Session expired. Sign in again.");
    return { ...cleanUser(u), machine: false };
  }
  function requireRole(user, roles) {
    if (user.machine || !roles.includes(user.role))
      fail(
        403,
        "This action requires a signed-in team member with the appropriate role.",
      );
  }
  function scope(user, required) {
    if (user.machine && !user.scopes.includes(required))
      fail(403, "The API key does not have the required scope.");
    if (
      !user.machine &&
      required !== "operations:read" &&
      user.role === "viewer"
    )
      fail(403, "Viewers cannot change operations.");
  }
  function createKey(input, actor) {
    const scopes = input.scopes;
    if (
      !Array.isArray(scopes) ||
      !scopes.length ||
      scopes.some(
        (x) =>
          ![
            "operations:read",
            "operations:write",
            "operations:execute",
          ].includes(x),
      )
    )
      fail(400, "Select valid key scopes.");
    const name = String(input.name || "").trim();
    if (!name || name.length > 80) fail(400, "Provide a key name.");
    const value = "ap_" + token(),
      id = randomUUID();
    db.prepare("INSERT INTO api_keys VALUES(?,?,?,?,?,?)").run(
      id,
      name,
      digest(value),
      JSON.stringify([...new Set(scopes)]),
      Date.now() + 30 * 86400000,
      new Date().toISOString(),
    );
    return {
      id,
      name,
      token: value,
      scopes,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
  }
  function invite(input, origin) {
    const email = String(input.email || "")
        .trim()
        .toLowerCase(),
      role = input.role;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["operator", "viewer"].includes(role)
    )
      fail(400, "Provide a valid email and operator or viewer role.");
    const value = token();
    db.prepare("INSERT INTO invites VALUES(?,?,?,?,0)").run(
      digest(value),
      email,
      role,
      Date.now() + 86400000,
    );
    return {
      url: origin + "/#/join?token=" + value,
      email,
      role,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
  }
  function join(input) {
    const c = credentials(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      const i = db
        .prepare("SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?")
        .get(digest(String(input.inviteToken || "")), Date.now());
      if (!i || i.email !== c.email)
        fail(
          403,
          "Invitation is invalid, expired, or belongs to another email address.",
        );
      if (db.prepare("SELECT id FROM users WHERE email=?").get(c.email))
        fail(409, "This email already has an account. Sign in instead.");
      const u = { id: randomUUID(), ...c, role: i.role };
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
        u.id,
        u.name,
        u.email,
        passwordHash(c.password),
        u.role,
        new Date().toISOString(),
      );
      db.prepare("UPDATE invites SET used=1 WHERE hash=?").run(i.hash);
      db.exec("COMMIT");
      return issueSession(u);
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function logout(req) {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("ap_session="))
      ?.slice(11);
    if (raw) db.prepare("DELETE FROM sessions WHERE hash=?").run(digest(raw));
    return `ap_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
  }
  return {
    setup,
    login,
    identify,
    requireRole,
    scope,
    createKey,
    invite,
    join,
    logout,
  };
}
