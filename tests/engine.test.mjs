import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../server/store.mjs";
import { engine } from "../server/engine.mjs";
const sample = (overrides = {}) => ({
  connector: "sandbox",
  repo: "example/platform",
  title: "Investigate a latency regression",
  body: "Synthetic test context.",
  idempotencyKey: "test-intent-001",
  scenario: "clean",
  ...overrides,
});
function fixture(t, options = {}) {
  const db = openStore(":memory:"),
    e = engine(db, {
      secret: "test-only-32-character-secret-value",
      ...options,
    });
  t.after(() => db.close());
  return { db, e };
}
test("intent creation never performs an external write; same key deduplicates and changed payload conflicts", (t) => {
  const { db, e } = fixture(t),
    a = e.propose(sample(), "test");
  assert.equal(a.status, "pending");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    0,
  );
  assert.equal(e.propose(sample(), "test").id, a.id);
  assert.throws(
    () => e.propose(sample({ title: "Changed" }), "test"),
    /different payload/,
  );
  assert.equal(
    e.get(a.id).events.filter((x) => x.type === "duplicate_suppressed").length,
    1,
  );
});
test("approval is required, bound to the exact payload, and expires", async (t) => {
  let clock = Date.now();
  const { db, e } = fixture(t, { now: () => clock }),
    op = e.propose(sample(), "test");
  await assert.rejects(() => e.execute(op.id, "test"), /approved/);
  e.approve(op.id, "reviewer");
  db.prepare("UPDATE operations SET payload=? WHERE id=?").run(
    JSON.stringify({ ...op.payload, title: "Tampered" }),
    op.id,
  );
  await assert.rejects(() => e.execute(op.id, "test"), /hash/);
  db.prepare("UPDATE operations SET payload=? WHERE id=?").run(
    JSON.stringify(op.payload),
    op.id,
  );
  clock += 31 * 60000;
  await assert.rejects(() => e.execute(op.id, "test"), /expired/);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    0,
  );
});
test("lost response creates one issue, remains unknown, and reconciles without another dispatch", async (t) => {
  const { db, e } = fixture(t),
    op = e.propose(sample({ scenario: "lost_response" }), "agent");
  e.approve(op.id, "human");
  const uncertain = await e.execute(op.id, "agent");
  assert.equal(uncertain.status, "unknown");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    1,
  );
  await assert.rejects(() => e.execute(op.id, "agent"), /reconciled/);
  const result = await e.reconcile(op.id, "human");
  assert.equal(result.status, "verified");
  assert.equal(result.provider.evidence, "Independent sandbox provider record");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    1,
  );
});
test("a rejected action produces no provider effect", async (t) => {
  const { db, e } = fixture(t),
    op = e.propose(sample({ scenario: "fail_before" }), "agent");
  e.approve(op.id, "human");
  assert.equal((await e.execute(op.id, "agent")).status, "failed");
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    0,
  );
});
test("only one caller can claim a dispatch concurrently", async (t) => {
  const { db, e } = fixture(t),
    op = e.propose(sample(), "agent");
  e.approve(op.id, "human");
  const results = await Promise.allSettled([
    e.execute(op.id, "one"),
    e.execute(op.id, "two"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM sandbox_effects").get().n,
    1,
  );
});
test("server restart preserves history and converts interrupted dispatches to unknown", async () => {
  const dir = mkdtempSync(join(tmpdir(), "actionproof-test-")),
    file = join(dir, "state.sqlite");
  let db = openStore(file),
    e = engine(db, { secret: "test-secret" });
  const op = e.propose(sample(), "test");
  e.approve(op.id, "test");
  db.prepare("UPDATE operations SET status='running' WHERE id=?").run(op.id);
  db.close();
  db = openStore(file);
  e = engine(db, { secret: "test-secret" });
  e.recover();
  assert.equal(e.get(op.id).status, "unknown");
  assert.ok(e.get(op.id).events.some((x) => x.type === "restart_recovery"));
  const result = await e.reconcile(op.id, "test");
  assert.equal(result.status, "unknown");
  assert.equal(result.provider, null);
  db.close();
  assert.ok(dir.startsWith(join(tmpdir(), "actionproof-test-")));
  rmSync(dir, { recursive: true, force: true });
});
test("GitHub tokens are encrypted and repository scope is enforced", (t) => {
  const { db, e } = fixture(t);
  e.configure(
    { repo: "example/repo", token: "synthetic-github-token" },
    "admin",
  );
  assert.ok(
    !db
      .prepare("SELECT secret FROM connectors")
      .get()
      .secret.includes("synthetic-github-token"),
  );
  assert.ok(!JSON.stringify(e.connection()).includes("synthetic-github-token"));
  assert.throws(
    () =>
      e.propose(sample({ connector: "github", repo: "other/repo" }), "test"),
    /outside/,
  );
  assert.throws(
    () =>
      e.propose(
        sample({
          connector: "github",
          repo: "example/repo",
          scenario: "lost_response",
        }),
        "test",
      ),
    /sandbox/,
  );
});
test("cancelled operations cannot execute and invalid destinations are rejected", async (t) => {
  const { e } = fixture(t),
    op = e.propose(sample(), "test");
  e.cancel(op.id, "test");
  await assert.rejects(() => e.execute(op.id, "test"), /approved/);
  assert.throws(
    () => e.propose(sample({ repo: "https://localhost/private" }), "test"),
    /owner/,
  );
});
