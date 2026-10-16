# ActionProof

**Know what actually happened.** A self-hosted execution and recovery service for agent-triggered actions. Record an intent, review its exact payload, explicitly dispatch it, and attach provider evidence—or keep the outcome unknown.

Source: **https://github.com/SSSCript27/actionproof**

Public, simulated sandbox and source download: **https://sumanth.ai/actionproof/**

MIT licensed. Built by Sumanth Tadikonda. Release 0.1.0 is a working, deliberately bounded implementation for evaluation and small-team pilots, not a claim of enterprise certification.

## Included

- React product site and responsive operator console.
- Node.js service with persistent SQLite/WAL storage.
- Administrator bootstrap, password login, 12-hour HttpOnly sessions, operator/viewer invitations, and scoped, revocable 30-day API keys.
- Immutable operation payloads, stable idempotency identities, hash-bound 30-minute human approvals, and atomic dispatch claims.
- One real connector action: **create a GitHub issue in one configured repository**.
- Provider read-back reconciliation after ambiguous outcomes; no blind write retry.
- Durable event history, JSON receipts, encrypted stored connector credentials, and crash recovery to `unknown`.
- A JavaScript client and an official-SDK MCP stdio server.
- A sandbox connector with normal delivery, response-loss-after-write, and pre-dispatch rejection scenarios.
- Docker Compose, backup/recovery scripts, and backend/HTTP/MCP integration tests.

## Quick start

Requirements: Node.js 24 or newer, npm, and optionally Docker with Compose. The application uses Node's built-in `node:sqlite` API, which emits an experimental-feature warning in the tested Node 24 runtime.

Extract the source ZIP, open a terminal in this directory, and run:

```sh
npm ci
npm run setup
docker compose up --build -d
```

The setup command creates `.env` if it does not exist and prints a bootstrap link. Open that link to create the first administrator. The link contains a secret: do not post or share it. Setup refuses to create another administrator once the installation is initialized.

Open **http://localhost:4310**. Docker binds the published port to loopback by default. Connector credentials and application records are stored in the named `actionproof-data` volume.

Without Docker:

```sh
npm ci
npm run setup
npm run build
npm start
```

For a remote installation, configure an HTTPS reverse proxy and set `PUBLIC_ORIGIN` in `.env` to the exact HTTPS origin. Restart the service after changes. Do not publicly expose plain HTTP or relax the Origin checks to make a proxy work.

## Try the recovery workflow

1. Open Overview and select **Start recovery drill**.
2. Review the stored repository, title, body, scenario, and SHA-256 payload hash.
3. Check the review acknowledgement and approve the exact intent.
4. Execute it. The sandbox provider creates its record, then simulates a lost response. The operation becomes `unknown`.
5. Select **Reconcile outcome**. It reads the existing record and attaches evidence without creating another issue.
6. Export the receipt or test same-intent deduplication.

The public browser sandbox saves simulated records only on that browser/device. It is not the real service, does not have shared accounts, and will never accept a production GitHub token. Its source is `src/sandbox.js`; the durable service is `server/`.

## Connect GitHub

Create a fine-grained token limited to one non-sensitive test repository with Issues read/write and required metadata access. Save it in **Connections** with the `owner/repository` target. The access check reads repository metadata and confirms issues are enabled; it cannot establish issue-write permission without an actual write.

Propose an operation using the GitHub connector, approve it, then explicitly execute it. Actual issue creation is a real external action. The application does not create test issues on your behalf during installation.

Each created issue contains `<!-- actionproof:OPERATION_ID -->`. Reconciliation reads a known issue or up to five pages of recent repository issues for that marker. Removed markers, changed repository scope, inaccessible records, and larger repositories can prevent verification. A missing match is **not** proof of failure; no automatic retry occurs.

## JavaScript client

Create an API key under **Access keys**. Select only needed scopes. The token is displayed once.

```js
import { ActionProof } from "./sdk.mjs";

const ap = new ActionProof({
  url: process.env.ACTIONPROOF_URL,
  apiKey: process.env.ACTIONPROOF_API_KEY,
});

const { operation } = await ap.propose({
  connector: "github",
  repo: "your-org/your-repo",
  title: "Investigate support case 1842",
  body: "Sanitized context",
  idempotencyKey: "support-case-1842-v1",
});

// A human approves the stored payload in the console.
await ap.get(operation.id);
await ap.execute(operation.id);
// If the outcome is unknown, read the provider; do not repeat the write:
await ap.reconcile(operation.id);
```

Repeated proposal requests with the same key and payload return the existing intent. The same key with different contents returns HTTP 409. A key must be unique per business intent and stable across HTTP retries. Do not create a new key merely to bypass an uncertain result.

## MCP

Install this checkout's dependencies on the MCP-client machine. Add the following client configuration, adapting the absolute path:

```json
{
  "mcpServers": {
    "actionproof": {
      "command": "node",
      "args": ["/absolute/path/to/actionproof/mcp/index.mjs"],
      "env": {
        "ACTIONPROOF_URL": "http://localhost:4310",
        "ACTIONPROOF_API_KEY": "YOUR_SCOPED_API_KEY"
      }
    }
  }
}
```

