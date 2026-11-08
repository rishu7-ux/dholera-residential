import assert from "node:assert/strict";
import test from "node:test";

import { nodemailerAdapter } from "@payloadcms/email-nodemailer";

import { getPayloadSMTPConfiguration } from "../../lib/crm/smtp-email-config.ts";

test("SMTP configuration is absent until the owner configures a sender and host", () => {
  assert.equal(getPayloadSMTPConfiguration({}), undefined);
  assert.throws(() => getPayloadSMTPConfiguration({ SMTP_TLS_REJECT_UNAUTHORIZED: "false" }), /cannot be disabled/);
});

test("SMTP uses verified TLS and requires STARTTLS outside implicit TLS port 465", () => {
  const configuration = getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    SMTP_USER: "synthetic@example.invalid",
    SMTP_PASS: "test-only-password",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  });

  assert.ok(configuration);
  assert.equal(configuration.transportOptions.secure, false);
  assert.equal(configuration.transportOptions.requireTLS, true);
  assert.deepEqual(configuration.transportOptions.tls, {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  });
  assert.equal(configuration.transportOptions.logger, false);
  assert.equal(configuration.transportOptions.debug, false);
});

test("SMTP port 465 selects implicit TLS; insecure TLS settings are rejected", () => {
  const configuration = getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "465",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  });
  assert.equal(configuration?.transportOptions.secure, true);
  assert.equal(configuration?.transportOptions.requireTLS, false);

  assert.throws(() => getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
    SMTP_TLS_REJECT_UNAUTHORIZED: "false",
  }), /cannot be disabled/);
  assert.throws(() => getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    SMTP_USER: "synthetic@example.invalid",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  }), /both SMTP_USER and SMTP_PASS/);
  assert.throws(() => getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp://smtp.example.invalid",
    SMTP_PORT: "587",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  }), /hostname/);
});

test("Payload Nodemailer adapter sends invitation mail only through a fake transport in tests", async () => {
  const configuration = getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  });
  assert.ok(configuration);

  const messages: Array<Record<string, unknown>> = [];
  const fakeTransport = {
    async sendMail(message: Record<string, unknown>) {
      messages.push(message);
      return { messageId: "test-message-only" };
    },
  };
  const adapter = await nodemailerAdapter({
    ...configuration,
    transport: fakeTransport as never,
    skipVerify: true,
  });
  const { sendEmail } = adapter({ payload: {} as never });

  await sendEmail({
    to: "salesperson@example.invalid",
    subject: "Set your CMS password",
    html: "<a href=\"https://cms.example.invalid/reset/synthetic-token\">Set password</a>",
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.to, "salesperson@example.invalid");
  assert.equal(messages[0]?.from, "Synthetic CMS <no-reply@example.invalid>");
  assert.equal(String(messages[0]?.html).includes("synthetic-token"), true);
});
