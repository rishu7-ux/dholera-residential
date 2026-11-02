# Noida Phase 1 — release gates and rollback plan

Status: **PREPARED ONLY; production NO-GO.** No production access, deployment, email, database write, or cleanup is authorized by this plan. The existing [production change checklist](noida-phase-1-production-checklist.md) remains the detailed migration and staff-onboarding runbook.

## Verified local checkpoint

- Owner-reported baseline: 16/16 website form tests, 19/19 ASK OMANA chatbot regressions, and 10-person round-robin/RBAC integration previously passed. Those database-backed flows were not rerun in this no-write task.
- Current no-write run: 115/115 offline lead, RAG, SMTP mock, target-guard, archive, and fixture tests PASS; TypeScript PASS; ESLint PASS; isolated Next.js production-mode build PASS with 22 prerendered routes and the homepage rendered at request time. No database connection was needed during the final build.
- Recovery rehearsal: approved TEST backup and dry run passed; the live restore and three-record recovery verification have not happened. The restore reviewer package is [here](noida-test-restore-independent-review-package-2026-10-17.md).
- Fresh `npm audit --omit=dev` found 12 affected production package entries: 10 high and 2 low, representing one `braces` advisory and two DOMPurify advisories. [Braces GHSA](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. Monaco 0.57.0 pins and bundles DOMPurify 3.4.15; a simple package override would not patch its bundled copy. See the [existing security decision register](noida-step-6-security-decision-register-2026-10-15.md). No unsafe override or forced upgrade was applied.
- SMTP is not active. The invite endpoint returns 503 with Payload's console adapter, and the mock transport test sends only to `example.invalid` in memory. Actual staff invitations remain blocked.

## Production GO gates

1. Independent TEST restore reviewer signs the exact command and destination; Atlas project membership, TEST-only workloads, restore-user Cluster0 restriction/expiry, and IP allowlist are confirmed. Repeat read-only checks, then use the owner's existing approval for exactly one live TEST restore. Verify three restored records, digest, indexes, source unchanged, and archive unchanged. Any discrepancy is a NO-GO; cleanup requires separate approval.
2. Security owner resolves or formally accepts the three residual advisories with documented exposure, mitigations, and expiry/recheck date. Re-run audit at the release candidate lockfile. No package override is accepted merely because audit counts improve.
3. Approve an isolated Vercel staging project and TEST-only runtime credentials per the [staging plan](noida-phase1-isolated-vercel-staging-plan-2026-10-17.md). Deploy only after separate authorization, run protected staging smoke checks, and separately approve any synthetic database writes. Verify forms, chatbot, shared Payload collections, exact ten-person rotation, duplicate idempotency, RBAC, media/blogs, and restart persistence.
4. Select and review a supported email provider/adapter, sender domain, test mailbox, TLS, dependency tree, and secret scope. Enable only after separate approval and one owner-controlled staging delivery. Confirm reset-token expiry/replay and fail-closed behavior. No real staff onboarding before this gate.
5. Owner verifies actual ten salespeople, Team Leader, office/team and first assignment position; legal/owner approves exact consent wording and disclosure versions. Use the existing roster and consent runbooks; do not infer identity or consent from synthetic fixtures.
6. Before a production change window, independently verify production MongoDB backup and restore plan, current collection/index inventory, compatible Payload schema migration, Vercel project/domain/env scopes, five site ingest secrets, monitoring contacts, and the previous known-good deployment IDs. This is planning only; production systems are not accessed here.

## Authorized change-window sequence for a future release

Freeze unrelated changes. Capture an approved production snapshot and release IDs. Deploy the shared Payload CMS with backward-compatible schema first; verify existing public blogs/media and legacy collection behavior. Provision staff from the approved roster, then deploy website server integrations in a controlled order. Run synthetic staging smoke tests and only separately authorized production smoke enquiries. Watch API errors, duplicate keys, assignment counter increments, unassigned leads, role denials, and email delivery. A failed gate stops rollout.

## Rollback decision and procedure

- **Trigger:** increased ingestion errors, wrong assignee/sequence, duplicate lead creation, cross-user access, failed authentication, failed blog/media routes, unexpected schema/index change, or secret exposure.
- **Contain:** disable the affected website-to-CMS server-side ingestion path or revoke its specific ingress secret under incident authorization; preserve logs, request IDs, idempotency keys, assignment counter state, and exact deployment IDs. Do not delete leads or replay requests during diagnosis.
- **Application rollback:** reassign Vercel production domains to the recorded known-good deployment under owner approval, then verify CMS and all five site routes. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) does not undo database writes or refresh environment variables; verify secret compatibility with the old build before use.
- **Database recovery:** preserve and analyze the current state in a separate approved environment. A production restore or overwrite requires a new owner approval and independent verification. Do not reuse the TEST fixture archive for production recovery.
- **Reconciliation and restart:** compare durable request/idempotency records before any replay, confirm no missing or duplicated leads, review counter and activity history, then re-enable each site only after owner sign-off. Record incident timeline and evidence.

## Remaining work and estimate

After all external reviews, TEST restore verification, staging resources, email provider, and security decisions are available, allow approximately **3–5 focused engineering days** for staging configuration, full integration evidence, release candidate checks, and a controlled cutover rehearsal. Reviewer availability, provider onboarding, legal decisions, Atlas isolation evidence, and upstream vulnerability fixes have **no reliable completion date**; they are not included in that engineering estimate. A production release date should not be set until the GO gates are evidenced.
