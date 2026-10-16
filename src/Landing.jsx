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
            How it works
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
              <span className="live-dot" /> EXECUTION EVIDENCE FOR AI AGENTS
            </div>
            <h1>
              A timeout isn’t
              <br />
              an outcome.
            </h1>
            <p className="hero-description">
              Your agent made a request. Did the system actually change? Record
              the intent, approve the action, and recover with evidence.
            </p>
            <div className="hero-buttons">
              <a className="button green" href="#/overview">
                {__SANDBOX__
                  ? "Try the recovery sandbox"
                  : "Open your workspace"}
                <Icon name="arrow" />
              </a>
              <a className="button subtle" href="#/docs">
                Self-host in minutes <Icon name="terminal" />
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
                <i /> OPERATION / CREATE ISSUE
              </span>
              <span className="mono">Illustrative incident</span>
            </div>
            <div className="proof-code">
              <span className="code-comment">
                // Intent committed before dispatch
              </span>
              <br />
              <span className="code-key">idempotency_key</span>:{" "}
              <span className="code-string">"support-case-1842"</span>
              <br />
              <span className="code-key">target</span>:{" "}
              <span className="code-string">"acme/platform"</span>
            </div>
            <div className="proof-path">
              <div>
                <b className="proof-node good">
                  <Icon name="check" />
                </b>
                <span>Intent recorded</span>
                <small>Exact payload stored</small>
              </div>
              <i />
              <div>
                <b className="proof-node good">
                  <Icon name="check" />
                </b>
                <span>Action approved</span>
                <small>Hash-bound approval</small>
              </div>
              <i />
              <div>
                <b className="proof-node uncertain">?</b>
                <span>Response lost</span>
                <small>Outcome unknown</small>
              </div>
            </div>
            <div className="proof-resolution">
              <span className="proof-node good">
                <Icon name="shield" />
              </span>
              <div>
                <strong>Verify before repeating.</strong>
                <p>
                  Read the provider record. Recover the receipt. Keep one issue.
                </p>
              </div>
              <span className="verified-pill">RECONCILED</span>
            </div>
            <div className="proof-footer">
              <span>REQUEST STATUS ≠ BUSINESS OUTCOME</span>
              <Icon name="activity" size={16} />
            </div>
          </div>
        </section>
        <section className="landing-strip">
          <span>BUILT FOR THE WRITE BOUNDARY</span>
          <p>
            For platform teams moving agents from answering questions to
            changing systems.
          </p>
          <Icon name="arrow" size={28} />
        </section>
        <section className="landing-section" id="how-it-works">
          <div className="section-intro">
            <p className="eyebrow">ONE ACTION. A COMPLETE RECORD.</p>
            <h2>
              Make the uncertain
              <br />
              part visible.
            </h2>
            <p>
              ActionProof sits between the agent and the connector. It keeps the
              execution record outside the model’s conversation.
            </p>
          </div>
          <div className="feature-columns">
            {[
              [
                "01",
                "Approve the actual action",
                "Review the repository, title, and body. Approval is bound to the stored payload and expires after 30 minutes.",
                "shield",
              ],
              [
                "02",
                "Remember across failures",
                "A durable record survives process restarts. A claimed dispatch is never automatically repeated after an uncertain outcome.",
                "clock",
              ],
              [
                "03",
                "Reconcile with the provider",
                "Read an existing provider record to verify what happened. A missing match stays unresolved, rather than becoming permission to retry.",
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
            <p className="eyebrow">START WITH ONE WORKFLOW</p>
            <h2>
              An engineering ticket.
              <br />
              Created once. Accounted for.
            </h2>
            <p>
              The first connector creates GitHub issues in one explicitly
              configured repository. Simulate a lost response, then reconcile
              the existing issue without dispatching another write.
            </p>
            <a href="#/overview" className="text-link">
              Walk through the incident <Icon name="arrow" />
            </a>
          </div>
          <div className="connector-art">
            <div className="connector-label">
              <Icon name="terminal" />
              Your agent
            </div>
            <div className="connector-wire" />
            <div className="connector-center">
              <Mark />
              <b>ActionProof</b>
              <span>Intent · Approval · Receipt</span>
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
            <p className="eyebrow">SMALL FOOTPRINT. CLEAR BOUNDARIES.</p>
            <h2>
              Run it where
              <br />
              your work lives.
            </h2>
            <p>
              One self-hosted service, SQLite persistence, a browser console, a
              JavaScript client, and an MCP server. Start with Docker. Keep
              connector credentials on your server.
            </p>
            <a className="button dark" href="#/docs">
              Get the installation guide <Icon name="arrow" />
            </a>
          </div>
          <aside>
            <h3>What this release promises</h3>
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
                <Icon name="check" />A concrete receipt or an explicit unknown
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
            <p className="eyebrow">NO BLACK BOX REQUIRED</p>
            <h2>
              See the failure.
              <br />
              Then see the recovery.
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
