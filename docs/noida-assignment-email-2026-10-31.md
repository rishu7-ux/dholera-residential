# Noida CRM assignment email — release gate

Status: code prepared locally; outbound delivery **disabled**. No message was sent and Production is NO-GO.

## Flow

1. When `NOIDA_ASSIGNMENT_EMAIL_ENABLED=1`, the existing ingestion transaction writes the central lead, optional legacy lead, assignment counter, activities, and one `crm-assignment-notifications` outbox document keyed by the central lead `_id`. With the flag off, the established ingestion write set is unchanged. No outbox document is made for an unassigned lead or duplicate ingestion replay.
2. A separate authenticated worker processes one queued document per request. It verifies that the lead still belongs to the active salesperson and reads the salesperson's current registered email. It marks the job `attempted` before SMTP handoff.
3. Provider acceptance changes status to `accepted-by-provider`. This **does not confirm inbox delivery**. No delivery webhook exists, so `confirmed-delivered` is never set automatically.
4. A provider error or a crash after the attempt begins is ambiguous. The job remains `uncertain` or `attempted` and is **not automatically resent**. An operator must reconcile it against provider logs before a separately approved retry. A `blocked` job with `attempts=0` can be safely requeued by exact ID after the missing assignee/email is corrected. This is the necessary SMTP limitation: exactly-once inbox delivery cannot be guaranteed by MongoDB transactions and SMTP alone.

The email contains only the lead reference, source, assignment time, status, and an authenticated Payload lead link. Payload RBAC still decides whether the viewer can read that lead. No customer phone, customer email, token, or lead message is included.

## Environment and activation

Required only on the approved CRM deployment, never in frontend variables:

- `NOIDA_ASSIGNMENT_EMAIL_ENABLED=1` — off by default.
- `NOIDA_CRM_PUBLIC_URL` — exact reviewed HTTPS origin for that environment, with trailing `/`; not derived from request headers.
- `NOIDA_SMTP_DELIVERY_ENABLED=1`, `SMTP_HOST`, `SMTP_PORT`, optional matching `SMTP_USER`/`SMTP_PASS`, `PAYLOAD_EMAIL_FROM_ADDRESS`, `PAYLOAD_EMAIL_FROM_NAME`; TLS certificate verification stays enabled.
- `CRON_SECRET` — strong private bearer value used by `GET /api/crm/assignment-notifications`.

Local guarded TEST startup requires `NOIDA_SMTP_DELIVERY_ENABLED=0` and rejects assignment-email enablement, so it cannot send mail or add notification jobs. A complete SMTP configuration alone does not enable delivery. The sender domain and SPF/DKIM/DMARC must be verified with the chosen provider before a controlled TEST-mailbox send. SMTP authentication, sender authorization, and actual inbox delivery still require live verification.

Before turning the feature on, create `crm-assignment-notifications` and an index on `{ status: 1, createdAt: 1 }` in the approved TEST database under separate metadata-write approval, then verify the outbox transaction and worker on a synthetic lead. The `_id` index supplies one job per lead. Review collection/index creation on the target MongoDB tier before deployment. Provision a Vercel Cron or equivalent trusted scheduler to call the authenticated worker at an approved interval; no schedule is activated in this release candidate. The scheduler must use the same deployment's private `CRON_SECRET`. One request processes one job, bounding runtime and email volume. Vercel Cron runs only on Production deployments; its Hobby plan allows only a daily schedule, while Pro supports per-minute scheduling. Preview requires an approved external TEST scheduler or a one-off protected manual invocation. Do not configure a per-minute Vercel Cron until the hosting plan and Production release are approved.

## Rollback

Disable `NOIDA_ASSIGNMENT_EMAIL_ENABLED` and the scheduler first. Preserve queued and attempted jobs for reconciliation. Roll back application code only to a version compatible with the new collection; never delete the outbox or resend ambiguous jobs automatically. The already-committed lead and assignment are unaffected by SMTP failure. Production deployment, Atlas changes, and real mail require separate approval.
