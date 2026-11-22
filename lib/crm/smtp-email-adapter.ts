import { createTransport } from "nodemailer";
import type { EmailAdapter, SendEmailOptions } from "payload";

import { getEnabledSMTPConfiguration, type PayloadSMTPConfiguration, type SMTPEnvironment } from "./smtp-email-config";

type SMTPResult = { accepted?: readonly unknown[]; rejected?: readonly unknown[] };
type SMTPTransport = { sendMail: (message: SendEmailOptions) => Promise<SMTPResult> };
type SMTPTransportFactory = (options: PayloadSMTPConfiguration["transportOptions"]) => SMTPTransport;

export async function sendConfiguredSMTP(
  configuration: PayloadSMTPConfiguration,
  message: SendEmailOptions,
  transportFactory: SMTPTransportFactory = createTransport,
): Promise<void> {
  const result = await transportFactory(configuration.transportOptions).sendMail({
    ...message,
    from: { name: configuration.defaultFromName, address: configuration.defaultFromAddress },
  });
  if (!result.accepted?.length || result.rejected?.length) {
    throw new Error("SMTP server did not accept every recipient.");
  }
}

export function createPayloadSMTPAdapter(
  configuration: PayloadSMTPConfiguration,
  transportFactory: SMTPTransportFactory = createTransport,
): EmailAdapter {
  const transport = transportFactory(configuration.transportOptions);
  return () => ({
    name: "noida-smtp",
    defaultFromAddress: configuration.defaultFromAddress,
    defaultFromName: configuration.defaultFromName,
    sendEmail: async (message) => {
      const result = await transport.sendMail({
        ...message,
        from: { name: configuration.defaultFromName, address: configuration.defaultFromAddress },
      });
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error("SMTP server did not accept every recipient.");
      }
      return result;
    },
  });
}

/** Keep Payload from selecting its console adapter when delivery is disabled. */
export const disabledPayloadEmailAdapter: EmailAdapter = () => ({
  name: "noida-email-disabled",
  defaultFromAddress: "no-reply@example.invalid",
  defaultFromName: "Noida CRM",
  sendEmail: async () => {
    throw new Error("Email delivery is disabled.");
  },
});

export function getConfiguredPayloadEmailAdapter(env: SMTPEnvironment): EmailAdapter {
  const configuration = getEnabledSMTPConfiguration(env);
  return configuration ? createPayloadSMTPAdapter(configuration) : disabledPayloadEmailAdapter;
}
