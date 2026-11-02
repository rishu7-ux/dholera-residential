# Noida Phase 1 — selective release commit review (2026-10-30)

Working tree reviewed at `release/noida-phase1-20261022` / `b0aa8d72247ba6c60dfa4d8a495aa96306ec0258`. This is a packaging classification, not a Production GO decision or approval to commit. All existing files remain in place. The table covers every tracked modification and every untracked file reported by `git status --porcelain=v1 -uall` before this manifest was written. The manifest itself is **release-required**.

## Classification and safeguards

- **release-required:** candidate CRM runtime, its focused tests, and current release decision/evidence records. These are eligible for *selective review and staging*, not automatic Production deployment.
- **hold:** related historical records or local-only tooling that are not needed in the Production CRM source commit; preserve for a separate decision.
- **sensitive:** diagnostic or local credential/write tooling. No credential value was found in the release-required set; this category is held because its purpose handles protected identity or credentials.
- **unrelated:** existing generated/agent changes outside the CRM release diff. Preserve without staging.
- Private `.artifacts/` is ignored and `git ls-files .artifacts` returns no tracked files. Do not stage backups, logs, credentials, cookies, QA archives, or runtime evidence.
- Review used path inventory, complete text scans of changed files for URI/private-key/credential-assignment patterns, targeted runtime diffs/import paths, and `git diff --check`. Synthetic values in focused tests are fixtures, not operating credentials. No Production or Atlas setting was changed.
- Main-project `package.json`, `package-lock.json`, and `.vercel/project.json` have no working-tree changes. The untracked `vercel.json` is framework-only and held; the separate diagnostic has its own package/config files and remains excluded. No release-required file introduces a Production environment-variable value or deployment command.

## Every changed or untracked file

| Path | Classification | Reason |
| --- | --- | --- |
| `.gitignore` | **release-required** | CRM runtime, focused test, or active release evidence |
| `AGENTS.md` | **unrelated** | generated/agent change; preserve, exclude from CRM commit |
| `app/(payload)/admin/importMap.js` | **unrelated** | generated/agent change; preserve, exclude from CRM commit |
| `components/admin/CrmDashboard.tsx` | **release-required** | CRM runtime, focused test, or active release evidence |
| `components/admin/CrmNavLink.tsx` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-local-staging-setup.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `lib/crm/access.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `lib/crm/ingest.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `lib/crm/smtp-email-adapter.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `lib/noida-staging-runtime.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/noida-staging-runtime.test.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/smtp-email-config.test.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/staging-fixture.test.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `.github/workflows/noida-offline-build.yml` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `components/admin/CrmDashboardClient.tsx` | **release-required** | CRM runtime, focused test, or active release evidence |
| `components/admin/crm-dashboard.css` | **release-required** | CRM runtime, focused test, or active release evidence |
| `diagnostics/mongodb-identity/.vercelignore` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/README.md` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/api/identity.ts` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/lib/identity.ts` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/package-lock.json` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/package.json` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/public/404.html` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/tsconfig.json` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `diagnostics/mongodb-identity/vercel.json` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `docs/noida-candidate-security-and-staging-qa-2026-10-15.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-consent-inventory.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-consent-proposal.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-crm-test-writer-readiness-2026-10-16.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-dependency-security-remediation.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-payload-candidate-dependency-diff.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-payload-candidate-qa.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase-1-production-checklist.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-phase1-atlas-isolation-independent-review-2026-10-21.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-phase1-braces-security-owner-review-2026-10-21.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-phase1-crm-backend-reports-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-crm-local-workflow-qa-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-crm-readonly-browser-http-qa-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-final-safe-release-prep-2026-10-21.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-free-demo-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-human-review-and-staging-handoff-2026-10-22.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-isolated-vercel-staging-plan-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-local-crm-demo-gate-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-local-form-and-release-qa-2026-10-20.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-local-integration-readonly-2026-10-20.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-release-and-rollback-gates-2026-10-17.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-phase1-release-candidate-handoff-2026-10-30.md` | **release-required** | CRM runtime, focused test, or active release evidence |
| `docs/noida-phase1-release-readiness-2026-10-21.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-security-remediation-2026-10-21.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-security-root-cause-and-qa-plan-2026-10-21.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-six-site-connection-audit-2026-10-23.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-staging-preparation-2026-10-16.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-staging-unblock-package-2026-10-19.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-test-staging-activation-owner-package-2026-10-23.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-vercel-project-isolation-review-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-vercel-staging-readiness-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-real-mongo-concurrency-rehearsal-2026-10-30.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-staff-onboarding-runbook.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-staff-roster-template.csv` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-staging-backup-restore-rehearsal.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-step-6-security-decision-register-2026-10-15.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-step-7-blob-oidc-diagnosis-2026-10-15.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-step-7-mongodb-backup-restore-preflight-2026-10-16.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-step-7-test-infrastructure-report-2026-10-15.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-test-fixture-backup-command-review-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-test-fixture-restore-command-review-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-test-restore-independent-review-package-2026-10-17.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-website-form-verification.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/security-secret-rotation-checklist.md` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `lib/crm/concurrency-rehearsal-target.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `lib/crm/dashboard-roster.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `lib/crm/local-staging-cleanup-plan.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `lib/crm/local-staging-rehearsal-plan.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `lib/noida-disposable-local-target.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `scripts/noida-concurrency-bootstrap.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-concurrency-dryrun.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-concurrency-fixture-existing.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-concurrency-readonly-preflight.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-concurrency-repair-auth.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-concurrency-runner.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-disposable-local-bootstrap.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-disposable-local-cleanup-plan.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-disposable-local-credentials.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-disposable-local-functional-qa.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-disposable-local-launch.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-disposable-local-loopback.sb` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-disposable-local-offline-preflight.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-disposable-local-plan.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-disposable-local-readonly-preflight.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-disposable-local-run-qa.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `scripts/noida-local-staging-cleanup-plan.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-local-staging-readonly-preflight.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-local-staging-rehearsal-plan.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `scripts/noida-preview-uri-validator.mjs` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `tests/leads/noida-concurrency-repair-offline.test.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `tests/leads/noida-concurrency-runner-offline.test.mjs` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `tests/leads/noida-concurrent-ingress-offline.test.mjs` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/noida-dashboard-access.test.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/noida-disposable-local-target.test.ts` | **release-required** | CRM runtime, focused test, or active release evidence |
| `tests/leads/noida-local-staging-cleanup-plan.test.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `tests/leads/noida-local-staging-rehearsal-plan.test.ts` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `tests/security/mongodb-identity.test.ts` | **sensitive** | protected identity or local credential/write tooling; preserve, exclude pending separate review |
| `vercel.json` | **hold** | historical evidence, local rehearsal tooling, or unapproved CI/config; preserve, separate decision |
| `docs/noida-phase1-selective-commit-review-2026-10-30.md` | **release-required** | Exact selective commit inventory and owner handoff |

Inventory totals including this manifest: 104 files; release-required 25, hold 57, sensitive 20, unrelated 2.

## Exact selective staging plan — prepare only; do not execute without reviewing the final diff

Use an explicit path list. In particular, `lib/noida-disposable-local-target.ts` is required because `lib/noida-staging-runtime.ts` imports it; `lib/crm/dashboard-roster.ts`, `CrmDashboardClient.tsx`, and the CSS are required by the modified dashboard. The modified Payload import map only reorders generated entries and is excluded. The new `vercel.json` changes no required behavior and is held.

```sh
git add -- \
  '.gitignore' \
  'components/admin/CrmDashboard.tsx' \
  'components/admin/CrmDashboardClient.tsx' \
  'components/admin/CrmNavLink.tsx' \
  'components/admin/crm-dashboard.css' \
  'docs/noida-consent-inventory.md' \
  'docs/noida-consent-proposal.md' \
  'docs/noida-phase-1-production-checklist.md' \
  'docs/noida-phase1-atlas-isolation-independent-review-2026-10-21.md' \
  'docs/noida-phase1-braces-security-owner-review-2026-10-21.md' \
  'docs/noida-phase1-release-and-rollback-gates-2026-10-17.md' \
  'docs/noida-phase1-release-candidate-handoff-2026-10-30.md' \
  'docs/noida-phase1-selective-commit-review-2026-10-30.md' \
  'lib/crm/access.ts' \
  'lib/crm/dashboard-roster.ts' \
  'lib/crm/ingest.ts' \
  'lib/crm/smtp-email-adapter.ts' \
  'lib/noida-disposable-local-target.ts' \
  'lib/noida-staging-runtime.ts' \
  'tests/leads/noida-concurrent-ingress-offline.test.mjs' \
  'tests/leads/noida-dashboard-access.test.ts' \
  'tests/leads/noida-disposable-local-target.test.ts' \
  'tests/leads/noida-staging-runtime.test.ts' \
  'tests/leads/smtp-email-config.test.ts' \
  'tests/leads/staging-fixture.test.ts'
