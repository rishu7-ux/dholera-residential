import assert from "node:assert/strict";
import test from "node:test";

import { createPasswordSetupEmail } from "../../lib/crm/password-setup-email.ts";

test("password setup mail carries a URL-encoded, escaped one-time token only in the body", async () => {
  const token = "synthetic/token&value";
  const { subject, html } = createPasswordSetupEmail({
    adminURL: "https://cms.example.invalid/admin",
    resetPath: "/reset",
    token,
    displayName: "Synthetic <Salesperson>",
  });

  const captured: Array<{ to: string; subject: string; html: string }> = [];
  const fakeTestTransport = {
    async send(message: { to: string; subject: string; html: string }) {
      captured.push(message);
    },
  };

  await fakeTestTransport.send({ to: "sales@example.invalid", subject, html });
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.subject.includes(token), false);
  assert.equal(captured[0]?.html.includes("synthetic%2Ftoken%26value"), true);
  assert.equal(captured[0]?.html.includes("https://cms.example.invalid/admin/reset/synthetic%2Ftoken%26value"), true);
  assert.equal(captured[0]?.html.includes("Synthetic &lt;Salesperson&gt;"), true);
  assert.match(captured[0]?.html ?? "", /expires in 30 minutes and can be used once/);
  assert.equal(JSON.stringify(captured.map(({ subject: capturedSubject, to }) => ({ subject: capturedSubject, to }))).includes(token), false);
});
