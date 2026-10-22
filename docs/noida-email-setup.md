# Noida Phase 1 — Optional SMTP Email Setup

## Current behavior

Payload's native password reset is reserved for future staff activation. The reset token expires after 30 minutes and is single-use. The Super Admin-only `POST /api/users/{id}/invite` route targets only Salesperson and Team Leader accounts. It fails closed while Payload's console email adapter is active. No account is created by an invitation request, no password is mailed, and the endpoint never returns or logs the token.

The release worktree uses a small Payload 3.90.2 `EmailAdapter` backed by a single direct, pinned `nodemailer@10.1.7` dependency. It does not install `@payloadcms/email-nodemailer`, which previously pulled vulnerable Nodemailer 9.1.1. SMTP variables alone do not enable delivery: `NOIDA_SMTP_DELIVERY_ENABLED=1` is also required. With that flag absent, Payload's console adapter remains active and the invitation endpoint returns 503 without generating a setup link. No provider, sender or credential has been configured.

**Security gate:** do not set the delivery flag or onboard real staff until the owner selects a provider and the direct dependency, sender domain, staging delivery, reset-token replay/expiry, and operational controls receive security approval. The current invitation endpoint intentionally returns 503.

## Provider choice

The code supports a standards-based SMTP relay. The company has not selected a relay, sender domain, mailbox, plan or credentials. The owner must confirm the provider's TLS/authentication settings and operational limits before any staging delivery.

Official references: [Payload email adapters and SMTP configuration](https://payloadcms.com/docs/email/overview), [Payload authentication email and forgot-password options](https://payloadcms.com/docs/authentication/email).

## Owner-approved configuration names

These names are read by the release worktree. Configure them only in a separately approved, server-only environment; never use `NEXT_PUBLIC_` variables:

- `SMTP_HOST`
- `SMTP_PORT` (`587` for STARTTLS, or `465` for implicit TLS)
- `SMTP_USER` (optional only if the relay uses IP-based auth)
- `SMTP_PASS` (required together with `SMTP_USER`)
- `PAYLOAD_EMAIL_FROM_ADDRESS`
- `PAYLOAD_EMAIL_FROM_NAME`
- `NOIDA_SMTP_DELIVERY_ENABLED` (`1` only after separate staging or production activation approval; absent or `0` keeps delivery off)

`SMTP_TLS_REJECT_UNAUTHORIZED` is not needed; if present, it must be `true`. The code rejects `false` and refuses activation if `NODE_TLS_REJECT_UNAUTHORIZED=0`. STARTTLS is mandatory except on implicit-TLS port 465. The adapter disables file/URL attachment access, limits recipients to one, bounds SMTP timeouts, and rejects an unaccepted recipient. Never place credentials in source control or a website/browser bundle.

## Safe activation sequence

1. Owner selects the mail relay, sender domain/address, and receives authorization to store its SMTP credentials in the server secret manager.
2. Verify SPF/DKIM/DMARC and allowed sender policy with the domain/mail administrator. Confirm the CMS admin URL is HTTPS and is the owner-controlled domain used to build reset links.
3. In a separately approved protected staging environment, set staging-only relay values and the delivery flag. Send only to an owner-controlled test mailbox; no customer or staff recipient during QA.
4. Check accepted/rejected delivery, token expiry/replay, provider logs and CMS logs without exposing tokens or full reset URLs. A failed send returns 503 and attempts to invalidate the undelivered token; if cleanup also fails, investigate the account state before retrying.
5. Owner and security reviewer separately approve production delivery. Set production values and the delivery flag only in its secret manager during an approved change window; issue one invitation to an owner-controlled mailbox before onboarding.
6. If delivery fails, disable the delivery flag; the invite route must remain fail-closed. Rotate any exposed SMTP credential immediately.

## Automated security test

`npm run test:noida-onboarding` covers TLS/STARTTLS and activation validation, a fake transport's acceptance/rejection, Super Admin invite authorization, console-adapter denial, null-delivery response and failed-delivery cleanup. It sends no email and requires no SMTP credentials. Live delivery, token expiry/replay and staging operations remain separate approval gates.
