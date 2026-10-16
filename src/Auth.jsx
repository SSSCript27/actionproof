import React, { useState } from "react";
import { api } from "./api.js";
import { Mark, Icon } from "./icons.jsx";
export default function Auth({ needsSetup, joining, onReady }) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      workspace: "My workspace",
      bootstrapToken: params.get("token") || "",
      inviteToken: joining ? params.get("token") || "" : "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const update = (key, value) => setForm((x) => ({ ...x, [key]: value }));
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <a href="#/" className="brand">
          <Mark />
          ActionProof
        </a>
        <div>
          <p className="eyebrow">KNOW WHAT ACTUALLY HAPPENED</p>
          <h1>
            Trust the record.
            <br />
            Verify the outcome.
          </h1>
          <p>
            Your workspace is the durable boundary between an agent’s request
            and a real system change.
          </p>
        </div>
        <span className="mono tiny">
          SELF-HOSTED / YOUR DATA / YOUR CONNECTORS
        </span>
      </div>
      <main className="auth-main">
        <a className="back-link" href="#/">
          ← Back to product
        </a>
        <div className="auth-card">
          <span className="auth-icon">
            <Icon name="shield" size={24} />
          </span>
          <h2>
            {joining
              ? "Join your team."
              : needsSetup
                ? "Set up your workspace."
                : "Welcome back."}
          </h2>
          <p>
            {joining
              ? "Use the email address your invitation was issued to."
              : needsSetup
                ? "Create the first administrator using the bootstrap token generated on your server."
                : "Sign in to review operations and recover outcomes."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              try {
                await api(
                  joining ? "/join" : needsSetup ? "/setup" : "/login",
                  "POST",
                  form,
                );
                await onReady();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {(needsSetup || joining) && (
              <label>
                Your name
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
            )}
            {needsSetup && (
              <>
                <label>
                  Workspace name
                  <input
                    required
                    maxLength={80}
                    value={form.workspace}
                    onChange={(e) => update("workspace", e.target.value)}
                  />
                </label>
                <label>
                  Bootstrap token
                  <input
                    required
                    type="password"
                    autoComplete="off"
                    value={form.bootstrapToken}
                    onChange={(e) => update("bootstrapToken", e.target.value)}
                  />
                  <small>
                    Printed by <code>npm run setup</code>. Stored in the
                    server’s private .env.
                  </small>
                </label>
              </>
            )}
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={12}
                maxLength={200}
                autoComplete={
                  needsSetup || joining ? "new-password" : "current-password"
                }
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <small>At least 12 characters.</small>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button green full" disabled={busy}>
              {busy
                ? "Please wait…"
                : joining
                  ? "Accept invitation"
                  : needsSetup
                    ? "Create administrator"
                    : "Sign in"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="auth-help">
            Lost access? Ask the server administrator to use the local password
            recovery command. <a href="#/docs">Read the guide.</a>
          </p>
        </div>
      </main>
    </div>
  );
}
