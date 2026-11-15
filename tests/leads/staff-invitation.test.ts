import assert from "node:assert/strict";
import test from "node:test";
import type { PayloadRequest } from "payload";

import { handleStaffInvitation } from "../../lib/crm/staff-invitation.ts";

function request(options: {
  actor?: string;
  inviteeRole?: string;
  adapter?: string;
  forgotResult?: string | null;
  forgotError?: Error;
  cleanupError?: Error;
} = {}) {
  const calls = { find: 0, forgot: 0, cleanup: 0 };
  const req = {
    user: options.actor === undefined ? { role: "super-admin" } : { role: options.actor },
    routeParams: { id: "staff-1" },
    payload: {
      email: { name: options.adapter ?? "noida-smtp" },
      findByID: async () => {
        calls.find++;
        return { id: "staff-1", role: options.inviteeRole ?? "salesperson", email: "staff@example.invalid" };
      },
      forgotPassword: async () => {
        calls.forgot++;
        if (options.forgotError) throw options.forgotError;
        return options.forgotResult === undefined ? "private-synthetic-token" : options.forgotResult;
      },
      update: async () => {
        calls.cleanup++;
        if (options.cleanupError) throw options.cleanupError;
      },
    },
  } as unknown as PayloadRequest;
  return { req, calls };
}

test("only a super admin can invite eligible staff", async () => {
  const unauthorized = request({ actor: "team-leader" });
  assert.equal((await handleStaffInvitation(unauthorized.req)).status, 403);
  assert.deepEqual(unauthorized.calls, { find: 0, forgot: 0, cleanup: 0 });

  const wrongRole = request({ inviteeRole: "super-admin" });
  assert.equal((await handleStaffInvitation(wrongRole.req)).status, 404);
  assert.equal(wrongRole.calls.forgot, 0);
});

test("console adapter fails closed without generating a reset token", async () => {
  const state = request({ adapter: "console" });
  const response = await handleStaffInvitation(state.req);
  assert.equal(response.status, 503);
  assert.equal(state.calls.forgot, 0);
  assert.equal(state.calls.cleanup, 0);
});

test("a successful invite returns no token", async () => {
  const state = request();
  const response = await handleStaffInvitation(state.req);
  assert.equal(response.status, 202);
  assert.equal(JSON.stringify(await response.json()).includes("private-synthetic-token"), false);
  assert.deepEqual(state.calls, { find: 1, forgot: 1, cleanup: 0 });
});

test("a null forgot-password result does not claim delivery or revoke another token", async () => {
  const state = request({ forgotResult: null });
  assert.equal((await handleStaffInvitation(state.req)).status, 503);
  assert.deepEqual(state.calls, { find: 1, forgot: 1, cleanup: 0 });
});

test("delivery rejection fails closed and attempts token invalidation", async () => {
  for (const cleanupError of [undefined, new Error("cleanup unavailable")]) {
    const state = request({ forgotError: new Error("SMTP rejected private-synthetic-token"), cleanupError });
    const response = await handleStaffInvitation(state.req);
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes("private-synthetic-token"), false);
    assert.deepEqual(state.calls, { find: 1, forgot: 1, cleanup: 1 });
  }
});
