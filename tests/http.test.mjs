import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";
import { openStore } from "../server/store.mjs";
import { githubProvider } from "../server/providers.mjs";
const admin = {
  name: "Test owner",
  email: "owner@example.test",
  password: "test-password-long-enough",
  workspace: "Test workspace",
  bootstrapToken: "test-bootstrap-only",
};
export async function appFixture(t, options = {}) {
  const origin = "http://127.0.0.1:4310",
    app = createApp({
      db: openStore(":memory:"),
      secret: "synthetic-secret-with-more-than-32-characters",
      bootstrapToken: admin.bootstrapToken,
      origin,
      ...options,
    });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const base = "http://127.0.0.1:" + app.server.address().port;
  t.after(() => app.close());
  async function request(path, method = "GET", body, credentials = {}) {
    const headers = { "Content-Type": "application/json", ...credentials };
    if (method !== "GET" && !Object.hasOwn(credentials, "Origin"))
      headers.Origin = origin;
    const response = await fetch(base + "/api" + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  return { app, request, base };
}
test("authentication, CSRF, roles, invitations, scoped keys and revocation are enforced", async (t) => {
  const { request } = await appFixture(t);
  assert.equal((await request("/operations")).status, 401);
  assert.equal(
    (await request("/setup", "POST", { ...admin, bootstrapToken: "wrong" }))
      .status,
    403,
  );
  const setup = await request("/setup", "POST", admin);
  assert.equal(setup.status, 200);
  const auth = { Cookie: setup.cookie };
  assert.equal((await request("/setup", "POST", admin)).status, 409);
  assert.equal(
    (
      await request(
        "/operations",
        "POST",
        {},
        { ...auth, Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  const invite = await request(
    "/invites",
    "POST",
    { email: "viewer@example.test", role: "viewer" },
    auth,
  );
  const inviteToken = invite.body.url.split("token=")[1];
  const joined = await request("/join", "POST", {
    name: "Viewer",
    email: "viewer@example.test",
    password: "another-test-password-long",
    inviteToken,
  });
  assert.equal(joined.status, 200);
  assert.equal(
    (await request("/operations", "POST", {}, { Cookie: joined.cookie }))
      .status,
    403,
  );
  assert.equal(
    (await request("/keys", "GET", null, { Cookie: joined.cookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/join", "POST", {
        name: "Viewer",
        email: "viewer@example.test",
        password: "another-test-password-long",
        inviteToken,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/team/" + joined.body.user.id, "DELETE", null, auth))
      .status,
    200,
  );
  assert.equal(
    (await request("/me", "GET", null, { Cookie: joined.cookie })).status,
    401,
  );
  const created = await request(
    "/keys",
    "POST",
    { name: "Read-only agent", scopes: ["operations:read"] },
    auth,
  );
  assert.equal(created.status, 201);
  const bearer = { Authorization: "Bearer " + created.body.token };
  assert.equal((await request("/operations", "GET", null, bearer)).status, 200);
  assert.equal((await request("/operations", "POST", {}, bearer)).status, 403);
  const listed = await request("/keys", "GET", null, auth);
  assert.ok(!JSON.stringify(listed.body).includes(created.body.token));
  await request("/keys/" + created.body.id, "DELETE", null, auth);
  assert.equal((await request("/operations", "GET", null, bearer)).status, 401);
  await request("/logout", "POST", {}, auth);
  assert.equal((await request("/me", "GET", null, auth)).status, 401);
  assert.equal(
    (await request("/login", "POST", { email: admin.email, password: "wrong" }))
      .status,
    401,
  );
  assert.equal((await request("/login", "POST", admin)).status, 200);
});
test("GitHub HTTP connector creates a real test-provider record and reconciles a lost receipt", async (t) => {
  const issues = [];
  let posts = 0;
  const provider = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    assert.equal(req.headers.authorization, "Bearer synthetic-token");
    if (req.method === "POST") {
      let raw = "";
      for await (const x of req) raw += x;
      const input = JSON.parse(raw);
      const issue = {
        number: ++posts,
        html_url: "https://github.com/test/repo/issues/" + posts,
        ...input,
      };
      issues.push(issue);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Synthetic lost response after commit" }),
      );
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        u.pathname === "/repos/test/repo"
          ? { full_name: "test/repo", has_issues: true }
          : issues,
      ),
    );
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  t.after(() => new Promise((r) => provider.close(r)));
  const { request } = await appFixture(t, {
    providerFactory: (options) =>
      githubProvider({
        ...options,
        base: "http://127.0.0.1:" + provider.address().port,
      }),
  });
  const setup = await request("/setup", "POST", admin),
    auth = { Cookie: setup.cookie };
  assert.equal(
    (
      await request(
        "/connectors/github",
        "POST",
        { repo: "test/repo", token: "synthetic-token" },
        auth,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/connectors/github/check", "POST", {}, auth)).body.readable,
    true,
  );
  const input = {
      connector: "github",
      repo: "test/repo",
      title: "Synthetic integration test",
      body: "No real GitHub call is made.",
      idempotencyKey: "integration-issue-001",
    },
    proposed = await request("/operations", "POST", input, auth),
    id = proposed.body.operation.id;
  const key = await request(
      "/keys",
      "POST",
      {
        name: "Agent",
        scopes: ["operations:read", "operations:write", "operations:execute"],
      },
      auth,
    ),
    machine = { Authorization: "Bearer " + key.body.token };
  assert.equal(
    (await request("/operations/" + id + "/approve", "POST", {}, machine))
      .status,
    403,
  );
  await request("/operations/" + id + "/approve", "POST", {}, auth);
  const executed = await request(
    "/operations/" + id + "/execute",
    "POST",
    {},
    machine,
  );
  assert.equal(executed.body.operation.status, "unknown");
  assert.equal(posts, 1);
  assert.equal(
    (await request("/operations/" + id + "/execute", "POST", {}, machine))
      .status,
    409,
  );
  const reconciled = await request(
    "/operations/" + id + "/reconcile",
    "POST",
    {},
    machine,
  );
  assert.equal(reconciled.body.operation.status, "verified");
  assert.equal(reconciled.body.operation.provider.id, "1");
  assert.equal(posts, 1);
  assert.ok(issues[0].body.includes("actionproof:" + id));
  const receipt = await request(
    "/operations/" + id + "/receipt",
    "GET",
    null,
    machine,
  );
  assert.equal(receipt.body.operation.status, "verified");
  assert.ok(receipt.body.events.some((x) => x.type === "reconciled"));
});
