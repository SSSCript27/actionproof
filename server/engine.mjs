import {
  createHash,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { intent, payloadOf, fail, validRepository } from "../shared/domain.js";
import { githubProvider, Uncertain, Rejected } from "./providers.mjs";
export const digest = (v) => createHash("sha256").update(v).digest("hex");
export function engine(
  db,
  { secret, providerFactory = githubProvider, now = () => Date.now() } = {},
) {
  const key = createHash("sha256")
    .update(secret || "test-only")
    .digest();
  const stamp = () => new Date(now()).toISOString();
  function encrypt(value) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", key, iv);
    return Buffer.concat([
      iv,
      Buffer.from(c.update(value, "utf8")),
      c.final(),
      c.getAuthTag(),
    ]).toString("base64");
  }
  function decrypt(value) {
    const b = Buffer.from(value, "base64"),
      d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(-16));
    return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString(
      "utf8",
    );
  }
  function event(id, type, actor, detail) {
    db.prepare(
      "INSERT INTO events(op_id,at,type,actor,detail) VALUES(?,?,?,?,?)",
    ).run(id, stamp(), type, actor, detail);
  }
  function get(id) {
    const r = db.prepare("SELECT * FROM operations WHERE id=?").get(id);
    if (!r) fail(404, "Operation not found.");
    return {
      id: r.id,
      idempotencyKey: r.idem_key,
      payload: JSON.parse(r.payload),
      payloadHash: r.payload_hash,
      status: r.status,
      createdAt: r.created,
      updatedAt: r.updated,
      actor: r.actor,
      approvedAt: r.approved_at,
      approvedHash: r.approved_hash,
      approvalExpiresAt: r.approval_expires
        ? new Date(r.approval_expires).toISOString()
        : null,
      provider: r.provider ? JSON.parse(r.provider) : null,
      events: db
        .prepare(
          "SELECT seq,at,type,actor,detail FROM events WHERE op_id=? ORDER BY seq",
        )
        .all(id),
    };
  }
  function list() {
    return db
      .prepare("SELECT id FROM operations ORDER BY created DESC LIMIT 500")
      .all()
      .map((r) => get(r.id));
  }
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      db.exec("COMMIT");
      return r;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function propose(input, actor) {
    const v = intent(input),
      payload = payloadOf(v),
      hash = digest(JSON.stringify(payload));
    return transaction(() => {
      const prior = db
        .prepare("SELECT id,payload_hash FROM operations WHERE idem_key=?")
        .get(v.idempotencyKey);
      if (prior) {
        if (prior.payload_hash !== hash)
          fail(
            409,
            "This idempotency key already belongs to a different payload. Use a new key for a new intent.",
          );
        event(
          prior.id,
          "duplicate_suppressed",
          actor,
          "Same intent returned without dispatching another action.",
        );
        return get(prior.id);
      }
      if (v.connector === "github") {
        const c = connection();
        if (!c.configured) fail(409, "Configure a GitHub connector first.");
        if (c.repo !== v.repo)
          fail(
            403,
            "This repository is outside the configured connector scope.",
          );
      }
      const id = randomUUID();
      db.prepare(
        "INSERT INTO operations(id,idem_key,payload,payload_hash,status,created,updated,actor) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        id,
        v.idempotencyKey,
        JSON.stringify(payload),
        hash,
        "pending",
        stamp(),
        stamp(),
        actor,
      );
      event(
        id,
        "proposed",
        actor,
        "Intent recorded. No external action has been attempted.",
      );
      return get(id);
    });
  }
  function approve(id, actor) {
    return transaction(() => {
      const op = get(id);
      if (op.status !== "pending")
        fail(409, "Only pending operations can be approved.");
      db.prepare(
        "UPDATE operations SET status='approved',approved_at=?,approval_expires=?,approved_hash=payload_hash,updated=? WHERE id=?",
      ).run(stamp(), now() + 30 * 60 * 1000, stamp(), id);
      event(
        id,
        "approved",
        actor,
        "Approval bound to the stored payload hash for 30 minutes.",
      );
      return get(id);
    });
  }
  function cancel(id, actor) {
    return transaction(() => {
      const op = get(id);
      if (!["pending", "approved"].includes(op.status))
        fail(409, "Dispatched or finished operations cannot be cancelled.");
      db.prepare(
        "UPDATE operations SET status='cancelled',updated=? WHERE id=?",
      ).run(stamp(), id);
      event(id, "cancelled", actor, "Intent cancelled before dispatch.");
      return get(id);
    });
  }
  function connection() {
    const r = db
      .prepare("SELECT config,updated FROM connectors WHERE id='github'")
      .get();
    return r
      ? {
          id: "github",
          configured: true,
          ...JSON.parse(r.config),
          updated: r.updated,
        }
      : { id: "github", configured: false };
  }
  function configure(input, actor) {
    if (!validRepository(input.repo)) fail(400, "Use owner/repository.");
    if (
      typeof input.token !== "string" ||
      input.token.length < 10 ||
      input.token.length > 500 ||
      /[\r\n\x00-\x1f]/.test(input.token)
    )
      fail(400, "Provide a GitHub token.");
    db.prepare(
      "INSERT INTO connectors(id,config,secret,updated) VALUES('github',?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,secret=excluded.secret,updated=excluded.updated",
    ).run(JSON.stringify({ repo: input.repo }), encrypt(input.token), stamp());
    event(
      null,
      "connector_configured",
      actor,
      "GitHub repository scope updated. Credential value omitted.",
    );
    return connection();
  }
  function github(op) {
    const row = db.prepare("SELECT * FROM connectors WHERE id='github'").get();
    if (!row) fail(409, "GitHub is not configured.");
    const config = JSON.parse(row.config);
    if (op && op.payload.repo !== config.repo)
      fail(
        409,
        "Connector scope has changed. This operation needs operator review.",
      );
    return providerFactory({ token: decrypt(row.secret), repo: config.repo });
  }
  function provider(op) {
    if (op.payload.connector === "github") return github(op);
    return {
      async execute() {
        if (op.payload.scenario === "fail_before")
          throw new Rejected(
            "Sandbox rejected the operation before creating an issue.",
          );
        let effect = db
          .prepare("SELECT * FROM sandbox_effects WHERE op_id=?")
          .get(op.id);
        if (!effect) {
          effect = {
            id: randomUUID(),
            op_id: op.id,
            repo: op.payload.repo,
            title: op.payload.title,
            created: stamp(),
          };
          db.prepare("INSERT INTO sandbox_effects VALUES(?,?,?,?,?)").run(
            ...Object.values(effect),
          );
        }
        if (op.payload.scenario === "lost_response")
          throw new Uncertain(
            "Simulated response loss after issue creation. The provider outcome is unknown until reconciled.",
          );
        return {
          id: effect.id,
          repo: effect.repo,
          evidence: "Sandbox provider receipt",
          verifiedAt: stamp(),
        };
      },
      async reconcile() {
        const r = db
          .prepare("SELECT * FROM sandbox_effects WHERE op_id=?")
          .get(op.id);
        return r
          ? {
              id: r.id,
              repo: r.repo,
              evidence: "Independent sandbox provider record",
              verifiedAt: stamp(),
            }
          : null;
      },
    };
  }
  async function execute(id, actor) {
    transaction(() => {
      const r = db.prepare("SELECT * FROM operations WHERE id=?").get(id);
      if (!r) fail(404, "Operation not found.");
      if (r.status !== "approved")
        fail(
          409,
          "Execution requires an approved operation. Unknown operations must be reconciled, not retried.",
        );
      if (r.approved_hash !== digest(r.payload))
        fail(409, "Approved payload hash does not match.");
      if (r.approval_expires < now())
        fail(
          409,
          "Approval expired. Cancel this intent and submit a fresh one.",
        );
      db.prepare(
        "UPDATE operations SET status='running',updated=? WHERE id=? AND status='approved'",
      ).run(stamp(), id);
      event(
        id,
        "dispatched",
        actor,
        "Dispatch claimed durably. Further execution requests are rejected.",
      );
    });
    try {
      const op = get(id),
        receipt = await provider(op).execute(op);
      db.prepare(
        "UPDATE operations SET status='verified',provider=?,updated=? WHERE id=? AND status='running'",
      ).run(JSON.stringify(receipt), stamp(), id);
      event(
        id,
        "verified",
        actor,
        "Provider returned a concrete creation receipt.",
      );
    } catch (e) {
      const rejected = e instanceof Rejected;
      db.prepare(
        "UPDATE operations SET status=?,updated=? WHERE id=? AND status='running'",
      ).run(rejected ? "failed" : "unknown", stamp(), id);
      event(
        id,
        rejected ? "rejected" : "outcome_unknown",
        actor,
        e.message || "Execution outcome is unknown.",
      );
    }
    return get(id);
  }
  async function reconcile(id, actor) {
    const op = get(id);
    if (!["unknown", "verified"].includes(op.status))
      fail(409, "Only uncertain or verified operations can be reconciled.");
    try {
      const proof = await provider(op).reconcile(op);
      if (proof) {
        db.prepare(
          "UPDATE operations SET status='verified',provider=?,updated=? WHERE id=?",
        ).run(JSON.stringify(proof), stamp(), id);
        event(
          id,
          "reconciled",
          actor,
          "Matching provider record found. No new write was performed.",
        );
      } else {
        event(
          id,
          "unresolved",
          actor,
          "No matching record was found in the bounded lookup. Absence is not proof of failure. No retry was dispatched.",
        );
      }
    } catch (e) {
      event(
        id,
        "verification_unavailable",
        actor,
        e.message || "Verification unavailable.",
      );
    }
    return get(id);
  }
  function recover() {
    for (const r of db
      .prepare("SELECT id FROM operations WHERE status='running'")
      .all()) {
      db.prepare(
        "UPDATE operations SET status='unknown',updated=? WHERE id=?",
      ).run(stamp(), r.id);
      event(
        r.id,
        "restart_recovery",
        "system",
        "Process restarted during dispatch. Outcome marked unknown; automatic retry suppressed.",
      );
    }
  }
  function audit() {
    return db
      .prepare(
        "SELECT seq,op_id AS operationId,at,type,actor,detail FROM events ORDER BY seq DESC LIMIT 1000",
      )
      .all();
  }
  return {
    get,
    list,
    propose,
    approve,
    cancel,
    execute,
    reconcile,
    recover,
    audit,
    connection,
    configure,
    checkConnection: () => github().check(),
    event,
  };
}
