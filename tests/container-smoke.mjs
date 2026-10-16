import assert from "node:assert/strict";
const origin = process.env.ACTIONPROOF_TEST_URL || "http://localhost:4310";
let cookie;
async function request(path, method = "GET", body) {
  const r = await fetch(origin + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const c = r.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const value = await r.json();
  assert.ok(r.ok, JSON.stringify(value));
  return value;
}
const credentials = {
  name: "Container test owner",
  email: "container@example.test",
  password: "synthetic-container-password-long",
  workspace: "CI test",
  bootstrapToken: "ci-only-bootstrap",
};
if (process.argv[2] === "verify") {
  await request("/login", "POST", credentials);
  const result = await request("/operations");
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].status, "verified");
  assert.equal(
    result.operations[0].provider.evidence,
    "Independent sandbox provider record",
  );
  console.log(
    "PASS container restart preserved account, operation, and evidence",
  );
} else {
  await request("/setup", "POST", credentials);
  const { operation } = await request("/operations", "POST", {
    connector: "sandbox",
    repo: "ci/repo",
    title: "Container recovery test",
    body: "Synthetic context",
    scenario: "lost_response",
    idempotencyKey: "container-test-001",
  });
  await request("/operations/" + operation.id + "/approve", "POST", {});
  assert.equal(
    (await request("/operations/" + operation.id + "/execute", "POST", {}))
      .operation.status,
    "unknown",
  );
  assert.equal(
    (await request("/operations/" + operation.id + "/reconcile", "POST", {}))
      .operation.status,
    "verified",
  );
  console.log(
    "PASS container setup, authentication, approval, dispatch, unknown, reconciliation",
  );
}
