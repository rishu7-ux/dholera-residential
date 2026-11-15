# Noida Phase 1 — Master CMS `braces` security-owner review package

Prepared: 2026-10-21. Status: **PROPOSED; NOT APPROVED**. Scope is the local Master CMS candidate only. This document does not authorize staging or production release.

## Finding and exact installed paths

The 2026-10-21 remediation report records `npm audit --omit=dev` at **0 critical, 10 high, 0 low** for Master after the DOMPurify fix. The high package entries propagate from one advisory, [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), against `braces <=3.0.3`. The advisory lists **no patched version**. The local lockfile and `npm ls braces --omit=dev --all --json` show these two production dependency paths to the same hoisted `braces@3.0.3`:

1. `@payloadcms/next@3.90.2` → pinned `sass@1.77.4` → `chokidar@3.6.0` → `braces@3.0.3`.
2. `@payloadcms/storage-vercel-blob@3.90.2` → `@payloadcms/plugin-cloud-storage@3.90.2` → `find-node-modules@2.1.3` → `findup-sync@4.0.0` → `micromatch@4.0.8` → `braces@3.0.3`.

The separate development path is `eslint-config-next@16.2.12` → `@next/eslint-plugin-next@16.2.12` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`; it is excluded by `--omit=dev`. The five websites' October 21 production audits were clean, while their full audits still reported this inherited development advisory. Audit *package-entry counts* must not be described as distinct vulnerabilities.

Local evidence: `package.json`, `package-lock.json` (SHA-256 `63a86294fc14a13826ce6d2e9cd5d1663ded392cd1ace32ad9ce05ed8bd21bca`), installed package manifests, `docs/noida-phase1-security-remediation-2026-10-21.md`, and the commands above. No dependency tree was changed during this review.

## Upstream and reachability analysis

- The published advisory remains high and unpatched. The `braces` maintainer disputes the advisory and closed the patch request; that disagreement does **not** withdraw the published advisory or settle this application's risk. Sources: [advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [maintainer response](https://github.com/micromatch/braces/issues/84), [advisory correction discussion](https://github.com/github/advisory-database/pull/10132).
- [Payload issue #18623](https://github.com/payloadcms/payload/issues/18623) identifies `find-node-modules` as unused in published cloud-storage code. A local search of `node_modules/@payloadcms/plugin-cloud-storage` found no import outside its manifest. [Payload PR #18645](https://github.com/payloadcms/payload/pull/18645) proposes removing it, but was open at review time. Even if released, this resolves only path 2.
- `sass@1.77.4` declares Chokidar 3 (`>=3 <4`); Chokidar 3 imports `braces` and calls `braces.expand(path)` for watcher paths containing `{`. Chokidar 4 removes glob support and `braces`, but is outside Sass's declared range and changes watcher behavior. Forcing Chokidar 4 or deleting Sass's dependency is not a safe compatible fix for this pinned Payload release.
- The application source does not directly import `braces`, `micromatch`, `chokidar`, Sass, or `find-node-modules`. The existing `.next` server trace search found none of `braces`, `micromatch`, `chokidar`, `find-node-modules`, or `findup-sync`. These are limited static observations, not proof of all runtime paths. No evidence was found that HTTP form fields, lead data, or upload names become Sass watch patterns. A malicious pattern would need to reach a vulnerable `braces` parse/compile/expand call; the cloud-storage path appears unused, while Chokidar's watcher path can call `braces.expand` if a watcher is invoked with brace syntax.

## Smallest safe remediation route

Do not use `npm audit fix --force`, downgrade Payload/Next, or apply an untested major Chokidar override. Keep all Payload packages matched at 3.90.2. Monitor for a patched `braces` release or an upstream Payload package release that removes both production paths. If one appears, seek separate approval for a **scoped lockfile/package install**, inspect the exact package diff and audit, then run Master typecheck, lint, lead/RAG/guard tests, Payload admin/editor/media checks, and isolated production builds. Recheck all five websites' audits and offline build/test baselines if any shared dependency or CMS interface changes.

## Proposed temporary exception for independent review

**Decision requested:** Independent security owner may accept only the Master CMS candidate's residual `braces` advisory for a maximum of 30 days, ending **2026-11-20 23:59 IST**, or reject it. This proposal is **not an acceptance**. Staging and production remain blocked until the owner records a decision and all other release gates pass.

**Rationale to assess:** The advisory describes an availability impact from deeply nested, attacker-controlled brace patterns. The installed copies are transitive; current local evidence suggests no public request field reaches such a pattern. The cloud-storage dependency appears unused. The Sass/Chokidar watcher path remains installed and potentially callable, so reachability is reduced by evidence but not conclusively disproved. There is no supported patched version or lockfile-only upgrade that clears both paths today.

**Required conditions if accepted:** Pin the exact candidate lockfile; prohibit application endpoints or jobs from accepting user-supplied glob/watch patterns; deploy only built server artifacts after verifying production traces and startup behavior; retain process restart/availability monitoring; review upstream advisory, `braces`, Payload PR/release, and audit weekly; end the exception immediately on new reachability evidence or a supported patch. These controls require independent confirmation before release.

**Owner decision record (blank):**

| Field | Required entry |
| --- | --- |
| Security owner and independent reviewer | Pending |
| Decision: accept or reject | Pending |
| Exception/ticket ID and date | Pending |
| Approved scope and candidate lockfile SHA-256 | Pending |
| Confirmed controls, deployment trace, and monitoring evidence | Pending |
| Expiry (no later than 2026-11-20 23:59 IST) | Pending |
| Earlier review triggers and rollback owner | Pending |

An accepted exception would address this advisory only. It would not establish Atlas isolation, TEST restore, real staging persistence, monitoring, rollback, or production readiness.
