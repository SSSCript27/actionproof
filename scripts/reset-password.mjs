import { openStore } from "../server/store.mjs";
import { passwordHash } from "../server/auth.mjs";
import { resolve } from "node:path";
try {
  process.loadEnvFile();
} catch {}
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.stdin.isTTY)
  throw new Error(
    "Run interactively on the server: node scripts/reset-password.mjs user@example.com",
  );
const db = openStore(
    process.env.DATABASE_PATH || resolve("data/actionproof.sqlite"),
  ),
  user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
if (!user) {
  db.close();
  throw new Error("Account not found.");
}
process.stdout.write("New password (12–200 characters; input hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
const read = () =>
  new Promise((resolve) => {
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          process.stdin.setRawMode(false);
          db.close();
          process.exit(1);
        }
        if (char === "\r" || char === "\n") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(password);
          return;
        }
        if (char === "\u007f" || char === "\b")
          password = password.slice(0, -1);
        else if (char >= " " && password.length < 200) password += char;
      }
    };
    process.stdin.on("data", onData);
  });
await read();
if (password.length < 12) {
  db.close();
  throw new Error("Password too short. No change was made.");
}
db.exec("BEGIN IMMEDIATE");
try {
  db.prepare("UPDATE users SET password=? WHERE id=?").run(
    passwordHash(password),
    user.id,
  );
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
  db.prepare(
    "INSERT INTO events(op_id,at,type,actor,detail) VALUES(NULL,?,?,?,?)",
  ).run(
    new Date().toISOString(),
    "password_reset",
    "server administrator",
    "Password reset and sessions revoked for " + email,
  );
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
} finally {
  db.close();
}
password = "";
console.log("Password updated. Existing sessions were revoked.");
