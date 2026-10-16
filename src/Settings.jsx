import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./icons.jsx";
import { Code } from "./Docs.jsx";
import { when, Badge } from "./Operations.jsx";
export function Audit({ events, go }) {
  const [query, setQuery] = useState("");
  const rows = events.filter((e) =>
    (e.type + " " + e.actor + " " + e.detail)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">WORKSPACE / AUDIT</p>
          <h1>The evidence trail.</h1>
          <p className="page-lede">
            Operation and administrative events, recorded as they happen.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="filter-row">
          <label className="search-input">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search event, actor, or detail"
              aria-label="Search audit events"
            />
          </label>
          <span className="muted tiny">Latest 1,000 server events</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="operations-table audit-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Time</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={e.seq || i}>
                    <td>
                      <strong className="event-name">
                        {e.type.replaceAll("_", " ")}
                      </strong>
                      <p>{e.detail}</p>
                    </td>
                    <td className="muted">{e.actor}</td>
                    <td className="muted nowrap">{when(e.at)}</td>
                    <td>
                      {e.operationId ? (
                        <button
                          className="text-button mono"
                          onClick={() => go("operations/" + e.operationId)}
                        >
                          {e.operationId.slice(0, 8)}
                          <Icon name="arrow" size={13} />
                        </button>
                      ) : (
                        "Workspace"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="activity" size={28} />
            <h3>No events to show.</h3>
            <p>
              {query
                ? "Try a broader search."
                : "Propose an operation to start the record."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
export function Connections({ connection, user, refresh, notify }) {
  const [repo, setRepo] = useState(connection.repo || ""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [check, setCheck] = useState(null);
  const disabled = __SANDBOX__ || user.role !== "admin";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">CONFIGURATION / CONNECTIONS</p>
          <h1>Scope the write boundary.</h1>
          <p className="page-lede">
            One explicitly configured GitHub repository. Credentials stay on the
            server.
          </p>
        </div>
      </div>
      {__SANDBOX__ && (
        <div className="callout">
          <Icon name="shield" />
          <div>
            <strong>Real credentials do not belong in this sandbox.</strong>
            <p>
              Install the self-hosted service to connect GitHub. These fields
              are intentionally disabled here.
            </p>
          </div>
        </div>
      )}
      <div className="settings-grid">
        <section className="panel connection-card">
          <header className="panel-header">
            <div className="connection-title">
              <span className="connector-icon">
                <Icon name="link" size={24} />
              </span>
              <div>
                <h2>GitHub Issues</h2>
                <p>Create an issue · verify its record</p>
              </div>
            </div>
            <span
              className={
                "connection-badge " + (connection.configured ? "connected" : "")
              }
            >
              {connection.configured ? "Configured" : "Not connected"}
            </span>
          </header>
          <form
            className="form-pad"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/connectors/github", "POST", { repo, token });
                setToken("");
                setCheck(null);
                await refresh();
                notify("GitHub connector saved. Check repository access next.");
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Repository
              <input
                disabled={disabled}
                required
                placeholder="your-org/your-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </label>
            <label>
              Fine-grained access token
              <input
                disabled={disabled}
                autoComplete="off"
                required
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  connection.configured
                    ? "Enter a replacement token to update"
                    : "github_pat_…"
                }
              />
              <small>
                Limit the token to this repository, with Issues read/write.
                Saving replaces the configured scope and token.
              </small>
            </label>
            <div className="form-actions">
              <button
                className="button dark"
                disabled={disabled || busy}
                type="submit"
              >
                Save connection
              </button>
              <button
                className="button subtle"
                disabled={disabled || busy || !connection.configured}
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    setCheck(await api("/connectors/github/check", "POST", {}));
                    notify("Repository is readable and issues are enabled.");
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Check repository access <Icon name="refresh" size={15} />
              </button>
            </div>
            {check && (
              <p className="success-note" role="status">
                {check.repository}: {check.note}
              </p>
            )}
          </form>
        </section>
        <aside className="panel configuration-notes">
          <Icon name="shield" size={28} />
          <h3>A connector is a boundary.</h3>
          <p>
            New intents must match the configured repository. Existing intents
            are immutable; changing connector scope can prevent them from
            executing or reconciling.
          </p>
          <p>
            GitHub credentials are encrypted at rest. They never appear in API
            responses or evidence exports.
          </p>
          <a className="text-link" href="#/docs">
            Connection guide <Icon name="arrow" size={15} />
          </a>
        </aside>
      </div>
      <section className="panel sandbox-connection">
        <span className="mini-icon">
          <Icon name="terminal" />
        </span>
        <div>
          <h3>Sandbox provider</h3>
          <p>
            Always available for drills. Simulates independent provider records,
            lost responses, and rejection before dispatch. No external writes.
          </p>
        </div>
        <span className="connection-badge connected">Available</span>
      </section>
    </>
  );
}
export function Keys({ user, notify }) {
  const [keys, setKeys] = useState([]),
    [name, setName] = useState("My agent"),
    [scopes, setScopes] = useState(["operations:read", "operations:write"]),
    [created, setCreated] = useState(null),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setKeys((await api("/keys")).keys);
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    if (user.role === "admin") load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">CONFIGURATION / ACCESS KEYS</p>
          <h1>Give access a boundary.</h1>
          <p className="page-lede">
            Scoped credentials for SDKs and MCP clients. No machine approval
            permission.
          </p>
        </div>
      </div>
      {user.role !== "admin" ? (
        <div className="callout">Only administrators can manage API keys.</div>
      ) : (
        <>
          <section className="panel form-pad">
            <h2>Create an API key</h2>
            {__SANDBOX__ && (
              <p className="muted">
                The public sandbox cannot issue service credentials. Run the
                self-hosted service to create real keys.
              </p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  setCreated(await api("/keys", "POST", { name, scopes }));
                  await load();
                  notify(
                    "Key created. Copy it now; it will not be shown again.",
                  );
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Key name
                <input
                  disabled={__SANDBOX__}
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <fieldset className="scope-options">
                <legend>Allowed scopes</legend>
                {[
                  ["operations:read", "Read operations and evidence"],
                  [
                    "operations:write",
                    "Propose, cancel and reconcile operations",
                  ],
                  ["operations:execute", "Execute already-approved operations"],
                ].map(([scope, label]) => (
                  <label className="checkbox-label" key={scope}>
                    <input
                      disabled={__SANDBOX__}
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(e) =>
                        setScopes((a) =>
                          e.target.checked
                            ? [...a, scope]
                            : a.filter((x) => x !== scope),
                        )
                      }
                    />
                    <span>
                      <code>{scope}</code>
                      <small>{label}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                className="button dark"
                disabled={__SANDBOX__ || busy || !scopes.length}
              >
                Create 30-day key <Icon name="key" size={15} />
              </button>
            </form>
            {created && (
              <div className="key-secret">
                <strong>Copy this key now</strong>
                <p>
                  Store it in your application’s secret manager. It is shown
                  only in this session.
                </p>
                <Code>{created.token}</Code>
                <button
                  className="text-button"
                  onClick={() => setCreated(null)}
                >
                  Hide key
                </button>
              </div>
            )}
          </section>
          <section className="panel keys-list">
            <header className="panel-header">
              <h2>Active keys</h2>
              <span className="tiny muted">
                Revocation takes effect immediately.
              </span>
            </header>
            {keys.length ? (
              <div className="table-scroll">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Scopes</th>
                      <th>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id}>
                        <td>{k.name}</td>
                        <td className="mono tiny">{k.scopes.join(", ")}</td>
                        <td>{when(k.expires)}</td>
                        <td>
                          <button
                            className="text-button danger-text"
                            onClick={async () => {
                              try {
                                await api("/keys/" + k.id, "DELETE");
                                await load();
                                notify("API key revoked.");
                              } catch (e) {
                                notify(e.message);
                              }
                            }}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <p>No service keys have been issued.</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
export function Team({ user, workspace, refresh, notify }) {
  const [members, setMembers] = useState([]),
    [name, setName] = useState(workspace.name),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("operator"),
    [invite, setInvite] = useState(null);
  useEffect(() => {
    if (user.role === "admin")
      api("/team")
        .then((x) => setMembers(x.members))
        .catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">CONFIGURATION / WORKSPACE</p>
          <h1>A team, with clear roles.</h1>
          <p className="page-lede">
            One workspace per installation. Keep access explicit.
          </p>
        </div>
      </div>
      {user.role !== "admin" ? (
        <div className="callout">
          Only administrators can manage this workspace.
        </div>
      ) : (
        <div className="settings-grid">
          <div>
            <section className="panel form-pad">
              <h2>Workspace identity</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api("/workspace", "POST", { name });
                    await refresh();
                    notify("Workspace name updated.");
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                <label>
                  Workspace name
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button className="button dark">Save workspace</button>
              </form>
            </section>
            <section className="panel members-panel">
              <header className="panel-header">
                <h2>Team members</h2>
              </header>
              {members.map((m) => (
                <div className="member-row" key={m.id}>
                  <span className="avatar">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </div>
                  <span className="role-pill">{m.role}</span>
                  {m.role !== "admin" && (
                    <button
                      disabled={__SANDBOX__}
                      className="text-button danger-text"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Remove this teammate and revoke their interactive sessions? Team API keys must be revoked separately.",
                          )
                        )
                          return;
                        try {
                          await api("/team/" + m.id, "DELETE");
                          setMembers((a) => a.filter((x) => x.id !== m.id));
                          notify(
                            "Interactive access revoked. Review team API keys separately.",
                          );
                        } catch (e) {
                          notify(e.message);
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </section>
          </div>
          <section className="panel form-pad">
            <h2>Invite a teammate</h2>
            <p className="muted">
              Creates a one-use link tied to their email. Expires after 24
              hours. Share the link yourself; no email is sent.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setInvite(await api("/invites", "POST", { email, role }));
                  notify(
                    "Invitation created. Share it with the intended teammate.",
                  );
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              <label>
                Email
                <input
                  disabled={__SANDBOX__}
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <label>
                Role
                <select
                  disabled={__SANDBOX__}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="operator">
                    Operator · review and operate
                  </option>
                  <option value="viewer">Viewer · read evidence</option>
                </select>
              </label>
              <button className="button dark" disabled={__SANDBOX__}>
                Create invitation <Icon name="users" size={15} />
              </button>
            </form>
            {__SANDBOX__ && (
              <p className="muted">
                Team invitations are available in the self-hosted app.
              </p>
            )}
            {invite && (
              <div className="key-secret">
                <strong>One-use invitation</strong>
                <Code>{invite.url}</Code>
                <small>Expires {when(invite.expiresAt)}</small>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
