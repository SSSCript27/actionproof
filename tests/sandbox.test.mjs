import test from "node:test";
import assert from "node:assert/strict";
import { sandboxApi } from "../src/sandbox.js";
import { validRepository } from "../shared/domain.js";
test("public sandbox preserves an uncertain effect, reconciles once, and refuses production credentials", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
  };
  await sandboxApi("/bootstrap");
  const input = {
    connector: "sandbox",
    repo: "example/repo",
    title: "Synthetic recovery test",
    body: "Test data",
    scenario: "lost_response",
    idempotencyKey: "sandbox-intent-001",
  };
  const proposed = await sandboxApi("/operations", "POST", input),
    id = proposed.operation.id;
  await sandboxApi("/operations/" + id + "/approve", "POST");
  const uncertain = await sandboxApi("/operations/" + id + "/execute", "POST");
  assert.equal(uncertain.operation.status, "unknown");
  await assert.rejects(
    () => sandboxApi("/operations/" + id + "/execute", "POST"),
    /reconciled/,
  );
  const reconciled = await sandboxApi(
    "/operations/" + id + "/reconcile",
    "POST",
  );
  assert.equal(reconciled.operation.status, "verified");
  const duplicate = await sandboxApi("/operations", "POST", input);
  assert.equal(duplicate.operation.id, id);
  assert.equal(JSON.parse([...store.values()][0]).effects.length, 1);
  await assert.rejects(
    () => sandboxApi("/connectors/github", "POST", { token: "never-accepted" }),
    /self-hosted/,
  );
  await assert.rejects(
    () =>
      sandboxApi("/operations", "POST", {
        ...input,
        connector: "github",
        scenario: "clean",
        idempotencyKey: "prod-not-allowed",
      }),
    /cannot connect/,
  );
});
test("repository identifiers cannot introduce URL path segments", () => {
  assert.equal(validRepository("example/.github"), true);
  assert.equal(validRepository("example/repo-1"), true);
  for (const value of [
    "../..",
    "example/..",
    "example/.",
    ".owner/repo",
    "example/repo?token=x",
    "https://example/repo",
  ])
    assert.equal(validRepository(value), false);
});
