export type PasswordSetupEmailInput = {
  adminURL: string;
  resetPath: string;
  token: string;
  displayName: string;
};

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createPasswordSetupEmail({ adminURL, resetPath, token, displayName }: PasswordSetupEmailInput) {
  const adminBase = adminURL.endsWith("/") ? adminURL : `${adminURL}/`;
  const relativeResetPath = `${resetPath.replace(/^\/+/, "")}/${encodeURIComponent(token)}`;
  const resetURL = new URL(relativeResetPath, adminBase).toString();
  const safeURL = escapeHTML(resetURL);
  const safeName = escapeHTML(displayName || "team member");

  return {
    subject: "Set or reset your Omana CMS password",
    html: `<!doctype html><html><body><p>Hello ${safeName},</p><p>Use the secure link below to set or reset your Payload CMS password. This link expires in 30 minutes and can be used once.</p><p><a href="${safeURL}">Set or reset password</a></p><p>If you did not expect this message, you can ignore it.</p></body></html>`,
  };
}
