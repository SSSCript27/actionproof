import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Landing from "./Landing.jsx";
import Docs from "./Docs.jsx";
import Auth from "./Auth.jsx";
import { Icon, Mark } from "./icons.jsx";
import { api } from "./api.js";
import {
  Overview,
  Operations,
  NewOperation,
  OperationDetail,
} from "./Operations.jsx";
import { Audit, Connections, Keys, Team } from "./Settings.jsx";
import "./style.css";
const nav = [
  ["overview", "grid", "Overview"],
  ["operations", "activity", "Operations"],
  ["approvals", "shield", "Approvals"],
  ["audit", "clock", "Audit trail"],
  ["connections", "link", "Connections"],
  ["keys", "key", "Access keys"],
  ["team", "users", "Workspace"],
  ["docs", "book", "Documentation"],
];
function route() {
  return location.hash.replace(/^#\/?/, "") || "landing";
}
function App() {
  const [view, setView] = useState(route),
    [session, setSession] = useState(null),
    [needsSetup, setNeedsSetup] = useState(false),
    [operations, setOperations] = useState([]),
    [events, setEvents] = useState([]),
    [connection, setConnection] = useState({ configured: false }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [loadError, setLoadError] = useState("");
  const go = useCallback((v) => {
    location.hash = "/" + v;
    setMenu(false);
  }, []);
  const notify = useCallback((text) => setToast(text), []);
  const refresh = useCallback(async () => {
    const me = await api("/me");
    setSession(me);
    const [o, a, c] = await Promise.all([
      api("/operations"),
      api("/audit"),
      api("/connectors"),
    ]);
    setOperations(o.operations);
    setEvents(a.events);
    setConnection(c.github);
    setLoadError("");
    return me;
  }, []);
  useEffect(() => {
    const hash = () => {
      setView(route());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const b = await api("/bootstrap");
        if (active) setNeedsSetup(b.needsSetup);
        if (!b.needsSetup) await refresh();
      } catch (e) {
        if (e.status !== 401 && active) setLoadError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!session || view === "landing") return;
    let stopped = false;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !busy)
        Promise.all([api("/operations"), api("/audit")])
          .then(([o, a]) => {
            if (!stopped) {
              setOperations(o.operations);
              setEvents(a.events);
            }
          })
          .catch((e) => {
            if (e.status === 401) {
              setSession(null);
              notify("Session expired. Sign in again.");
            }
          });
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, view, busy]);
  const work = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const create = (values) =>
    work(async () => {
      const r = await api("/operations", "POST", values);
      go("operations/" + r.operation.id);
      notify("Intent recorded. Review and approve before dispatch.");
    });
  const drill = () =>
    create({
      connector: "sandbox",
      repo: "northstar/platform",
      title: "Recovery drill: checkout latency investigation",
      body: "Simulated support escalation. This drill intentionally loses the creation response. Reconcile to find the existing issue.",
      scenario: "lost_response",
      idempotencyKey: "drill-" + crypto.randomUUID(),
    });
  const page = view.split("?")[0],
    status = new URLSearchParams(view.split("?")[1] || "").get("status") || "";
  if (view === "landing")
    return (
      <>
        <Landing />
        {toast && <Toast text={toast} close={() => setToast("")} />}
      </>
    );
  if (loading)
    return (
      <div className="app-loading">
        <Mark />
        <h2>Opening the workspace…</h2>
        <span className="loading-line" />
      </div>
    );
  if (loadError && !session && page !== "docs")
    return (
      <div className="app-loading">
        <Icon name="link" size={32} />
        <h2>The service is unavailable.</h2>
        <p>{loadError}</p>
        <button className="button dark" onClick={() => location.reload()}>
          Try again
        </button>
        <a href="#/docs">Installation guide</a>
      </div>
    );
  if (!session && page !== "docs")
    return (
      <Auth
        needsSetup={needsSetup}
        joining={page === "join"}
        onReady={async () => {
          await refresh();
          setNeedsSetup(false);
          go("overview");
        }}
      />
    );
  const name = session?.workspace.name || "ActionProof guide",
    user = session?.user || { name: "Guest", role: "viewer", email: "" };
  const label =
    nav.find((n) => page.startsWith(n[0]))?.[2] || "Operation detail";
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#app-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("app-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <a href="#/" className="brand">
          <Mark />
          ActionProof
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>
              {__SANDBOX__ ? "Public sandbox" : "Self-hosted workspace"}
            </small>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>
        <span className="nav-group-label">WORKSPACE</span>
        <nav aria-label="Product navigation">
          {nav.map(([id, icon, text], i) => (
            <React.Fragment key={id}>
              {i === 4 && (
                <span className="nav-group-label configuration-label">
                  CONFIGURATION
                </span>
              )}
              <a
                href={"#/" + id}
                className={
                  page === id || page.startsWith(id + "/") ? "active" : ""
                }
              >
                <Icon name={icon} />
                <span>{text}</span>
                {id === "approvals" &&
                  operations.some((o) => o.status === "pending") && (
                    <b className="nav-count">
                      {operations.filter((o) => o.status === "pending").length}
                    </b>
                  )}
              </a>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="deployment-badge">
            <span className="live-dot" />
            <span>
              {__SANDBOX__ ? "LOCAL DEMO STATE" : "SELF-HOSTED SERVICE"}
            </span>
            <small>v0.1.0</small>
          </div>
          <div className="profile">
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            {session && !__SANDBOX__ && (
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={async () => {
                  await api("/logout", "POST", {});
                  setSession(null);
                  go("overview");
                }}
              >
                <Icon name="logout" size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="app-topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <Icon name="menu" />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span> <b>{label}</b>
          </span>
          <div>
            <span className="environment-pill">
              <i />
              {__SANDBOX__ ? "SANDBOX" : "SELF-HOSTED"}
            </span>
            <a href="#/docs" className="topbar-help">
              <Icon name="book" size={15} />
              Quick start
            </a>
          </div>
        </header>
        {__SANDBOX__ && (
          <div className="sandbox-banner">
            <Icon name="terminal" size={15} />
            <span>
              Interactive sandbox · simulated connectors · data stays in this
              browser
            </span>
            <button
              onClick={() =>
                work(async () => {
                  if (
                    !confirm(
                      "Reset this browser’s sandbox operations and evidence? Export any receipts you need first.",
                    )
                  )
                    return;
                  await api("/reset", "POST", {});
                  go("overview");
                  notify("Sandbox reset.");
                })
              }
            >
              Reset sandbox
            </button>
          </div>
        )}
        <main id="app-content" tabIndex={-1} className="app-content">
          {page === "docs" ? (
            <Docs />
          ) : page === "overview" ? (
            <Overview
              operations={operations}
              go={go}
              drill={drill}
              busy={busy}
            />
          ) : page === "new" ? (
            <NewOperation
              connection={connection}
              onCreate={create}
              busy={busy}
              go={go}
            />
          ) : page === "operations" ? (
            <Operations
              key={status}
              operations={operations}
              go={go}
              statusFilter={status}
            />
          ) : page.startsWith("operations/") ? (
            <OperationDetail
              op={operations.find((o) => o.id === page.split("/")[1])}
              user={user}
              busy={busy}
              go={go}
              notify={notify}
              onRefresh={refresh}
              act={(action) =>
                work(async () => {
                  await api(
                    "/operations/" + page.split("/")[1] + "/" + action,
                    "POST",
                    {},
                  );
                  notify(
                    action === "reconcile"
                      ? "Reconciliation recorded. Inspect the evidence timeline."
                      : action === "approve"
                        ? "Exact intent approved. Dispatch is a separate action."
                        : "Operation record updated.",
                  );
                })
              }
            />
          ) : page === "approvals" ? (
            <>
              <div className="page-heading">
                <div>
                  <p className="page-eyebrow">WORKSPACE / APPROVALS</p>
                  <h1>Review before the write.</h1>
                  <p className="page-lede">
                    Open each intent and inspect its exact destination and
                    payload.
                  </p>
                </div>
              </div>
              <OperationsApproval
                operations={operations.filter((o) => o.status === "pending")}
                go={go}
              />
            </>
          ) : page === "audit" ? (
            <Audit events={events} go={go} />
          ) : page === "connections" ? (
            <Connections
              connection={connection}
              user={user}
              refresh={refresh}
              notify={notify}
            />
          ) : page === "keys" ? (
            <Keys user={user} notify={notify} />
          ) : page === "team" ? (
            <Team
              user={user}
              workspace={session?.workspace || { name }}
              refresh={refresh}
              notify={notify}
            />
          ) : (
            <div className="empty-state">
              <h1>Page not found.</h1>
              <a className="button dark" href="#/overview">
                Back to overview
              </a>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>ActionProof · execution evidence, not assumptions.</span>
          <span>
            {__SANDBOX__
              ? "Simulated environment"
              : "Single-workspace installation"}{" "}
            · v0.1.0
          </span>
        </footer>
      </div>
      {toast && <Toast text={toast} close={() => setToast("")} />}
    </div>
  );
}
function OperationsApproval({ operations, go }) {
  return operations.length ? (
    <div className="approval-grid">
      {operations.map((o) => (
        <button
          className="panel approval-card"
          key={o.id}
          onClick={() => go("operations/" + o.id)}
        >
          <span className="eyebrow">
            {o.payload.connector.toUpperCase()} / CREATE ISSUE
          </span>
          <h2>{o.payload.title}</h2>
          <p>{o.payload.repo}</p>
          <span className="text-link">
            Inspect exact payload <Icon name="arrow" size={16} />
          </span>
        </button>
      ))}
    </div>
  ) : (
    <div className="panel empty-state">
      <Icon name="shield" size={30} />
      <h3>Nothing waiting for approval.</h3>
      <p>New intents appear here before they can be dispatched.</p>
      <button className="button subtle" onClick={() => go("new")}>
        Propose an operation
      </button>
    </div>
  );
}
function Toast({ text, close }) {
  return (
    <div className="toast" role="status">
      <Icon name="activity" size={17} />
      <span>{text}</span>
      <button
        className="icon-button"
        aria-label="Dismiss message"
        onClick={close}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="app-loading">
        <h1>Something interrupted this view.</h1>
        <p>
          Your service-side operation records remain independent of this page.
          Refresh to read their latest state.
        </p>
        <button className="button dark" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>,
);
