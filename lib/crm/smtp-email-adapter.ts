import { createTransport } from "nodemailer";
import type { EmailAdapter, SendEmailOptions } from "payload";

import { getEnabledSMTPConfiguration, type PayloadSMTPConfiguration, type SMTPEnvironment } from "./smtp-email-config";

type SMTPResult = { accepted?: readonly unknown[]; rejected?: readonly unknown[] };
type SMTPTransport = { sendMail: (message: SendEmailOptions) => Promise<SMTPResult> };
type SMTPTransportFactory = (options: PayloadSMTPConfiguration["transportOptions"]) => SMTPTransport;

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

export function getConfiguredPayloadEmailAdapter(env: SMTPEnvironment): EmailAdapter | undefined {
  const configuration = getEnabledSMTPConfiguration(env);
  return configuration ? createPayloadSMTPAdapter(configuration) : undefined;
}
