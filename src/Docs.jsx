import React, { useState } from "react";
import { Icon } from "./icons.jsx";
export function Code({ children }) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="code-block">
      <button
        aria-label="Copy code"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setError("Select the code to copy it.");
          }
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={15} />
        {copied ? "Copied" : "Copy"}
      </button>
      <pre tabIndex={0}>{children}</pre>
      {error && <small role="status">{error}</small>}
    </div>
  );
}
export default function Docs() {
  return (
    <div className="docs">
      <div className="page-eyebrow">GUIDES / GET STARTED</div>
      <h1>From sandbox to your stack.</h1>
      <p className="page-lede">
        The sandbox demonstrates the workflow. The self-hosted app owns the
        durable execution record and connects to your repository.
      </p>
      <div className="callout">
        <Icon name="shield" />
        <div>
          <strong>Public sandbox ≠ a hosted production service</strong>
          <p>
            Sandbox operations are simulated and saved only in this browser. No
            production credentials, real issues, or shared team accounts.
            Download and run the service for real integration.
          </p>
        </div>
      </div>
      <div className="docs-grid">
        <nav aria-label="Documentation contents">
          {[
            ["install", "Installation"],
            ["github", "Connect GitHub"],
            ["workflow", "Action lifecycle"],
            ["sdk", "JavaScript client"],
            ["mcp", "MCP configuration"],
            ["team", "Team access"],
            ["operate", "Operate & back up"],
            ["limits", "Release boundaries"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={"#docs-" + id}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("docs-" + id)?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                });
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="docs-content">
          <section id="docs-install">
            <span className="step-label">01 / INSTALL</span>
            <h2>Start the service.</h2>
            <p>
              Download the source, extract it, and open a terminal in the
              project directory. Node.js 24+ is required for setup; Docker
              Compose runs the packaged service.
            </p>
            <a
              className="button subtle"
              href="https://github.com/SSSCript27/actionproof/archive/refs/heads/main.zip"
              download
            >
              <Icon name="download" />
              Download source ZIP
            </a>
            <Code>{`npm ci\nnpm run setup\ndocker compose up --build -d`}</Code>
            <p>
              The setup command writes a private <code>.env</code> and prints
              your first-administrator setup link. Open that link, choose your
              workspace name, and create your account. Never share the bootstrap
              link.
            </p>
            <p>Without Docker:</p>
            <Code>{`npm ci\nnpm run setup\nnpm run build\nnpm start`}</Code>
            <p>
              Local address: <code>http://localhost:4310</code>. For remote
              access, put the service behind an HTTPS reverse proxy, set{" "}
              <code>PUBLIC_ORIGIN</code> to its exact origin, and restart. Do
              not expose an HTTP deployment publicly.
            </p>
          </section>
          <section id="docs-github">
            <span className="step-label">02 / CONNECT</span>
            <h2>Scope GitHub to one repository.</h2>
            <ol>
              <li>
                Create a fine-grained GitHub token limited to the repository you
                want to use, with Issues read/write and required repository
                metadata access.
              </li>
              <li>
                In Connections, enter <code>owner/repository</code> and the
                token. Save it, then check repository access.
              </li>
              <li>
                Propose a GitHub issue, review the exact payload, approve it,
                and execute.
              </li>
            </ol>
            <p>
              Tokens are encrypted at rest with a key derived from your{" "}
              <code>APP_SECRET</code>. They are never returned through the
              console API. The connection check verifies repository readability
              and issue availability; it does not prove write permission.
            </p>
            <p>
              GitHub issue bodies include an operation marker used for
              reconciliation. If that marker is edited away or the lookup is
              incomplete, the app may be unable to establish the outcome. It
              will not treat a missing match as permission to repeat the write.
            </p>
          </section>
          <section id="docs-workflow">
            <span className="step-label">03 / WORKFLOW</span>
            <h2>Unknown is a first-class outcome.</h2>
            <div className="lifecycle">
              <span>Pending</span>
              <Icon name="arrow" />
              <span>Approved</span>
              <Icon name="arrow" />
              <span>Executing</span>
              <Icon name="arrow" />
              <span>Verified / Unknown / Failed</span>
            </div>
            <p>
              Approval lasts 30 minutes and is tied to the payload hash.
              Changing a request means submitting a new intent with a new
              idempotency key. Reusing a key with a different payload returns a
              conflict.
            </p>
            <p>
              An unknown outcome cannot be executed again. Reconciliation reads
              the provider and attaches matching evidence. If verification is
              unavailable or inconclusive, an operator investigates outside the
              app. Cancellation is available only before dispatch.
            </p>
            <p>
              If the server restarts while dispatch is in flight, that operation
              becomes unknown. No background write retry occurs. Reconciliation
              is an explicit read action in this release.
            </p>
          </section>
          <section id="docs-sdk">
            <span className="step-label">04 / INTEGRATE</span>
            <h2>Use the JavaScript client.</h2>
            <p>
              Create an API key in Access keys. Select only the scopes the
              integration needs. Keys expire after 30 days and can be revoked
              immediately.
            </p>
            <Code>{`import { ActionProof } from './sdk.mjs';\n\nconst client = new ActionProof({\n  url: process.env.ACTIONPROOF_URL,\n  apiKey: process.env.ACTIONPROOF_API_KEY\n});\n\nconst { operation } = await client.propose({\n  connector: 'github',\n  repo: 'your-org/your-repo',\n  title: 'Investigate support case 1842',\n  body: 'Sanitized investigation context.',\n  idempotencyKey: 'support-case-1842-v1'\n});\n\n// A human approves in the console.\n// Only then can an execute-scoped key dispatch it.\nawait client.get(operation.id);\nawait client.execute(operation.id);\n// After an uncertain outcome:\nawait client.reconcile(operation.id);`}</Code>
            <p>
              An idempotency key identifies a business intent, not an individual
              HTTP attempt. Keep the same key across transport retries for that
              same intent. API keys cannot approve their own actions.
            </p>
          </section>
          <section id="docs-mcp">
            <span className="step-label">05 / MCP</span>
            <h2>Connect your assistant.</h2>
            <p>
              The official MCP SDK serves six tools over stdio. Install
              dependencies on the machine running your MCP client, then add this
              configuration using an absolute path to your checkout:
            </p>
            <Code>
              {JSON.stringify(
                {
                  mcpServers: {
                    actionproof: {
                      command: "node",
                      args: ["/absolute/path/to/actionproof/mcp/index.mjs"],
                      env: {
                        ACTIONPROOF_URL: "http://localhost:4310",
                        ACTIONPROOF_API_KEY: "YOUR_SCOPED_API_KEY",
                      },
                    },
                  },
                },
                null,
                2,
              )}
            </Code>
            <p>
              Available tools: <code>list_operations</code>,{" "}
              <code>get_operation</code>, <code>propose_issue</code>,{" "}
              <code>execute_approved_operation</code>,{" "}
              <code>reconcile_operation</code>, and <code>export_receipt</code>.
              Remote service URLs must use HTTPS. Approval remains an
              interactive human action.
            </p>
          </section>
          <section id="docs-team">
            <span className="step-label">06 / TEAM</span>
            <h2>A small, explicit access model.</h2>
            <p>
              Administrators manage connections, keys, invitations, and
              workspace settings. Operators propose, approve, execute,
              reconcile, and cancel operations. Viewers can read operations and
              evidence. An administrator can create a one-use, 24-hour invite
              link tied to an email address. Share it yourself; the app sends no
              email.
            </p>
            <p>
              The same operator may propose and approve an action. Independent
              two-person approval, SSO, and password-reset email are not
              included. Administrators can reset a user’s password from the
              server with the documented recovery script.
            </p>
          </section>
          <section id="docs-operate">
            <span className="step-label">07 / OPERATE</span>
            <h2>Keep the record durable.</h2>
            <p>
              Docker stores the database in a named volume. Back up the SQLite
              database using the backup script and preserve the matching{" "}
              <code>APP_SECRET</code> separately. Losing the secret makes stored
              connector credentials unreadable. Losing the operation database
              also loses idempotency history.
            </p>
            <Code>{`# From the project directory, for a local deployment:\nnode scripts/backup.mjs ./backups/actionproof.sqlite\n\n# For the Docker deployment:\ndocker compose exec actionproof node scripts/backup.mjs /data/backup.sqlite\ndocker compose cp actionproof:/data/backup.sqlite ./backups/actionproof.sqlite\n\n# Recover access on the server (prompts for a new password):\nnode scripts/reset-password.mjs operator@example.com`}</Code>
            <p>
              Run one service replica per database. Do not put SQLite on a
              network filesystem. Review retention, backups, reverse-proxy
              limits, host security, and access policies before handling
              sensitive data. Event exports are ordinary evidence records; this
              release does not claim a cryptographically tamper-proof audit log.
            </p>
          </section>
          <section id="docs-limits">
            <span className="step-label">08 / RELEASE BOUNDARIES</span>
            <h2>Useful now. Honest about scope.</h2>
            <p>
              This release supports a single workspace per installation and one
              real connector action: creating a GitHub issue. The local sandbox
              provider is for drills. There is no automatic multi-system
              rollback, billing service, enterprise compliance certification, or
              universal exactly-once guarantee.
            </p>
            <p>
              MIT-licensed self-hosting is available without per-seat fees in
              this release. Managed hosting and commercial support are not
              offered here. Validate the app in a non-sensitive repository and
              arrange independent security review before sensitive production
              use.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
