# Noida CRM Phase 1 — Production Change Checklist

This checklist is a release gate, not deployment approval. Do not run it against production until the owner approves a change window.

## Before the change

- Confirm the production Payload/MongoDB target and the five website-to-domain mappings with the owner.
- Confirm the actual Noida staff roster, Team Leader, staff emails, and assignment order. Verify whether Rishu is among the staff and verify the correct existing account before setting the first rotation position. Never infer identity from an email/name match.
- Confirm the public consent/disclosure text for each form and the chatbot, and assign reviewed, stable disclosure-version identifiers. Current `website:source:v1` metadata is an implementation version marker; it is not legal approval of disclosure wording.
- Follow `docs/noida-staff-onboarding-runbook.md` for exact roster validation, identity review, account provisioning, invitations, and first-login checks. The implementation uses Payload's native 30-minute single-use password-setup token; no real accounts are created until the owner approves the verified roster.
- Review `docs/noida-email-setup.md`. The candidate has no email adapter and
  invitations fail closed. Owner and security review must select a supported
  adapter/provider, sender domain, secret-manager values, and one
  owner-controlled staging delivery before invitations can be enabled.
- Resolve or explicitly accept the three residual advisories in
  `docs/noida-step-6-security-decision-register-2026-10-15.md`, then run the
  staging regression suite before enabling email delivery or onboarding.
- Complete `docs/noida-staff-roster-template.csv` with the owner-approved ten salespeople and one Team Leader. The roster validator checks counts, unique official emails, Noida office, and assignment orders. Verify Rishu's existing identity/reference and the Team Leader identity; never infer either.
- Review `docs/noida-consent-inventory.md` and `docs/noida-consent-proposal.md`; obtain owner/legal approval of exact disclosure wording, purpose separation, and stable disclosure versions. Existing `website:source:v1` metadata is not legal approval and, for some form sources, does not prove the user performed an affirmative action. Do not change public wording before approval.
- Configure matching server-only ingestion secrets on the Master CMS and the five website server environments. Never use `NEXT_PUBLIC_` variables for these secrets.
- Confirm the production MongoDB replica-set/transaction support, indexes, TLS verification, least-privilege database user, and connection-pool limits.
- Freeze unrelated content/admin changes during the migration window and record the current release identifiers for CMS and all five sites.

## Backup and migration

1. Take a MongoDB Atlas snapshot/backup and verify that it is restorable to a separate staging cluster. Record the backup timestamp and restore owner.
2. Export and securely retain the current collection/index inventory. Confirm that backups include `users`, all existing enquiry collections, blogs, media metadata, and Payload globals.
3. Apply the reviewed Payload schema changes through the agreed migration process. Do not drop, rename, or bulk-rewrite legacy lead/blog/media collections.
4. Create exactly one active `noida` office and one Noida team only after approval. Create staff accounts only from the approved roster, with unique emails and role/office/team links. Provision access through verified invite/reset email; never send passwords in chat, source control, or ordinary email.
5. Verify the ten salespeople and Team Leader in Payload Admin, assignment eligibility/order, active status, and least-privilege visibility before enabling website ingestion.
6. Verify each secret/API caller using a synthetic staging lead first. Then enable production website integrations in a coordinated window and monitor errors, duplicate/idempotency rates, unassigned fallback, and sequence/audit events.

## Post-migration checks

- Confirm all previous CMS collections, blogs, published blog routes, media, and existing public website routes still load and retain expected content.
- Confirm no chatbot widget was added outside `omana-projects` and no chatbot widget was added to `dholera-residential`.
- Submit one explicitly approved, clearly marked production smoke enquiry only if the owner authorizes that separately; otherwise perform smoke tests in staging only.
- Confirm a single shared sequence across all sources, duplicate retries do not advance it, and transaction failure leaves both lead and counter unchanged.
- Confirm salesperson/Team Leader/Super Admin permissions through direct routes and API, including denial of cross-salesperson access and user-role escalation.
- Confirm delivery of account activation/reset emails and remove any temporary test accounts or test content.

## Rollback

1. Disable website-to-CMS ingestion at the server-side integration switches or rotate/revoke the affected ingress secrets. Do not alter browser bundles to contain secrets.
2. Keep the new collections and fields unless the migration owner explicitly approves a backwards-compatible rollback. Prefer rolling back application code while preserving newly written data.
3. If data corruption is suspected, stop writes, preserve logs/assignment state, and restore the verified snapshot to a separate cluster for diagnosis. Production restore/overwrite requires explicit owner approval and a second-person verification.
4. Revert the coordinated CMS/site release to the recorded versions, validate existing website forms and CMS routes, and notify the owner before re-enabling intake.
5. Reconcile leads captured during the window from durable request logs/idempotency keys before replaying anything. Never replay without duplicate checks.

