declare module "nodemailer" {
  import type { SendEmailOptions } from "payload";

  export function createTransport(options: unknown): {
    sendMail(message: SendEmailOptions): Promise<{
      accepted?: readonly unknown[];
      rejected?: readonly unknown[];
    }>;
  };
}