Tools: `list_operations`, `get_operation`, `propose_issue`, `execute_approved_operation`, `reconcile_operation`, and `export_receipt`. There is intentionally **no machine approval tool**. Remote server URLs require HTTPS. Keep API keys in your client's private configuration or secret manager, never a committed example file.

## HTTP API

Session authentication is used by the browser; service clients use `Authorization: Bearer KEY`. Session writes require a matching `Origin: PUBLIC_ORIGIN` and JSON content. Do not enable permissive CORS.

| Endpoint                                                   | Method     | Access                                    |
| ---------------------------------------------------------- | ---------- | ----------------------------------------- |
| `/healthz`                                                 | GET        | Public liveness                           |
| `/api/bootstrap`                                           | GET        | Public setup status                       |
| `/api/setup`, `/api/login`, `/api/join`                    | POST       | Bootstrap token / password / invitation   |
| `/api/me`                                                  | GET        | Authenticated                             |
| `/api/operations`                                          | GET / POST | Read / write scope                        |
| `/api/operations/:id`                                      | GET        | Read scope                                |
| `/api/operations/:id/approve`                              | POST       | Interactive administrator or operator     |
| `/api/operations/:id/execute`                              | POST       | Execute scope and valid existing approval |
| `/api/operations/:id/reconcile`                            | POST       | Write scope                               |
| `/api/operations/:id/cancel`                               | POST       | Write scope, before dispatch only         |
| `/api/operations/:id/receipt`                              | GET        | Read scope                                |
| `/api/audit`                                               | GET        | Read scope                                |
| `/api/connectors`                                          | GET        | Read scope                                |
| `/api/connectors/github`, `/api/connectors/github/check`   | POST       | Interactive administrator                 |
| `/api/keys`, `/api/team`, `/api/invites`, `/api/workspace` | Varies     | Interactive administrator                 |

The console's list endpoint returns the latest 500 operations and latest 1,000 audit events. Retrieve an older operation directly by ID through the API. These are display limits, not automatic record deletion.

## Reliability contract

- `pending → approved → running → verified | unknown | failed`.
- Approval is tied to the stored payload hash and expires after 30 minutes.
- Dispatch claim and its event are committed before an external request is made.
- An interrupted `running` operation becomes `unknown` on service startup. It is not re-executed automatically.
- An explicit provider rejection can mark failure. A timeout, ambiguous response, or crash cannot establish that no change happened.
- Reconciliation attaches evidence when possible. It never blindly repeats the original write.
- Cancellation stops only an undispatched intent; it does not undo an issue.
- Provider creation responses establish receipt evidence; reconciliation performs a fresh read when requested.

This does not guarantee exactly-once external effects across arbitrary APIs. Independent actors can still create similar issues, operation markers can be changed, and provider reads can be incomplete. Requests made outside ActionProof are outside its control. A restored backup can lose recent deduplication history, so investigate outstanding operations before resuming dispatch.

## Operate and recover

Run one service process/replica per SQLite database. Keep its files on local persistent storage, not an NFS share. Keep the database, `.env`, and backups out of version control. Preserve `APP_SECRET` with the corresponding backup: it decrypts stored connector tokens.

```sh
# Local service; destination must not already exist.
node scripts/backup.mjs ./backups/actionproof.sqlite

# Docker service:
docker compose exec actionproof node scripts/backup.mjs /data/backup.sqlite
docker compose cp actionproof:/data/backup.sqlite ./backups/actionproof.sqlite
```

To restore, stop the service, preserve the current files, restore a consistent SQLite backup to the configured database location with the correct ownership, preserve the matching secret, then start the service. Do not delete a live WAL file or replace a live database. Document your retention and disaster-recovery policy before production.

Password recovery requires access to the server and an interactive terminal. It revokes existing sessions for that user:

```sh
node scripts/reset-password.mjs operator@example.com
# Or for Docker:
docker compose exec actionproof node scripts/reset-password.mjs operator@example.com
```

Invitations are one-use, email-bound, and expire after 24 hours. The app does not send email. API keys expire after 30 days and can be revoked. The same operator can propose and approve an operation; dual-control approval is not implemented.

## Development and validation

```sh
npm test
npm run build
npm run build:sandbox
npm audit --omit=dev
```

Tests cover deduplication, payload tampering, expired approval, concurrent dispatch, ambiguous results, persistence/restart recovery, scope restrictions, encrypted credentials, sessions, CSRF, invitations, key revocation, an HTTP GitHub test provider, and the official MCP client workflow. No test contacts GitHub or creates a real issue.

`npm run dev` starts the Vite frontend with `/api` proxied to a service at port 4310. Build sandbox output is `sandbox-dist/` with a `/actionproof/` base. Regular output is `dist/` and uses the real same-origin backend.

## Boundaries and security

This release is single-workspace, supports one GitHub issue-creation connector, and uses explicit human approval. It does not include SSO, billing, managed hosting, multi-system compensation, background write retries, independent two-person approval, or an external tamper-proof ledger. It has not undergone independent security certification or penetration testing. Evaluate with sanitized data in a non-sensitive repository, configure host/proxy controls, and arrange independent review before sensitive production deployment.

Potential issues can be discussed privately with the maintainer through **https://www.linkedin.com/in/sumanthst/**. Do not post live tokens or private operation contents in public issues.