## Account lifecycle

- Obtain staff name, business email, role, office, team, manager approval, and assignment order from the owner.
- Verify identity and email ownership through the chosen invite provider; provision an individual account with least privilege and a one-time, expiring activation/reset link.
- Require a unique account and strong individual password/MFA if supported by the organization's identity policy. Never create shared salesperson logins.
- Verify the role-scoped dashboard and direct/API denials with the staff member, record the activation, and provide basic handling/privacy guidance.
- Disable the account and assignment eligibility promptly on departure/leave; reassign open leads through an audited owner-approved process. Do not delete the user or lead history.

## Production environment variable names

Master CMS: `MONGODB_URI`, `PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`, `ESTATE1_INGEST_SECRET`, `ESTATE2_INGEST_SECRET`, `DHOLERA_ESTATES_INGEST_SECRET`, `INDUSTRIAL_INGEST_SECRET`, `OMANA_INGEST_SECRET`, `OMANA_FRONTEND_URL`, `OMANA_REVALIDATE_SECRET`.

Website server environments: the corresponding `*_INGEST_SECRET` for each site. The values must match the Master CMS values and remain server-only.

Reserved future SMTP variables (all server-only; inactive because no adapter is installed): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `PAYLOAD_EMAIL_FROM_ADDRESS`, and `PAYLOAD_EMAIL_FROM_NAME`. TLS certificate verification is mandatory; port 465 uses implicit TLS and other ports require STARTTLS. `SMTP_TLS_REJECT_UNAUTHORIZED=false` is rejected. No provider account, credentials, or test email is configured/sent. See `docs/noida-email-setup.md`. `MONGODB_TEST_URI` is test-only and must never be configured as a production database target.

## Verification history and current checkpoint

The bullets below preserve the 2026-10-14 application QA history. For the current 2026-10-17 build, dependency audit, TEST recovery status, staging gates, release checklist, and rollback procedure, use [Noida Phase 1 release and rollback gates](noida-phase1-release-and-rollback-gates-2026-10-17.md). Production remains NO-GO.

- Existing prior QA results are retained in the task handoff; this checklist does not replace them.
- Current allowlisted TEST MongoDB contains a pre-existing synthetic Noida fixture: one office/team, ten `.invalid` salesperson accounts, one `.invalid` Team Leader, 30 leads marked `/crm-integration-test`, and one assignment counter at sequence 30. The CRM suite temporarily snapshots and restores these test user documents/counter, creates 64 run-scoped synthetic leads, then removes only its own records. Final integration run passed and exited normally.
- Local headless Chrome Payload-admin verification passed: salesperson dashboard showed only 3 assigned synthetic leads, foreign direct-record navigation redirected to not-found, Team Leader dashboard showed all 30 fixture leads across ten assignees, and Team Leader user creation/invitation was denied. Direct REST tests also rejected anonymous access, cross-salesperson records/status/assignment updates, and role/office escalation. Synthetic users were restored on server stop.
- A real local Next process stop/restart persistence test passed: sequence 31 and 32 were assigned across separate application processes, then its synthetic records and counter delta were cleaned/restored.
- Website central-ingress route tests passed 19/19 source variants. On 2026-10-14, local headless Chrome submitted four Omana UI forms through local website routes into the allowlisted Master TEST database (sequences 31–34); those synthetic leads were cleaned and the counter restored. Estate 1, Estate 2, Dholera Estates, and Industrial rendered server HTML but failed the React hydration/handler readiness test; their forms are BLOCKED, not passed. No synthetic request was sent to external targets in website `.env.local` files. See `docs/noida-website-form-verification.md`.
- The isolated Payload 3.90.2 candidate removed the unused vulnerable
  Nodemailer adapter. Its invite endpoint fails closed with HTTP 503 while
  Payload uses the console adapter. Roster, password-email, TLS-policy, and
  adapter-absence tests pass; no actual email was sent.
- **Updated 2026-10-17:** a distinct TEST restore target was approved, the three-record backup and `mongorestore --dryRun` passed, and the destination remained absent. No live restore or cleanup has run. Independent human review and Atlas production-isolation confirmation remain open; see the [reviewer package](noida-test-restore-independent-review-package-2026-10-17.md).
- Consent wording proposal exists at `docs/noida-consent-proposal.md`; owner/legal decisions and all public wording updates remain pending approval.
- Real onboarding is BLOCKED pending the verified 10-person/1-Team-Leader roster, Rishu and Team Leader identity confirmation, owner provisioning approval, and SMTP provider decision. No production accounts were created.
