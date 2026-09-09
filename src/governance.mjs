const DECISION_ROLES = new Set(["reviewer", "admin"]);
const TRANSITIONS = {
  approve: "Approved",
  reject: "Rejected",
  request_changes: "Changes requested",
};

export function canDecide(role) {
  return DECISION_ROLES.has(String(role).toLowerCase());
}

export function nextPendingGate(request) {
  return request.gates.find((gate) => gate.status === "Pending") ?? null;
}

export function applyDecision(request, action, actor, note = "") {
  if (!canDecide(actor.role)) throw new Error("This role cannot make approval decisions.");
  if (!TRANSITIONS[action]) throw new Error("Unsupported decision action.");
  const gate = nextPendingGate(request);
  if (!gate) throw new Error("No pending approval gate remains.");

  const gates = request.gates.map((item) => item.id === gate.id
    ? { ...item, status: TRANSITIONS[action], actor: actor.name, note }
    : item);
  const terminal = action === "reject" || action === "request_changes";
  const hasPending = gates.some((item) => item.status === "Pending");
  return {
    ...request,
    gates,
    status: terminal ? TRANSITIONS[action] : hasPending ? "In review" : "Approved",
    updatedAt: new Date().toISOString(),
  };
}

function canonical(event) {
  return JSON.stringify({
    requestId: event.requestId,
    action: event.action,
    actor: event.actor,
    role: event.role,
    at: event.at,
    note: event.note ?? "",
    previousHash: event.previousHash ?? "GENESIS",
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function appendAuditEvent(events, event) {
  const previousHash = events.at(-1)?.hash ?? "GENESIS";
  const record = { ...event, previousHash };
  return [...events, { ...record, hash: await sha256(canonical(record)) }];
}

export async function verifyAuditChain(events) {
  let previousHash = "GENESIS";
  for (const event of events) {
    if (event.previousHash !== previousHash) return false;
    if (event.hash !== await sha256(canonical(event))) return false;
    previousHash = event.hash;
  }
  return true;
}