git diff --cached --check
git diff --cached --name-only
git diff --cached --stat
# Then inspect the entire cached diff and run only checks affected by the exact staged changes.
# Commit only after the release owner accepts the scope and the required local release gates pass.
git commit -m "feat: prepare Noida Phase 1 CRM release candidate"
```

The above commands are a future execution plan. No `git add`, commit, push, or deployment occurred in this review. Before committing, confirm the cached filenames exactly match this allowlist, inspect the complete diff, verify no credential/backup material, and retain all excluded work unmodified. If a path changes after this review, reassess it before staging.

## Owner action checklist

1. **Independent isolation reviewer:** Name an authorized reviewer distinct from the implementing owner. Supply an existing protected host/database attestation bound to active Production deployment `dpl_Aay9EhJxDSozcRe9hbpmQDMC4Dm9`, if available; otherwise record historical target NOT VERIFIED. Reviewer compares immutable Atlas project/cluster metadata, complete TEST names-only inventory and owner map, plus all direct Production MongoDB clients, then signs YES/NO/NOT VERIFIED. No historical secret retrieval or new diagnostic deployment is implied.
2. **Restricted online staging connectivity:** Owner/network reviewer identifies a supported existing fixed-egress route for the protected Preview, confirms its exact static CIDR, route design, access protection, cost and availability, and separately approves only the required TEST Atlas allowlist/configuration changes. Verify TLS, approved stage host/database and scoped user from the actual Preview runtime. Do not use `0.0.0.0/0` or assume Hobby dynamic egress is stable.
3. **Security and consent:** Security owner accepts/rejects the bounded `braces` advisory with controls and expiry or approves a compatible fix. Owner/legal approves exact enquiry disclosure, entity, privacy link, separate optional marketing choice, and durable proof/versioning before public form changes.
4. **Backup and release operations:** Owner verifies a current staging backup after the 12-user/11-lead baseline, an independent restore/rollback decision, a separate Production backup/restore plan, known-good deployment IDs, on-call monitor and stop thresholds, SMTP delivery decision, exact deployment window, and Production go-live signoff. TEST-only approvals do not authorize Production.

## Smallest protected staging step

Once the owner selects and authorizes a *supported* restricted TEST egress route, apply only that separately approved TEST-side routing/allowlist change, then perform a read-only connection and authentication smoke check against the existing protected Preview. Online lead-producing checks require their own bounded write approval. Production remains **NO-GO**.
