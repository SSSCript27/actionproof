import { intent, payloadOf, receiptText } from "../shared/domain.js";
const KEY = "actionproof_public_sandbox_v1";
const timestamp = () => new Date().toISOString();
const user = {
  id: "sandbox-user",
  name: "Demo operator",
  email: "operator@example.test",
  role: "admin",
};
const fresh = () => ({
  operations: [],
  effects: [],
  events: [],
  workspace: { name: "Northstar / sandbox" },
});
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || fresh();
  } catch {
    return fresh();
  }
}
function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new Error(
      "Sandbox storage is unavailable or full. Enable browser storage or reset the sandbox.",
    );
  }
}
function event(s, op, type, detail) {
  const e = {
    seq: s.events.length + 1,
    operationId: op?.id || null,
    at: timestamp(),
    type,
    actor: user.email,
    detail,
  };
  s.events.push(e);
  if (op) {
    op.events.push(e);
    op.updatedAt = e.at;
  }
}
function get(s, id) {
  const op = s.operations.find((x) => x.id === id);
  if (!op) throw new Error("Operation not found.");
  return op;
}
const hash = async (text) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function sandboxApi(path, method = "GET", input = {}) {
  let s = read();
  if (path === "/bootstrap") {
    for (const op of s.operations)
      if (op.status === "running") {
        op.status = "unknown";
        event(
          s,
          op,
          "restart_recovery",
          "Browser session interrupted during simulated execution. Outcome requires reconciliation.",
        );
      }
    save(s);
    return { needsSetup: false };
  }
  if (path === "/me") return { user, workspace: s.workspace };
  if (path === "/logout") return { ok: true };
  if (path === "/reset" && method === "POST") {
    save(fresh());
    return { ok: true };
  }
  if (path === "/operations" && method === "GET")
    return { operations: s.operations.slice().reverse() };
  if (path === "/operations" && method === "POST") {
    const v = intent(input);
    if (v.connector !== "sandbox")
      throw new Error(
        "The public sandbox cannot connect to real services. Install the self-hosted app to use GitHub.",
      );
    const payload = payloadOf(v),
      payloadHash = await hash(JSON.stringify(payload));
    s = read();
    const previous = s.operations.find(
      (x) => x.idempotencyKey === v.idempotencyKey,
    );
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new Error(
          "This idempotency key already belongs to another payload.",
        );
      event(
        s,
        previous,
        "duplicate_suppressed",
        "Returned existing intent. No extra action dispatched.",
      );
      save(s);
      return { operation: previous };
    }
    if (s.operations.length >= 200)
      throw new Error(
        "The sandbox has reached its local history limit. Export any receipts you need, then reset it.",
      );
    const op = {
      id: crypto.randomUUID(),
      idempotencyKey: v.idempotencyKey,
      payload,
      payloadHash,
      status: "pending",
      createdAt: timestamp(),
      updatedAt: timestamp(),
      actor: user.email,
      approvedAt: null,
      approvalExpiresAt: null,
      provider: null,
      events: [],
    };
    s.operations.push(op);
    event(s, op, "proposed", "Intent recorded. Provider untouched.");
    save(s);
    return { operation: op };
  }
  const m = path.match(
    /^\/operations\/([a-zA-Z0-9-]+)(?:\/(approve|execute|reconcile|cancel|receipt))?$/,
  );
  if (m) {
    const op = get(s, m[1]),
      action = m[2];
    if (method === "GET")
      return action === "receipt"
        ? JSON.parse(receiptText(op))
        : { operation: op };
    if (action === "approve") {
      if (op.status !== "pending")
        throw new Error("Only pending operations can be approved.");
      op.status = "approved";
      op.approvedAt = timestamp();
      op.approvalExpiresAt = new Date(Date.now() + 1800000).toISOString();
      op.approvedHash = op.payloadHash;
      event(
        s,
        op,
        "approved",
        "Approval bound to the immutable payload for 30 minutes.",
      );
    } else if (action === "cancel") {
      if (!["pending", "approved"].includes(op.status))
        throw new Error("A dispatched action cannot be cancelled.");
      op.status = "cancelled";
      event(s, op, "cancelled", "Cancelled before dispatch.");
    } else if (action === "execute") {
      if (op.status !== "approved")
        throw new Error(
          "An approved action is required. Unknown outcomes must be reconciled.",
        );
      if (Date.parse(op.approvalExpiresAt) < Date.now())
        throw new Error("Approval expired. Submit a fresh intent.");
      if (op.approvedHash !== op.payloadHash)
        throw new Error("Approved hash mismatch.");
      op.status = "running";
      event(
        s,
        op,
        "dispatched",
        "Dispatch recorded before provider execution.",
      );
      save(s);
      await new Promise((r) => setTimeout(r, 650));
      s = read();
      const current = get(s, op.id);
      if (current.payload.scenario === "fail_before") {
        current.status = "failed";
        event(
          s,
          current,
          "rejected",
          "Simulated rejection before any provider write.",
        );
      } else {
        let effect = s.effects.find((e) => e.operationId === current.id);
        if (!effect) {
          effect = {
            id: "DEMO-" + String(s.effects.length + 101),
            operationId: current.id,
            repo: current.payload.repo,
            title: current.payload.title,
            createdAt: timestamp(),
          };
          s.effects.push(effect);
        }
        if (current.payload.scenario === "lost_response") {
          current.status = "unknown";
          event(
            s,
            current,
            "outcome_unknown",
            "Simulated response loss after issue creation. Do not retry.",
          );
        } else {
          current.status = "verified";
          current.provider = {
            id: effect.id,
            repo: effect.repo,
            evidence: "Simulated provider receipt",
            verifiedAt: timestamp(),
          };
          event(
            s,
            current,
            "verified",
            "Simulated issue creation returned a receipt.",
          );
        }
      }
      save(s);
      return { operation: current };
    } else if (action === "reconcile") {
      if (!["unknown", "verified"].includes(op.status))
        throw new Error(
          "Only unknown or verified operations can be reconciled.",
        );
      const effect = s.effects.find((e) => e.operationId === op.id);
      if (effect) {
        op.status = "verified";
        op.provider = {
          id: effect.id,
          repo: effect.repo,
          evidence: "Independent simulated provider record",
          verifiedAt: timestamp(),
        };
        event(
          s,
          op,
          "reconciled",
          "Existing record found. No new issue was created.",
        );
      } else
        event(
          s,
          op,
          "unresolved",
          "No matching record found. Outcome remains unknown.",
        );
    } else throw new Error("Unsupported sandbox action.");
    save(s);
    return { operation: op };
  }
  if (path === "/audit") return { events: s.events.slice().reverse() };
  if (path === "/connectors" && method === "GET")
    return { github: { id: "github", configured: false } };
  if (path === "/keys" && method === "GET") return { keys: [] };
  if (path === "/team" && method === "GET") return { members: [user] };
  if (path === "/workspace" && method === "POST") {
    s.workspace.name = String(input.name || "Sandbox").slice(0, 80);
    save(s);
    return { workspace: s.workspace };
  }
  throw new Error(
    "This feature requires the self-hosted service. Never enter production credentials in the public sandbox.",
  );
}
