import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { openStore } from "./store.mjs";
import { engine } from "./engine.mjs";
import { auth } from "./auth.mjs";
import { fail, receiptText } from "../shared/domain.js";
try {
  process.loadEnvFile();
} catch {}
export function createApp(config = {}) {
  const port = config.port || Number(process.env.PORT || 4310),
    origin =
      config.origin || process.env.PUBLIC_ORIGIN || `http://localhost:${port}`;
  const secret = config.secret || process.env.APP_SECRET,
    bootstrapToken = config.bootstrapToken || process.env.BOOTSTRAP_TOKEN;
  if (!secret || secret.length < 32 || !bootstrapToken)
    throw new Error(
      "Run npm run setup first, or configure APP_SECRET and BOOTSTRAP_TOKEN.",
    );
  if (
    process.env.NODE_ENV === "production" &&
    !origin.startsWith("https://") &&
    !/http:\/\/localhost(?::|\/|$)/.test(origin)
  )
    throw new Error(
      "A public production deployment requires an HTTPS PUBLIC_ORIGIN.",
    );
  const db =
      config.db ||
      openStore(
        process.env.DATABASE_PATH || resolve("data/actionproof.sqlite"),
      ),
    ops = engine(db, { secret, providerFactory: config.providerFactory }),
    identity = auth(db, {
      bootstrapToken,
      secure: origin.startsWith("https:"),
    });
  ops.recover();
  const limits = new Map();
  function rate(req, kind, max = 30) {
    const key = kind + ":" + req.socket.remoteAddress,
      now = Date.now();
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    let r = limits.get(key);
    if (!r || r.until < now) {
      r = { n: 0, until: now + 60000 };
      limits.set(key, r);
    }
    if (++r.n > max)
      fail(429, "Too many attempts. Wait a minute and try again.");
  }
  const json = (res, code, value, headers = {}) => {
    res.writeHead(code, {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    });
    res.end(JSON.stringify(value));
  };
  async function body(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 100000) fail(413, "Request body is too large.");
      chunks.push(chunk);
    }
    try {
      const text = Buffer.concat(chunks).toString("utf8");
      return text ? JSON.parse(text) : {};
    } catch {
      fail(400, "Request body must be JSON.");
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (origin.startsWith("https:"))
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const url = new URL(req.url, "http://localhost"),
        p = url.pathname,
        method = req.method;
      if (p === "/healthz")
        return json(res, 200, { ok: true, version: "0.1.0" });
      if (p.startsWith("/api/")) {
        res.setHeader("Cache-Control", "no-store");
        if (!["GET", "POST", "DELETE"].includes(method))
          fail(405, "Method not allowed.");
        if (method !== "GET") {
          if (req.headers.origin && req.headers.origin !== origin)
            fail(403, "Origin not allowed.");
          if (
            req.headers.cookie &&
            !req.headers.authorization &&
            req.headers.origin !== origin
          )
            fail(
              403,
              "A matching Origin header is required for session writes.",
            );
          if (
            method === "POST" &&
            !String(req.headers["content-type"]).startsWith("application/json")
          )
            fail(415, "Use application/json.");
          rate(req, "write", 150);
        }
        if (p === "/api/bootstrap" && method === "GET")
          return json(res, 200, {
            needsSetup: !db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
          });
        if (
          ["/api/setup", "/api/login", "/api/join"].includes(p) &&
          method === "POST"
        ) {
          rate(req, "auth", 10);
          const input = await body(req),
            r = p.endsWith("setup")
              ? identity.setup(input)
              : p.endsWith("join")
                ? identity.join(input)
                : identity.login(input);
          ops.event(
            null,
            "session_started",
            r.user.email,
            "Interactive session started.",
          );
          return json(res, 200, { user: r.user }, { "Set-Cookie": r.cookie });
        }
        const user = identity.identify(req),
          actor = user.machine ? "key:" + user.name : user.email;
        if (p === "/api/logout" && method === "POST")
          return json(
            res,
            200,
            { ok: true },
            { "Set-Cookie": identity.logout(req) },
          );
        if (p === "/api/me" && method === "GET")
          return json(res, 200, {
            user,
            workspace: JSON.parse(
              db
                .prepare("SELECT value FROM settings WHERE key='workspace'")
                .get()?.value || '{"name":"Workspace"}',
            ),
          });
        if (p === "/api/operations" && method === "GET") {
          identity.scope(user, "operations:read");
          return json(res, 200, { operations: ops.list() });
        }
        if (p === "/api/operations" && method === "POST") {
          identity.scope(user, "operations:write");
          return json(res, 201, {
            operation: ops.propose(await body(req), actor),
          });
        }
        const match = p.match(
          /^\/api\/operations\/([a-zA-Z0-9-]+)(?:\/(approve|execute|reconcile|cancel|receipt))?$/,
        );
        if (match) {
          const [, id, action] = match;
          if (method === "GET") {
            identity.scope(user, "operations:read");
            if (action === "receipt")
              return json(res, 200, JSON.parse(receiptText(ops.get(id))));
            if (!action) return json(res, 200, { operation: ops.get(id) });
          }
          if (method === "POST") {
            if (action === "approve") {
              identity.requireRole(user, ["admin", "operator"]);
              return json(res, 200, { operation: ops.approve(id, actor) });
            }
            identity.scope(
              user,
              action === "execute" ? "operations:execute" : "operations:write",
            );
            if (action === "execute")
              return json(res, 200, {
                operation: await ops.execute(id, actor),
              });
            if (action === "reconcile")
              return json(res, 200, {
                operation: await ops.reconcile(id, actor),
              });
            if (action === "cancel")
              return json(res, 200, { operation: ops.cancel(id, actor) });
          }
        }
        if (p === "/api/audit" && method === "GET") {
          identity.scope(user, "operations:read");
          return json(res, 200, { events: ops.audit() });
        }
        if (p === "/api/connectors" && method === "GET") {
          identity.scope(user, "operations:read");
          return json(res, 200, { github: ops.connection() });
        }
        if (p === "/api/connectors/github" && method === "POST") {
          identity.requireRole(user, ["admin"]);
          return json(res, 200, ops.configure(await body(req), actor));
        }
        if (p === "/api/connectors/github/check" && method === "POST") {
          identity.requireRole(user, ["admin"]);
          return json(res, 200, await ops.checkConnection());
        }
        if (p === "/api/keys") {
          identity.requireRole(user, ["admin"]);
          if (method === "GET")
            return json(res, 200, {
              keys: db
                .prepare(
                  "SELECT id,name,scopes,expires,created FROM api_keys ORDER BY created DESC",
                )
                .all()
                .map((k) => ({ ...k, scopes: JSON.parse(k.scopes) })),
            });
          if (method === "POST") {
            const result = identity.createKey(await body(req), actor);
            ops.event(
              null,
              "key_created",
              actor,
              "Scoped API key created: " + result.name,
            );
            return json(res, 201, result);
          }
        }
        if (p.startsWith("/api/keys/") && method === "DELETE") {
          identity.requireRole(user, ["admin"]);
          db.prepare("DELETE FROM api_keys WHERE id=?").run(p.split("/").pop());
          ops.event(null, "key_revoked", actor, "API key revoked.");
          return json(res, 200, { ok: true });
        }
        if (p === "/api/team" && method === "GET") {
          identity.requireRole(user, ["admin"]);
          return json(res, 200, {
            members: db
              .prepare("SELECT id,name,email,role,created FROM users")
              .all(),
          });
        }
        if (p.startsWith("/api/team/") && method === "DELETE") {
          identity.requireRole(user, ["admin"]);
          const id = p.split("/").pop(),
            member = db.prepare("SELECT * FROM users WHERE id=?").get(id);
          if (!member) fail(404, "Team member not found.");
          if (member.role === "admin" || member.id === user.id)
            fail(409, "The installation administrator cannot be removed here.");
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
            db.prepare("DELETE FROM invites WHERE email=?").run(member.email);
            db.prepare("DELETE FROM users WHERE id=?").run(id);
            ops.event(
              null,
              "member_removed",
              actor,
              "Interactive access revoked for " +
                member.email +
                ". Team API keys are managed separately.",
            );
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          return json(res, 200, { ok: true });
        }
        if (p === "/api/invites" && method === "POST") {
          identity.requireRole(user, ["admin"]);
          const result = identity.invite(await body(req), origin);
          ops.event(
            null,
            "member_invited",
            actor,
            "Invitation created for " +
              result.email +
              " (" +
              result.role +
              ").",
          );
          return json(res, 201, result);
        }
        if (p === "/api/workspace" && method === "POST") {
          identity.requireRole(user, ["admin"]);
          const input = await body(req),
            name = String(input.name || "").trim();
          if (!name || name.length > 80)
            fail(400, "Workspace name must contain 1–80 characters.");
          db.prepare("UPDATE settings SET value=? WHERE key='workspace'").run(
            JSON.stringify({ name }),
          );
          return json(res, 200, { workspace: { name } });
        }
        fail(404, "Endpoint not found.");
      }
      if (!["GET", "HEAD"].includes(method)) fail(405, "Method not allowed.");
      const root = resolve("dist");
      let file = resolve(root, "." + decodeURIComponent(p));
      if (file !== root && !file.startsWith(root + sep))
        fail(403, "Path not allowed.");
      if (existsSync(file) && statSync(file).isDirectory())
        file = resolve(file, "index.html");
      if (!existsSync(file)) {
        if (extname(p)) fail(404, "Asset not found.");
        file = resolve(root, "index.html");
      }
      if (!existsSync(file))
        fail(503, "Build the frontend with npm run build.");
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".zip": "application/zip",
      };
      res.setHeader(
        "Cache-Control",
        extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      );
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
      });
      res.end(method === "HEAD" ? undefined : readFileSync(file));
    } catch (e) {
      if (!res.headersSent)
        json(res, e.status || 500, {
          error: e.status
            ? e.message
            : "The request could not be completed. Check the server configuration or try again.",
        });
      else res.end();
      if (!e.status) console.error("Request failed:", e.name);
    }
  });
  return {
    server,
    db,
    ops,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          db.close();
          resolve();
        }),
      ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = createApp();
  const port = Number(process.env.PORT || 4310);
  app.server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(
      `ActionProof listening on ${process.env.PUBLIC_ORIGIN || "http://localhost:" + port}`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
