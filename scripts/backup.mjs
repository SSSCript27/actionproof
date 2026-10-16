import { DatabaseSync, backup } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
try {
  process.loadEnvFile();
} catch {}
const destination = process.argv[2];
if (!destination)
  throw new Error("Usage: node scripts/backup.mjs /path/to/new-backup.sqlite");
const output = resolve(destination);
if (existsSync(output))
  throw new Error("Destination already exists. Choose a new backup filename.");
mkdirSync(dirname(output), { recursive: true });
const db = new DatabaseSync(
  process.env.DATABASE_PATH || resolve("data/actionproof.sqlite"),
  { readOnly: true },
);
await backup(db, output);
db.close();
console.log(
  "SQLite backup completed. Preserve the matching APP_SECRET separately.",
);
