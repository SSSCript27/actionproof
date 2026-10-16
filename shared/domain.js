export const STATUS = {
  pending: "Awaiting approval",
  approved: "Approved",
  running: "Executing",
  unknown: "Needs reconciliation",
  verified: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
};
export const SCENARIOS = {
  clean: "Normal delivery",
  lost_response: "Response lost after creation",
  fail_before: "Failure before dispatch",
};
export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export function validRepository(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value) &&
    ![".", ".."].includes(value.split("/")[1])
  );
}
export function intent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail(400, "Provide an operation object.");
  const connector = input.connector;
  if (!["sandbox", "github"].includes(connector))
    fail(400, "Choose sandbox or GitHub.");
  const repo = String(input.repo || "").trim();
  if (!validRepository(repo)) fail(400, "Use an owner/repository identifier.");
  const title = String(input.title || "").trim(),
    body = String(input.body || "");
  if (!title || title.length > 200)
    fail(400, "Title must contain 1–200 characters.");
  if (body.length > 20000) fail(400, "Body is limited to 20,000 characters.");
  const scenario = input.scenario || "clean";
  if (!Object.hasOwn(SCENARIOS, scenario)) fail(400, "Unknown simulation.");
  if (connector === "github" && scenario !== "clean")
    fail(400, "Fault scenarios are available only for the sandbox connector.");
  const key = String(input.idempotencyKey || "").trim();
  if (!/^[A-Za-z0-9_.:-]{8,160}$/.test(key))
    fail(
      400,
      "An idempotency key of 8–160 letters, numbers, dots, colons, underscores or hyphens is required.",
    );
  return { connector, repo, title, body, scenario, idempotencyKey: key };
}
export function payloadOf(v) {
  return {
    connector: v.connector,
    repo: v.repo,
    title: v.title,
    body: v.body,
    scenario: v.scenario,
  };
}
export function receiptText(op) {
  return JSON.stringify(
    {
      product: "ActionProof",
      formatVersion: 1,
      operation: {
        id: op.id,
        status: op.status,
        payload: op.payload,
        payloadHash: op.payloadHash,
        idempotencyKey: op.idempotencyKey,
        createdAt: op.createdAt,
        approvedAt: op.approvedAt,
        approvedHash: op.approvedHash,
        approvalExpiresAt: op.approvalExpiresAt,
        provider: op.provider,
      },
      events: op.events,
    },
    null,
    2,
  );
}
