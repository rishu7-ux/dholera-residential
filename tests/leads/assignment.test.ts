import assert from "node:assert/strict";
import test from "node:test";

import {
  assignLeadRoundRobin,
  orderActiveSalespeople,
  selectRoundRobinSalesperson,
  type LeadAssignment,
} from "../../lib/leads/roundRobin.ts";

const testSalespeople = [
  { id: "sales-1", name: "Test Salesperson 1", active: true, rotationOrder: 1 },
  { id: "sales-2", name: "Test Salesperson 2", active: true, rotationOrder: 2 },
  { id: "sales-3", name: "Test Salesperson 3", active: true, rotationOrder: 3 },
];

test("three active test salespeople rotate in a stable order", () => {
  const selected = Array.from({ length: 7 }, (_, index) =>
    selectRoundRobinSalesperson(testSalespeople, index + 1)?.id,
  );

  assert.deepEqual(selected, [
    "sales-1",
    "sales-2",
    "sales-3",
    "sales-1",
    "sales-2",
    "sales-3",
    "sales-1",
  ]);
});

test("inactive salespeople are excluded without breaking rotation", () => {
  const salespeople = testSalespeople.map((salesperson) =>
    salesperson.id === "sales-2" ? { ...salesperson, active: false } : salesperson,
  );

  assert.equal(selectRoundRobinSalesperson(salespeople, 1)?.id, "sales-1");
  assert.equal(selectRoundRobinSalesperson(salespeople, 2)?.id, "sales-3");
  assert.equal(selectRoundRobinSalesperson(salespeople, 3)?.id, "sales-1");
});

test("rotation order wins over input order and IDs break ties deterministically", () => {
  const ordered = orderActiveSalespeople([
    { id: "z", name: "Z", active: true, rotationOrder: 2 },
    { id: "b", name: "B", active: true, rotationOrder: 1 },
    { id: "a", name: "A", active: true, rotationOrder: 1 },
  ]);

  assert.deepEqual(ordered.map(({ id }) => id), ["a", "b", "z"]);
});

test("an empty active roster leaves the lead unassigned", () => {
  assert.equal(
    selectRoundRobinSalesperson(
      [{ id: "sales-1", name: "Test Salesperson 1", active: false }],
      1,
    ),
    null,
  );
});

test("invalid sequence values are rejected", () => {
  assert.throws(() => selectRoundRobinSalesperson(testSalespeople, 0), RangeError);
  assert.throws(() => selectRoundRobinSalesperson(testSalespeople, 1.5), RangeError);
});

test("the algorithm supports more than 25 CMS-managed salespeople", () => {
  const salespeople = Array.from({ length: 30 }, (_, index) => ({
    id: `sales-${String(index + 1).padStart(2, "0")}`,
    name: `Salesperson ${index + 1}`,
    active: true,
    rotationOrder: index + 1,
  }));

  assert.equal(selectRoundRobinSalesperson(salespeople, 30)?.id, "sales-30");
  assert.equal(selectRoundRobinSalesperson(salespeople, 31)?.id, "sales-01");
  assert.equal(selectRoundRobinSalesperson(salespeople, 56)?.id, "sales-26");
});

test("concurrent duplicate submissions preserve the first assignment claim", async () => {
  let sequence = 0;
  const claims = new Map<string, LeadAssignment>();
  const store = {
    async nextSequence() {
      sequence += 1;
      return sequence;
    },
    async claim(proposed: LeadAssignment) {
      const existing = claims.get(proposed.leadId);
      if (existing) return existing;
      claims.set(proposed.leadId, proposed);
      return proposed;
    },
  };

  const assignments = await Promise.all(
    Array.from({ length: 12 }, () =>
      assignLeadRoundRobin({
        leadId: "same-lead",
        salespeople: testSalespeople,
        store,
        now: () => new Date("2026-10-08T00:00:00.000Z"),
      }),
    ),
  );

  assert.equal(claims.size, 1);
  assert.ok(assignments.every((assignment) => assignment?.salespersonId === "sales-1"));
  assert.ok(assignments.every((assignment) => assignment?.sequence === 1));
});

test("distinct leads remain evenly distributed under concurrent assignment", async () => {
  let sequence = 0;
  const claims = new Map<string, LeadAssignment>();
  const store = {
    async nextSequence() {
      sequence += 1;
      return sequence;
    },
    async claim(proposed: LeadAssignment) {
      claims.set(proposed.leadId, proposed);
      return proposed;
    },
  };

  const assignments = await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      assignLeadRoundRobin({
        leadId: `lead-${index + 1}`,
        salespeople: testSalespeople,
        store,
      }),
    ),
  );
  const totals = new Map<string, number>();
  for (const assignment of assignments) {
    assert.ok(assignment);
    totals.set(
      assignment.salespersonId,
      (totals.get(assignment.salespersonId) || 0) + 1,
    );
  }

  assert.deepEqual(Object.fromEntries(totals), {
    "sales-1": 10,
    "sales-2": 10,
    "sales-3": 10,
  });
});
