import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `APP_SECRET=${randomBytes(48).toString("base64url")}\nBOOTSTRAP_TOKEN=${randomBytes(32).toString("base64url")}\nPUBLIC_ORIGIN=http://localhost:4310\nPORT=4310\nDATABASE_PATH=./data/actionproof.sqlite\n`,
    { mode: 0o600 },
  );
const env = readFileSync(".env", "utf8");
const bootstrap = env.match(/^BOOTSTRAP_TOKEN=(.+)$/m)?.[1],
  origin = env.match(/^PUBLIC_ORIGIN=(.+)$/m)?.[1] || "http://localhost:4310";
console.log(
  "Configuration is ready. Keep .env private and back it up with your database.",
);
console.log(
  `After starting the app, create the first administrator at:\n${origin}/#/setup?token=${bootstrap}`,
);
