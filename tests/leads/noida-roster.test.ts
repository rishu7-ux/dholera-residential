import assert from "node:assert/strict";
import test from "node:test";

import { validateNoidaStaffRoster, type NoidaStaffRosterRow } from "../../lib/crm/roster.ts";

function roster(): NoidaStaffRosterRow[] {
  return [
    ...Array.from({ length: 10 }, (_, index) => ({
      fullName: `Synthetic Staff ${index + 1}`,
      officialEmail: `sales${index + 1}@example.invalid`,
      role: "salesperson" as const,
      office: "noida" as const,
      assignmentOrder: index + 1,
      active: true,
      existingUserReference: null,
    })),
    {
      fullName: "Synthetic Team Leader",
      officialEmail: "leader@example.invalid",
      role: "team-leader",
      office: "noida",
      assignmentOrder: null,
      active: true,
      existingUserReference: null,
    },
  ];
}

test("accepts the exact ten-salesperson and one-Team-Leader Noida roster shape", () => {
  assert.deepEqual(validateNoidaStaffRoster(roster()), { valid: true, errors: [] });
});

test("rejects duplicate identities, duplicate order, and a missing assignment position", () => {
  const rows = roster();
  rows[1]!.officialEmail = rows[0]!.officialEmail;
  rows[1]!.assignmentOrder = 1;
  assert.equal(validateNoidaStaffRoster(rows).valid, false);
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("email is duplicated")));
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("order is duplicated")));
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("order 2 is missing")));
});

test("rejects wrong roster counts and non-Noida office assignments", () => {
  const rows = roster();
  rows.pop();
  rows[0]!.office = "noida";
  rows[0]!.fullName = "";
  rows[1]!.office = "Ahmedabad" as "noida";
  assert.equal(validateNoidaStaffRoster(rows).valid, false);
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("exactly 1 Team Leader")));
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("full name is required")));
  assert.ok(validateNoidaStaffRoster(rows).errors.some((error) => error.includes("office must be noida")));
});
