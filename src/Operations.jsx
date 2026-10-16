import React, { useState } from "react";
import { api, download } from "./api.js";
import { Icon } from "./icons.jsx";
import { STATUS, SCENARIOS } from "../shared/domain.js";
export const when = (v) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export function Badge({ status }) {
  return (
    <span className={"status-badge status-" + status}>
      <i />
      {STATUS[status] || status}
    </span>
  );
}
export function OperationTable({ operations, go, compact = false }) {
  return operations.length ? (
    <div className="table-scroll">
      <table className="operations-table">
        <thead>
          <tr>
            <th>Operation</th>
            <th>Outcome</th>
            <th>Destination</th>
            {!compact && <th>Created</th>}
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {operations.map((op) => (
            <tr key={op.id}>
              <td>
                <button
                  className="table-title"
                  onClick={() => go("operations/" + op.id)}
                >
                  {op.payload.title}
                </button>
                <small className="mono">
                  {op.id.slice(0, 8)} ·{" "}
                  {op.payload.connector === "sandbox" ? "SIMULATED" : "GITHUB"}
                </small>
              </td>
              <td>
                <Badge status={op.status} />
              </td>
              <td>
                <span className="repo-name">{op.payload.repo}</span>
              </td>
              {!compact && (
                <td className="muted nowrap">{when(op.createdAt)}</td>
              )}
              <td>
                <button
                  className="icon-button"
                  onClick={() => go("operations/" + op.id)}
                  aria-label={"Open " + op.payload.title}
                >
                  <Icon name="arrow" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="activity" size={26} />
      </span>
      <h3>Your first operation starts here.</h3>
      <p>
        Record an intent, review it, and see the evidence as it moves through
        the system.
      </p>
      <button className="button dark" onClick={() => go("new")}>
        Propose an operation <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
export function Overview({ operations, go, drill, busy }) {
  const pending = operations.filter((o) => o.status === "pending").length,
    unknown = operations.filter((o) => o.status === "unknown").length,
    verified = operations.filter((o) => o.status === "verified").length,
    duplicates = operations.reduce(
      (n, o) =>
        n + o.events.filter((e) => e.type === "duplicate_suppressed").length,
      0,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">WORKSPACE / OVERVIEW</p>
          <h1>Every action. Accounted for.</h1>
          <p className="page-lede">
            Follow the intent. Verify the outcome. Recover with a record.
          </p>
        </div>
        <button className="button dark" onClick={() => go("new")}>
          <Icon name="plus" size={16} />
          New operation
        </button>
      </div>
      <div className="metric-grid">
        {[
          [
            operations.length,
            "Recorded operations",
            "Most recent recorded intents",
            "activity",
          ],
          [
            verified,
            "Verified outcomes",
            "Concrete provider evidence",
            "check",
          ],
          [
            unknown,
            "Uncertain outcomes",
            "Reconcile before taking action",
            "clock",
          ],
          [
            duplicates,
            "Duplicate attempts suppressed",
            "Same key, same payload",
            "shield",
          ],
        ].map(([n, title, caption, icon]) => (
          <article className="metric" key={title}>
            <div>
              <span>{title}</span>
              <Icon name={icon} />
            </div>
            <strong>{n.toLocaleString()}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      {unknown > 0 && (
        <button
          className="attention-banner"
          onClick={() => go("operations?status=unknown")}
        >
          <span className="attention-icon">!</span>
          <div>
            <strong>
              {unknown} {unknown === 1 ? "operation needs" : "operations need"}{" "}
              reconciliation
            </strong>
            <p>
              Unknown does not mean failed. Check for provider evidence before
              deciding what to do next.
            </p>
          </div>
          <Icon name="arrow" />
        </button>
      )}
      <div className="overview-grid">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Recent operations</h2>
              <p>Evidence starts at the write boundary.</p>
            </div>
            <button className="text-button" onClick={() => go("operations")}>
              View all <Icon name="arrow" size={15} />
            </button>
          </header>
          <OperationTable operations={operations.slice(0, 5)} go={go} compact />
        </section>
        <aside className="panel recovery-drill">
          <div className="drill-icon">
            <Icon name="refresh" size={25} />
          </div>
          <span className="eyebrow">THE RESPONSE-LOSS DRILL</span>
          <h2>
            It happened.
            <br />
            The response didn’t.
          </h2>
          <p>
            Create a simulated issue, lose its response, and reconcile the
            original record. No real service is contacted.
          </p>
          <ol>
            <li>Propose & approve</li>
            <li>Execute with a lost response</li>
            <li>Recover the existing receipt</li>
          </ol>
          <button className="button green" disabled={busy} onClick={drill}>
            Start recovery drill <Icon name="arrow" />
          </button>
        </aside>
      </div>
      <div className="overview-bottom">
        <div className="small-panel">
          <span className="mini-icon">
            <Icon name="shield" />
          </span>
          <div>
            <strong>Approval is about the exact payload.</strong>
            <p>
              {pending
                ? `${pending} pending ${pending === 1 ? "intent is" : "intents are"} waiting for a human review.`
                : "No pending approvals. New intents are reviewed before dispatch."}
            </p>
          </div>
          <button className="text-button" onClick={() => go("approvals")}>
            Review <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="small-panel">
          <span className="mini-icon">
            <Icon name="terminal" />
          </span>
          <div>
            <strong>Meet your agent at the boundary.</strong>
            <p>Connect through the API, JavaScript client, or MCP server.</p>
          </div>
          <button className="text-button" onClick={() => go("docs")}>
            Integrate <Icon name="arrow" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
export function Operations({ operations, go, statusFilter = "" }) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(statusFilter);
  const items = operations.filter(
    (o) =>
      (!status || o.status === status) &&
      (o.payload.title + " " + o.id + " " + o.payload.repo)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">WORKSPACE / OPERATIONS</p>
          <h1>The execution record.</h1>
          <p className="page-lede">
            One intent, one identity, a visible outcome.
          </p>
        </div>
        <button className="button dark" onClick={() => go("new")}>
          <Icon name="plus" />
          New operation
        </button>
      </div>
      <section className="panel">
        <div className="filter-row">
          <label className="search-input">
            <Icon name="search" />
            <input
              aria-label="Search operations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, ID, or repository"
            />
          </label>
          <label className="select-label">
            <span>Outcome</span>
            <select
              aria-label="Filter by outcome"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All outcomes</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {items.length || !operations.length ? (
          <OperationTable operations={items} go={go} />
        ) : (
          <div className="empty-state">
            <h3>No matching operations.</h3>
            <p>Try another search or outcome filter.</p>
            <button
              className="button subtle"
              onClick={() => {
                setStatus("");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
export function NewOperation({ connection, onCreate, busy, go }) {
  const [values, setValues] = useState({
    connector: "sandbox",
    repo: "northstar/platform",
    title: "Investigate elevated checkout latency",
    body: "A sanitized example for an engineering investigation.",
    scenario: "clean",
    idempotencyKey: "intent-" + crypto.randomUUID(),
  });
  const update = (k, v) => setValues((x) => ({ ...x, [k]: v }));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">OPERATIONS / PROPOSE</p>
          <h1>Start with the intent.</h1>
          <p className="page-lede">
            Nothing executes here. A team member reviews the exact request
            first.
          </p>
        </div>
      </div>
      <div className="compose-grid">
        <form
          className="panel compose-form"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(values);
          }}
        >
          <div className="form-section">
            <h2>Destination</h2>
            <label>
              Connector
              <select
                value={values.connector}
                onChange={(e) => {
                  update("connector", e.target.value);
                  if (e.target.value === "github") {
                    update("repo", connection.repo);
                    update("scenario", "clean");
                  }
                }}
              >
                <option value="sandbox">Sandbox provider · simulated</option>
                <option
                  value="github"
                  disabled={__SANDBOX__ || !connection.configured}
                >
                  GitHub Issues
                  {__SANDBOX__
                    ? " · self-hosted only"
                    : !connection.configured
                      ? " · connect first"
                      : ""}
                </option>
              </select>
            </label>
            <label>
              Repository
              <input
                required
                value={values.repo}
                maxLength={201}
                onChange={(e) => update("repo", e.target.value)}
                readOnly={values.connector === "github"}
                placeholder="owner/repository"
              />
            </label>
          </div>
          <div className="form-section">
            <h2>Issue payload</h2>
            <label>
              Title
              <input
                required
                maxLength={200}
                value={values.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </label>
            <label>
              Body
              <textarea
                rows={5}
                maxLength={20000}
                value={values.body}
                onChange={(e) => update("body", e.target.value)}
              />
            </label>
          </div>
          <div className="form-section">
            <h2>Execution identity</h2>
            <label>
              Idempotency key
              <input
                required
                minLength={8}
                maxLength={160}
                className="mono"
                value={values.idempotencyKey}
                onChange={(e) => update("idempotencyKey", e.target.value)}
              />
              <small>
                Use a stable key for one business intent. The same key with a
                different payload is rejected.
              </small>
            </label>
            {values.connector === "sandbox" && (
              <label>
                Failure scenario
                <select
                  value={values.scenario}
                  onChange={(e) => update("scenario", e.target.value)}
                >
                  {Object.entries(SCENARIOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="form-actions">
            <button className="button green" disabled={busy} type="submit">
              {busy ? "Recording…" : "Record intent"}
              <Icon name="arrow" />
            </button>
            <button
              className="button subtle"
              type="button"
              onClick={() => go("operations")}
            >
              Cancel
            </button>
          </div>
        </form>
        <aside className="compose-aside">
          <Icon name="shield" size={30} />
          <h3>Reviewable by design.</h3>
          <p>
            The repository, issue title, body, and connector are stored
            together. Approval is bound to a hash of that payload.
          </p>
          <div className="aside-rule" />
          <h4>What happens next</h4>
          <ol>
            <li>Record the intent.</li>
            <li>Review and approve the request.</li>
            <li>Explicitly dispatch the action.</li>
            <li>Inspect the receipt or reconcile the unknown.</li>
          </ol>
          <p className="muted">
            Use sanitized data while evaluating the product.
          </p>
        </aside>
      </div>
    </>
  );
}
export function OperationDetail({
  op,
  user,
  busy,
  act,
  go,
  notify,
  onRefresh,
}) {
  const [confirming, setConfirming] = useState(false);
  if (!op)
    return (
      <div className="empty-state">
        <h2>Operation not found.</h2>
        <button className="button dark" onClick={() => go("operations")}>
          Back to operations
        </button>
      </div>
    );
  const canAct = user.role !== "viewer",
    expired =
      op.approvalExpiresAt && Date.parse(op.approvalExpiresAt) < Date.now();
  return (
    <>
      <button className="back-link" onClick={() => go("operations")}>
        ← All operations
      </button>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow mono">OPERATION / {op.id.slice(0, 8)}</p>
          <h1 className="operation-heading">{op.payload.title}</h1>
          <div className="operation-meta">
            <Badge status={op.status} />
            <span>
              {op.payload.connector === "sandbox"
                ? "Simulated provider"
                : "GitHub Issues"}
            </span>
            <span>{when(op.createdAt)}</span>
          </div>
        </div>
        <button
          className="button subtle"
          onClick={() =>
            download(
              "actionproof-" + op.id + ".json",
              JSON.stringify({ formatVersion: 1, operation: op }, null, 2),
            )
          }
        >
          <Icon name="download" />
          Export receipt
        </button>
      </div>
      {op.status === "unknown" && (
        <div className="callout amber">
          <Icon name="clock" />
          <div>
            <strong>The request outcome is unknown.</strong>
            <p>
              The provider may have created the issue. Execution is locked.
              Reconciliation reads the existing provider record; it does not
              repeat the write.
            </p>
          </div>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Stored intent</h2>
                <p>The exact payload under review. Fields are immutable.</p>
              </div>
              <span className="mono tiny">CREATE ISSUE</span>
            </header>
            <dl className="intent-data">
              <div>
                <dt>Repository</dt>
                <dd>{op.payload.repo}</dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>{op.payload.title}</dd>
              </div>
              <div>
                <dt>Body</dt>
                <dd>
                  <pre>{op.payload.body || "(empty)"}</pre>
                </dd>
              </div>
              <div>
                <dt>Idempotency key</dt>
                <dd className="mono">{op.idempotencyKey}</dd>
              </div>
              <div>
                <dt>Payload SHA-256</dt>
                <dd className="mono hash">{op.payloadHash}</dd>
              </div>
              {op.payload.connector === "sandbox" && (
                <div>
                  <dt>Simulation</dt>
                  <dd>{SCENARIOS[op.payload.scenario]}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="panel timeline-panel">
            <header className="panel-header">
              <div>
                <h2>Evidence timeline</h2>
                <p>Recorded events, separate from the agent’s account.</p>
              </div>
              <span className="mono tiny">
                {op.events.length} {op.events.length === 1 ? "EVENT" : "EVENTS"}
              </span>
            </header>
            <ol className="timeline">
              {op.events.map((e, i) => (
                <li key={e.seq || i}>
                  <span
                    className={
                      "timeline-dot " +
                      (e.type.includes("unknown") ? "warning" : "")
                    }
                  >
                    {e.type === "verified" || e.type === "reconciled" ? (
                      <Icon name="check" size={12} />
                    ) : null}
                  </span>
                  <div>
                    <div className="timeline-title">
                      <strong>{e.type.replaceAll("_", " ")}</strong>
                      <time>{when(e.at)}</time>
                    </div>
                    <p>{e.detail}</p>
                    <small>{e.actor}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel action-panel">
            <span className="eyebrow">NEXT ACTION</span>
            <h2>
              {op.status === "pending"
                ? "Review this request."
                : op.status === "approved"
                  ? "Ready for dispatch."
                  : op.status === "unknown"
                    ? "Establish the outcome."
                    : op.status === "verified"
                      ? "Evidence attached."
                      : op.status === "failed"
                        ? "Provider rejected."
                        : op.status === "cancelled"
                          ? "Cancelled before dispatch."
                          : "Execution in progress."}
            </h2>
            {op.status === "pending" && (
              <>
                <p>
                  Confirm the destination and issue content before approving.
                  Approval applies only to this stored intent and expires after
                  30 minutes.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirming}
                    onChange={(e) => setConfirming(e.target.checked)}
                  />
                  I reviewed the exact repository and payload.
                </label>
                <button
                  className="button green full"
                  disabled={busy || !confirming || !canAct}
                  onClick={() => act("approve")}
                >
                  <Icon name="shield" />
                  Approve exact intent
                </button>
              </>
            )}
            {op.status === "approved" && (
              <>
                <p>
                  {expired
                    ? "This approval has expired. Cancel and submit a fresh intent."
                    : "Approval is bound to the payload hash. Dispatch creates an issue in the configured destination."}
                </p>
                <span className="approval-expiry">
                  Expires {when(op.approvalExpiresAt)}
                </span>
                <button
                  className="button green full"
                  disabled={busy || expired || !canAct}
                  onClick={() => act("execute")}
                >
                  <Icon name="arrow" />
                  {busy ? "Executing…" : "Execute approved action"}
                </button>
              </>
            )}
            {op.status === "unknown" && (
              <>
                <p>
                  Read the provider to look for the original operation marker. A
                  missing match remains unresolved.
                </p>
                <button
                  className="button green full"
                  disabled={busy || !canAct}
                  onClick={() => act("reconcile")}
                >
                  <Icon name="refresh" />
                  {busy ? "Reconciling…" : "Reconcile outcome"}
                </button>
              </>
            )}
            {op.status === "running" && (
              <p>
                Dispatch is claimed. Refresh to read the latest record; do not
                submit a replacement intent.
              </p>
            )}
            {op.status === "verified" && (
              <>
                <p>
                  A provider receipt is recorded below. Re-checking reads the
                  provider again; it performs no new write.
                </p>
                <button
                  className="button subtle full"
                  disabled={busy || !canAct}
                  onClick={() => act("reconcile")}
                >
                  <Icon name="refresh" />
                  Re-check evidence
                </button>
              </>
            )}
            {op.status === "failed" && (
              <p>
                The provider rejected the request. Inspect the recorded reason
                before proposing a revised intent.
              </p>
            )}
            {["pending", "approved"].includes(op.status) && (
              <button
                className="text-button danger-text"
                disabled={busy || !canAct}
                onClick={() => act("cancel")}
              >
                Cancel before dispatch
              </button>
            )}
            {!canAct && (
              <p className="muted">
                Your viewer role can inspect records but cannot change them.
              </p>
            )}
          </section>
          {op.provider && (
            <section className="panel provider-receipt">
              <span className="receipt-stamp">
                <Icon name="check" />
                PROVIDER EVIDENCE
              </span>
              <h3>
                {op.payload.connector === "sandbox"
                  ? "Simulated issue"
                  : "GitHub issue"}{" "}
                #{op.provider.id}
              </h3>
              <p>{op.provider.evidence}</p>
              <small>Observed {when(op.provider.verifiedAt)}</small>
              {op.provider.url && (
                <a
                  className="text-link"
                  href={op.provider.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open provider record <Icon name="out" size={14} />
                </a>
              )}
            </section>
          )}
          <div className="recovery-note">
            <Icon name="book" />
            <p>
              No matching record? Keep the operation unknown and investigate.
              Creating a fresh intent can repeat a real action.
            </p>
          </div>
          <button
            className="text-button"
            disabled={busy || !canAct}
            onClick={async () => {
              try {
                const result = await api("/operations", "POST", {
                  ...op.payload,
                  idempotencyKey: op.idempotencyKey,
                });
                await onRefresh();
                notify("Existing operation returned. No extra dispatch.");
                go("operations/" + result.operation.id);
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Test same-intent deduplication <Icon name="refresh" size={14} />
          </button>
        </aside>
      </div>
    </>
  );
}
