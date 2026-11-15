import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getEnabledSMTPConfiguration, getPayloadSMTPConfiguration } from "../../lib/crm/smtp-email-config.ts";
import { createPayloadSMTPAdapter, getConfiguredPayloadEmailAdapter } from "../../lib/crm/smtp-email-adapter.ts";

test("disabled SMTP rejects delivery without selecting Payload's console adapter", async () => {
  const email = getConfiguredPayloadEmailAdapter({ NOIDA_SMTP_DELIVERY_ENABLED: "0" })({ payload: {} as never });
  assert.equal(email.name, "noida-email-disabled");
  await assert.rejects(
    email.sendEmail({ to: "staff@example.invalid", subject: "Private reset", html: "<p>Secret token</p>" }),
    /^Error: Email delivery is disabled\.$/,
  );
  assert.equal(getConfiguredPayloadEmailAdapter({})({ payload: {} as never }).name, "noida-email-disabled");
});

test("SMTP configuration is absent until the owner configures a sender and host", () => {
  assert.equal(getPayloadSMTPConfiguration({}), undefined);
  assert.equal(getEnabledSMTPConfiguration({}), undefined);
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
  assert.equal(configuration.transportOptions.disableFileAccess, true);
  assert.equal(configuration.transportOptions.disableUrlAccess, true);
  assert.equal(configuration.transportOptions.maxRecipients, 1);
  assert.equal(configuration.transportOptions.connectionTimeout, 30000);
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

test("SMTP delivery requires an explicit enable flag and complete TLS configuration", () => {
  const env = {
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    SMTP_USER: "synthetic@example.invalid",
    SMTP_PASS: "test-only-password",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  };
  assert.equal(getEnabledSMTPConfiguration(env), undefined);
  assert.equal(getEnabledSMTPConfiguration({ ...env, NOIDA_SMTP_DELIVERY_ENABLED: "0" }), undefined);
  assert.ok(getEnabledSMTPConfiguration({ ...env, NOIDA_SMTP_DELIVERY_ENABLED: "1" }));
  assert.throws(() => getEnabledSMTPConfiguration({ NOIDA_SMTP_DELIVERY_ENABLED: "1" }), /complete SMTP/);
  assert.throws(() => getEnabledSMTPConfiguration({ ...env, NOIDA_SMTP_DELIVERY_ENABLED: "yes" }), /must be 0 or 1/);
  assert.throws(() => getEnabledSMTPConfiguration({ ...env, NOIDA_SMTP_DELIVERY_ENABLED: "1", NODE_TLS_REJECT_UNAUTHORIZED: "0" }), /certificate verification/);
  assert.equal(getEnabledSMTPConfiguration({ SMTP_HOST: "smtp.example.invalid" }), undefined);
  assert.throws(() => getEnabledSMTPConfiguration({ SMTP_HOST: "smtp.example.invalid", NOIDA_SMTP_DELIVERY_ENABLED: "1" }), /incomplete/);
});

test("SMTP adapter accepts only complete delivery and never exposes the credential", async () => {
  const configuration = getPayloadSMTPConfiguration({
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "587",
    SMTP_USER: "synthetic@example.invalid",
    SMTP_PASS: "test-only-password",
    PAYLOAD_EMAIL_FROM_ADDRESS: "no-reply@example.invalid",
    PAYLOAD_EMAIL_FROM_NAME: "Synthetic CMS",
  });
  assert.ok(configuration);
  const captured: unknown[] = [];
  let accepted: unknown[] = ["staff@example.invalid"];
  let rejected: unknown[] = [];
  const adapter = createPayloadSMTPAdapter(configuration, (options) => {
    assert.equal(options.requireTLS, true);
    return { sendMail: async (message) => {
      captured.push(message);
      return { accepted, rejected };
    } };
  });
  const email = adapter({ payload: {} as never });
  assert.equal(email.name, "noida-smtp");
  await email.sendEmail({ to: "staff@example.invalid", subject: "Set password", html: "<p>Test</p>" });
  assert.deepEqual((captured[0] as { from: unknown }).from, { name: "Synthetic CMS", address: "no-reply@example.invalid" });
  assert.equal(JSON.stringify(captured).includes("test-only-password"), false);
  accepted = [];
  await assert.rejects(email.sendEmail({ to: "staff@example.invalid", subject: "Set password", html: "<p>Test</p>" }), /did not accept/);
  accepted = ["staff@example.invalid"];
  rejected = ["other@example.invalid"];
  await assert.rejects(email.sendEmail({ to: "staff@example.invalid", subject: "Set password", html: "<p>Test</p>" }), /did not accept/);
});

test("candidate avoids the removed Payload Nodemailer adapter and keeps the invitation gate", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const packageJSON = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const payloadConfig = readFileSync(resolve(root, "payload.config.ts"), "utf8");

  assert.equal(packageJSON.dependencies?.["@payloadcms/email-nodemailer"], undefined);
  assert.equal(payloadConfig.includes("@payloadcms/email-nodemailer"), false);
  assert.equal(payloadConfig.includes("nodemailerAdapter"), false);
  assert.match(payloadConfig, /getConfiguredPayloadEmailAdapter\(process\.env\)/);
  const invitationHandler = readFileSync(resolve(root, "lib/crm/staff-invitation.ts"), "utf8");
  assert.match(invitationHandler, /req\.payload\.email\.name !== "noida-smtp"/);
});
