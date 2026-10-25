# Drizzle ORM security update — 24 October 2026

## Change and assessed exposure

The application ORM is pinned from **0.44.7** to **0.45.4**, a stable release containing the identifier-escaping fix introduced in 0.45.2. [Maintainer security advisory](https://github.com/advisories/GHSA-gpj5-g38j-94v9), [0.45.2 release](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.2), [0.45.4 release](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.4).

The issue, CVE-2026-39356, affects SQL identifiers/aliases containing quote delimiters. Exploitation requires untrusted input to reach identifier or alias construction; using static schemas alone does not demonstrate an exploitable application path.

The searched backend/database files contain no direct `sql.identifier()` use, and the `.as()` aliases found are static strings. No attacker-controlled identifier path was established in this scoped review. The existing schema-health raw query iterates an internal table/column map, and the drip-email raw expression is called with the Worker's fixed day list. This is not a complete SQL-injection audit: the library fix does not make arbitrary `sql.raw()` input safe or authorize access to dynamic columns. Any future user-selectable identifiers still need an explicit allowlist.

Drizzle Kit remains at its existing locked **0.31.9**. Application schemas, migrations, query code, financial/access policies and production bindings were not edited. No schema generation, database push, remote query or deployment was performed. Version 0.45.4 adds optional Netlify driver metadata and a PostgreSQL prepared-query fix; this project continues using the existing D1 adapter.

## Security and D1 compatibility evidence

`pnpm test:security-drizzle` runs the new ORM regression tests and the existing local-D1 batch rollback test. Tests create uniquely named disposable SQLite databases under TEMP, use the real `drizzle-orm/d1` driver with the project's local D1 adapter, and verify the resolved cleanup target before deleting each fixture directory. No production database or application migration is used.

Before updating, **7 compatibility/batch checks passed and 3 identifier-security checks failed**. After updating, all **10 checks pass**:

- Embedded quotes stay within one SQL identifier.
- Quoted report aliases execute and map their results correctly.
- Quoted table/column names can be read and written as literal names.
- Punctuation-heavy bilingual text remains a bound parameter.
- Nullable values, booleans and SQLite-generated defaults retain their behavior.
- Scoped updates return correct affected-row counts and leave other accounts untouched.
- Grouped integer-money totals remain correct across separate accounts.
- Ordered D1 batch writes work without adding a `RETURNING` clause.
- Unique-key conflict handling does not duplicate a fixture payment row.
- The existing test verifies rollback on a failed batch and later successful reuse.

These fixture checks exercise representative query mechanics, not the full production schema or Cloudflare's live D1 implementation. Existing financial/access business tests and TypeScript/build checks provide additional coverage; isolated staging verification is still required before release. The full validation results and remaining existing test failures are recorded in the remediation plan.

Wider verification completed under the approved Node 24.22.1 runtime: frozen-lockfile installation, project TypeScript, frontend/standalone Node build, static/curated SEO checks, and Worker build all pass. The root Vitest suite reports **975 passing tests and the same 3 existing UI-contract failures**, across 190 files. All **33 critical-cycle files** and all **13 non-UI financial test files** passed. The three failures are the previously documented subscriber-report rendering, Arabic renewal wording and finance-manager navigation contracts; no new failure appeared. No test assertions, business permissions or production query implementations were changed to make the result pass.

The installed version and lockfile select only Drizzle ORM 0.45.4. The npm bulk advisory endpoint reported no advisories for that version during this check. Scoped evidence is saved in `security_drizzle_audit_2026-10-24.json`; this is not a clean audit of the entire dependency tree.

## Release limits

The prior UI-contract failures for subscriber-report rendering, Arabic renewal wording and finance-manager navigation are separate from the ORM change and must remain visible in release preparation. Existing peer warnings, other dependency findings, the system-wide Node update, live provider verification and staging resource/integration isolation remain tracked.

Local validation builds use static/curated SEO inputs with external article fetching disabled. They require a rebuild with intended production inputs before promotion. No production deployment or customer-data operation is included in this phase.
