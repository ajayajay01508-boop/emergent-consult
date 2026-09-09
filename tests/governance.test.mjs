import test from "node:test";
import assert from "node:assert/strict";
import { appendAuditEvent, applyDecision, canDecide, nextPendingGate, verifyAuditChain } from "../src/governance.mjs";

const request = {
  id: "DEC-1042",
  status: "In review",
  gates: [
    { id: "finance", label: "Finance review", status: "Pending" },
    { id: "risk", label: "Risk review", status: "Pending" },
  ],
};

test("only reviewer and admin roles can decide", () => {
  assert.equal(canDecide("reviewer"), true);
  assert.equal(canDecide("admin"), true);
  assert.equal(canDecide("requester"), false);
  assert.equal(canDecide("auditor"), false);
});

test("approval advances one gate without skipping the workflow", () => {
  const updated = applyDecision(request, "approve", { name: "Maya", role: "reviewer" });
  assert.equal(updated.gates[0].status, "Approved");
  assert.equal(nextPendingGate(updated).id, "risk");
  assert.equal(updated.status, "In review");
});

test("rejection closes the request immediately", () => {
  const updated = applyDecision(request, "reject", { name: "Maya", role: "reviewer" }, "Missing evidence");
  assert.equal(updated.status, "Rejected");
  assert.equal(updated.gates[0].note, "Missing evidence");
});

test("audit chain detects tampering", async () => {
  let events = [];
  events = await appendAuditEvent(events, { requestId: "DEC-1042", action: "Submitted", actor: "Ajay", role: "requester", at: "2026-09-01T09:00:00.000Z" });
  events = await appendAuditEvent(events, { requestId: "DEC-1042", action: "Approved", actor: "Maya", role: "reviewer", at: "2026-09-01T10:00:00.000Z" });
  assert.equal(await verifyAuditChain(events), true);
  assert.equal(await verifyAuditChain([{ ...events[0], actor: "Changed" }, events[1]]), false);
});
