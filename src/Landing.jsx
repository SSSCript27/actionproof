import React from "react";
import { Icon, Mark } from "./icons.jsx";
export default function Landing() {
  return (
    <div className="marketing">
      <header className="marketing-nav">
        <a href="#/" className="brand">
          <Mark />
          ActionProof<span className="version">0.1</span>
        </a>
        <nav>
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            Execution model
          </a>
          <a href="#/docs">Documentation</a>
          <a
            href="https://github.com/SSSCript27/actionproof"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
          <a className="button dark" href="#/overview">
            {__SANDBOX__ ? "Open sandbox" : "Open workspace"}
            <Icon name="arrow" size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-wording">
            <div className="eyebrow">
              <span className="live-dot" /> AGENT ACTIONS / TRACE THE WRITE
            </div>
            <h1>
              A timeout isn’t
              <br />
              an <em>outcome.</em>
            </h1>
            <p className="hero-description">
              The agent sent a write. The connection dropped. Before it tries
              again, find out what actually happened. Keep the payload, human
              approval, dispatch, and provider evidence in one execution record.
            </p>
            <div className="hero-buttons">
              <a className="button green" href="#/overview">
                {__SANDBOX__
                  ? "Try the recovery sandbox"
                  : "Open your workspace"}
                <Icon name="arrow" />
              </a>
              <a className="button subtle" href="#/docs">
                Run it yourself <Icon name="terminal" />
              </a>
            </div>
            <div className="hero-assurances">
              <span>
                <Icon name="check" size={14} />
                Open source
              </span>
              <span>
                <Icon name="check" size={14} />
                Your infrastructure
              </span>
              <span>
                <Icon name="check" size={14} />
                MCP interface
              </span>
            </div>
          </div>
          <div className="hero-proof">
            <div className="proof-top">
              <span>
                <i /> recovery.trace
              </span>
              <span className="mono">ILLUSTRATIVE / GITHUB</span>
            </div>
            <div className="proof-code">
              <div className="code-line">
                <span className="code-line-number" aria-hidden="true">
                  01
                </span>
                <span className="code-comment">
                  // Record intent before touching the API.
                </span>
              </div>
              <div className="code-line">
                <span className="code-line-number" aria-hidden="true">
                  02
                </span>
                <span>
                  <span className="code-key">idempotencyKey</span>:{" "}
                  <span className="code-string">"support-case-1842"</span>
                </span>
              </div>
              <div className="code-line">
                <span className="code-line-number" aria-hidden="true">
                  03
                </span>
                <span>
                  <span className="code-key">repo</span>:{" "}
                  <span className="code-string">"acme/platform"</span>
                </span>
              </div>
              <div className="code-line">
                <span className="code-line-number" aria-hidden="true">
                  04
                </span>
                <span>
                  <span className="code-key">status</span>:{" "}
                  <span className="code-warning">"unknown"</span>
                </span>
              </div>
            </div>
            <div className="proof-path">
              <div>
                <b className="proof-node good">
                  <Icon name="check" />
                </b>
                <span>intent.commit</span>
                <small>Payload persisted</small>
              </div>
              <i />
              <div>
                <b className="proof-node good">
                  <Icon name="check" />
                </b>
                <span>human.approve</span>
                <small>Payload hash matched</small>
              </div>
              <i />
              <div>
                <b className="proof-node uncertain">?</b>
                <span>dispatch.write</span>
                <small>Response lost</small>
              </div>
            </div>
            <div className="proof-resolution">
              <span className="proof-node good">
                <Icon name="shield" />
              </span>
              <div>
                <strong>Read the evidence. Then decide.</strong>
                <p>
                  Reconciliation finds the existing issue. The record becomes
                  verified without another write.
                </p>
              </div>
              <span className="verified-pill">RECONCILED</span>
            </div>
            <div className="proof-footer">
              <span>HTTP RESPONSE ≠ SIDE EFFECT</span>
              <Icon name="activity" size={16} />
            </div>
          </div>
        </section>
        <section className="landing-strip">
          <span>THE WRITE BOUNDARY</span>
          <p>
            Model output becomes operational risk the moment an agent can change
            a system. That boundary deserves a record.
          </p>
          <Icon name="arrow" size={28} />
        </section>
        <section className="landing-section" id="how-it-works">
          <div className="section-intro">
            <p className="eyebrow">INTENT → APPROVAL → DISPATCH → EVIDENCE</p>
            <h2>
              Make the uncertain
              <br />
              part visible.
            </h2>
            <p>
              A conversation is a poor execution ledger. ActionProof stores the
              action independently, so a lost response or restarted process does
              not erase what was dispatched.
            </p>
          </div>
          <div className="feature-columns">
            {[
              [
                "01",
                "Review the exact payload",
                "Repository, title, body. Review the stored intent before execution. Approval is bound to its hash and expires after 30 minutes.",
                "shield",
              ],
              [
                "02",
                "Commit before dispatch",
                "The dispatch claim is persisted before the connector writes. If the process loses the outcome, the operation needs reconciliation. It is not automatically sent again.",
                "clock",
              ],
              [
                "03",
                "Ask the system that changed",
                "Read the provider record and attach the evidence. If no match is found, the outcome stays unresolved. Absence of a match does not prove the write failed.",
                "check",
              ],
            ].map(([n, title, text, icon]) => (
              <article key={n}>
                <span className="feature-number">
                  {n}
                  <Icon name={icon} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-usecase">
          <div>
            <p className="eyebrow">CONNECTOR / GITHUB ISSUES</p>
            <h2>
              One ticket.
              <br />A trace you can inspect.
            </h2>
            <p>
              Scope the connector to one GitHub repository. Propose an issue,
              approve its payload, then execute. In the sandbox, lose the
              response on purpose and recover the existing issue from provider
              evidence.
            </p>
            <a href="#/overview" className="text-link">
              Run the failure drill <Icon name="arrow" />
            </a>
          </div>
          <div className="connector-art">
            <div className="connector-label">
              <Icon name="terminal" />
              Agent / SDK / MCP
            </div>
            <div className="connector-wire" />
            <div className="connector-center">
              <Mark />
              <b>ActionProof</b>
              <span>intent → approval → receipt</span>
            </div>
            <div className="connector-wire" />
            <div className="connector-label">
              <Icon name="link" />
              GitHub Issues
            </div>
          </div>
        </section>
        <section className="landing-section deployment-section">
          <div>
            <p className="eyebrow">SELF-HOSTED / INSPECTABLE / MIT</p>
            <h2>
              Your runtime.
              <br />
              Your execution records.
            </h2>
            <p>
              A Node.js service with SQLite persistence, a browser console, a
              JavaScript client, and an MCP server. Run it with Docker.
              Connector credentials stay on your server; approval stays with the
              person reviewing the action.
            </p>
            <a className="button dark" href="#/docs">
              Get the installation guide <Icon name="arrow" />
            </a>
          </div>
          <aside>
            <h3>Inside the v0.1 boundary</h3>
            <ul>
              <li>
                <Icon name="check" />
                Immutable action intents and scoped API keys
              </li>
              <li>
                <Icon name="check" />
                Human approval before execution
              </li>
              <li>
                <Icon name="check" />
                Provider evidence or an explicit unknown
              </li>
              <li>
                <Icon name="check" />A locally runnable failure-and-recovery
                drill
              </li>
            </ul>
            <p>
              It does not guarantee exactly-once effects across arbitrary APIs.
              Independent security review and deployment hardening are required
              before sensitive production use.
            </p>
          </aside>
        </section>
        <section className="landing-cta">
          <div>
            <p className="eyebrow">BREAK THE RESPONSE. INSPECT THE TRACE.</p>
            <h2>
              Create the uncertainty.
              <br />
              Follow the evidence.
            </h2>
          </div>
          <a href="#/overview" className="button green">
            {__SANDBOX__ ? "Launch sandbox" : "Open workspace"}
            <Icon name="arrow" />
          </a>
        </section>
      </main>
      <footer className="marketing-footer">
        <a className="brand" href="#/">
          <Mark />
          ActionProof
        </a>
        <span>Built by Sumanth Tadikonda · MIT licensed</span>
        <a href="https://sumanth.ai/" target="_blank" rel="noreferrer">
          An engineer’s workshop <Icon name="out" size={13} />
        </a>
      </footer>
    </div>
  );
}
