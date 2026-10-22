import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

test("candidate ships without the vulnerable Nodemailer adapter while email is disabled", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const packageJSON = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const payloadConfig = readFileSync(resolve(root, "payload.config.ts"), "utf8");

  assert.equal(packageJSON.dependencies?.["@payloadcms/email-nodemailer"], undefined);
  assert.equal(payloadConfig.includes("@payloadcms/email-nodemailer"), false);
  assert.equal(payloadConfig.includes("nodemailerAdapter"), false);
  assert.match(payloadConfig, /req\.payload\.email\.name === "console"/);
});
