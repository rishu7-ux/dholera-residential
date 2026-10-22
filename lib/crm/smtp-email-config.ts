export type SMTPEnvironment = Record<string, string | undefined>;

export type PayloadSMTPConfiguration = {
  defaultFromAddress: string;
  defaultFromName: string;
  transportOptions: {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    logger: false;
    debug: false;
    tls: { minVersion: "TLSv1.2"; rejectUnauthorized: true };
    auth?: { user: string; pass: string };
  };
};

/**
 * Returns no adapter configuration until the owner supplies a complete SMTP
 * setup. It deliberately has no Ethereal/dev fallback and cannot disable
 * certificate verification or STARTTLS on non-implicit-TLS connections.
 */
export function getPayloadSMTPConfiguration(
  env: SMTPEnvironment,
): PayloadSMTPConfiguration | undefined {
  const host = env.SMTP_HOST?.trim();
  const portText = env.SMTP_PORT?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const fromAddress = env.PAYLOAD_EMAIL_FROM_ADDRESS?.trim();
  const fromName = env.PAYLOAD_EMAIL_FROM_NAME?.trim();
  const configured = [host, portText, user, pass, fromAddress, fromName].some(Boolean);

  if (env.SMTP_TLS_REJECT_UNAUTHORIZED?.toLowerCase() === "false") {
    throw new Error("SMTP_TLS_REJECT_UNAUTHORIZED cannot be disabled.");
  }
  if (env.SMTP_TLS_REJECT_UNAUTHORIZED && env.SMTP_TLS_REJECT_UNAUTHORIZED.toLowerCase() !== "true") {
    throw new Error("SMTP_TLS_REJECT_UNAUTHORIZED must be true when set.");
  }
  if (!configured) return undefined;
  if (!host || !portText || !fromAddress || !fromName) {
    throw new Error("SMTP setup is incomplete; provide host, port, sender name, and sender address.");
  }
  if (!/^[a-z0-9.-]+$/i.test(host) || host.startsWith(".") || host.endsWith(".")) {
    throw new Error("SMTP_HOST must be a hostname, not a URL or value with whitespace.");
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromAddress) || /[\r\n]/.test(fromName)) {
    throw new Error("Payload email sender name/address is invalid.");
  }
  if ((user && !pass) || (!user && pass)) {
    throw new Error("SMTP authentication requires both SMTP_USER and SMTP_PASS, or neither.");
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  // Port 465 uses implicit TLS; all other ports must negotiate STARTTLS.
  const secure = port === 465;
  return {
    defaultFromAddress: fromAddress,
    defaultFromName: fromName,
    transportOptions: {
      host,
      port,
      secure,
      requireTLS: !secure,
      logger: false,
      debug: false,
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      ...(user && pass ? { auth: { user, pass } } : {}),
    },
  };
}
