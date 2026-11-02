# Noida Phase 1 selective release manifest — 2 November 2026

Branch `release/noida-phase1-20261022`; base `b0aa8d72247ba6c60dfa4d8a495aa96306ec0258`. No files were staged, committed, pushed or deployed for this review.

The earlier [104-path classification](noida-phase1-selective-commit-review-2026-10-30.md) was compared by exact path to `git status --porcelain=v1 -uall`. All 104 classified paths remain. The 15 additional paths are classified here; together they cover all 119 paths present before writing this manifest. This file is release documentation, bringing the working-tree inventory to 120 paths: **39 release-required, 59 hold, 20 sensitive, 2 unrelated**. Preserve every held, sensitive and unrelated path.

| Additional path | Decision | Reason |
| --- | --- | --- |
| `app/(frontend)/contact-us/ContactUsView.tsx` | release-required | Residential Contact submission key and sanitized handling |
| `app/api/contact-messages/route.ts` | release-required | Missing Residential Contact ingestion route |
| `app/api/crm/assignment-notifications/route.ts` | release-required | Protected notification worker used by outbox |
| `app/api/enquiries/route.ts` | release-required | Transactional Residential Enquiry route; removes public listing |
| `collections/Crm.ts` | release-required | Residential website selection in central lead schema |
| `components/PopupForm.tsx` | release-required | Consent and stable submission key |
| `components/SideEnquiry.tsx` | release-required | Consent, source and stable submission key |
| `docs/noida-assignment-email-2026-10-31.md` | release-required | Worker configuration and rollback operation |
| `docs/noida-phase1-test-atlas-egress-change-request-2026-10-30.md` | hold | External network change request, not deployment source |
| `lib/crm/assignment-notification.ts` | release-required | Transactional outbox and guarded delivery |
| `lib/crm/residential-ingress.ts` | release-required | Shared Residential Contact and Enquiry validation and ingestion |
| `payload-types.ts` | release-required | Generated types for Residential website and consent |
| `payload.config.ts` | release-required | Legacy Enquiries consent field |
| `tests/leads/assignment-notification.test.mjs` | release-required | Focused outbox regression checks |
| `tests/leads/residential-ingress.integration.mjs` | hold | Real local MongoDB writer and disposable database cleanup test; keep outside deployment commit |

## Exact staging allowlist

Run only after owner approval and a fresh status/diff review. Use `git add --` followed by exactly these 39 paths; do not use `git add .` or `git add -A`:

```text
.gitignore
app/(frontend)/contact-us/ContactUsView.tsx
app/api/contact-messages/route.ts
app/api/crm/assignment-notifications/route.ts
app/api/enquiries/route.ts
collections/Crm.ts
components/PopupForm.tsx
components/SideEnquiry.tsx
components/admin/CrmDashboard.tsx
components/admin/CrmDashboardClient.tsx
components/admin/CrmNavLink.tsx
components/admin/crm-dashboard.css
docs/noida-assignment-email-2026-10-31.md
docs/noida-consent-inventory.md
docs/noida-consent-proposal.md
docs/noida-phase-1-production-checklist.md
docs/noida-phase1-atlas-isolation-independent-review-2026-10-21.md
docs/noida-phase1-braces-security-owner-review-2026-10-21.md
docs/noida-phase1-release-and-rollback-gates-2026-10-17.md
docs/noida-phase1-release-candidate-handoff-2026-10-30.md
docs/noida-phase1-selective-commit-review-2026-10-30.md
docs/noida-phase1-selective-release-manifest-2026-11-02.md
lib/crm/access.ts
lib/crm/assignment-notification.ts
lib/crm/dashboard-roster.ts
lib/crm/ingest.ts
lib/crm/residential-ingress.ts
lib/crm/smtp-email-adapter.ts
lib/noida-disposable-local-target.ts
lib/noida-staging-runtime.ts
payload-types.ts
payload.config.ts
tests/leads/assignment-notification.test.mjs
tests/leads/noida-concurrent-ingress-offline.test.mjs
tests/leads/noida-dashboard-access.test.ts
tests/leads/noida-disposable-local-target.test.ts
tests/leads/noida-staging-runtime.test.ts
tests/leads/smtp-email-config.test.ts
tests/leads/staging-fixture.test.ts
```

Before any commit, verify `git diff --cached --check`, compare `git diff --cached --name-only` to this exact allowlist, inspect the complete cached diff for secrets and environment changes, and confirm the release owner accepts the scope. The isolated webpack production build, TypeScript, repository ESLint, 13 focused access/notification tests and disposable Residential MongoDB integration passed. This manifest is packaging readiness only. Production remains NO-GO pending independent database isolation, restricted Preview connectivity, online smoke tests, consent/security decisions, backup/rollback approval and release signoff.
