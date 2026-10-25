# Unused AWS/XML dependency removal — 24 October 2026

## Change and applicability

Removed the unused direct dependencies `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, both previously locked to 3.985.0. Regenerating the lockfile pruned **100 package versions**, including the entire AWS SDK/Smithy chain and `fast-xml-parser` 5.3.4. No package versions were added, and other direct dependency declarations are unchanged from the preceding Axios phase.

A source/configuration/script search, including hidden files and excluding installed dependencies, generated artifacts, Git metadata and historical audit reports, found no AWS SDK, S3 presigner or XML parser use. `backend/storage-r2.ts` calls native Cloudflare bucket bindings. The Worker uses native R2 bindings for media and private receipts. The retained Forge storage helper uses fetch/FormData. No S3 presigned URL call was found in this checkout.

Removing the unused parent dependencies eliminates this locked parser chain without introducing another SDK version or a transitive override. The old parser version is within published advisory ranges for [entity/DOCTYPE handling](https://github.com/advisories/GHSA-m7jm-9gc2-mpf2) and [numeric entity expansion](https://github.com/advisories/GHSA-8gc5-j5rx-235r). Dependency presence alone did not establish that the application exposed XML parsing to attackers; the source review found no such route. This review does not attest to historical or currently deployed artifacts.

## Compatibility evidence

`pnpm test:security-storage` runs **36 passing tests across six files**: native R2 helpers, payment-proof uploads, support uploads, student document access, recording CORS and financial expense workflows. Fixtures use mocked bindings or disposable local SQLite data and do not call real buckets or production services.

The seven new native R2 checks passed both before and after removal. They verify upload bytes and HTTP metadata, key normalization and configured URL format, retrieval, missing-object errors, deletion, archive-copy ordering and metadata, preservation of the source on copy failure, and idempotent missing-object archival. These tests establish compatibility of existing helper behavior; they do not establish live bucket privacy, video seeking or production integration behavior.

Frozen-lockfile installation passed with lifecycle scripts disabled. Under project Node 24.22.1:

- TypeScript, frontend/standalone server build, Worker build and SEO checks passed.
- The full suite reports **996 passed and the same 3 existing UI-contract failures**, across 192 files. All **33 critical-cycle files** passed. The failures concern subscriber-report rendering, Arabic renewal wording and finance-manager navigation; no existing assertion or business permission was changed to hide them.
- Rebuilt `dist/worker.js` and `dist/index.js` have exactly the same SHA-256 hashes as the pre-removal bundles from the preceding phase. This comparison covers these two outputs, not every frontend asset or external runtime dependency.
- Storage helpers, Worker entry point, API router, OAuth helpers and database schema match HEAD. The parsed production environment configuration also matches HEAD; earlier staging safeguards remain in the working tree.

The exact removed package/version inventory, bundle hashes and verification results are saved in `security_storage_dependency_audit_2026-10-24.json`. The refreshed repository-wide registry response is saved separately in `security_remaining_dependency_audit_2026-10-24.json`. It contains no AWS SDK/Smithy/XML-parser advisory entries. Its severity metadata still reports **4 critical, 37 high, 57 moderate and 14 low** findings. These are audit classifications across the dependency tree, including development tooling, not counts of exploitable production vulnerabilities.

The critical advisory records concern Vitest's UI server, two Tinypool prototype-pollution gadgets and proxy-addr trust-subnet handling. Applicability still requires checking how those features and prerequisites are used. The next small phase is Express/proxy-addr usage and compatible remediation, followed by a separately validated Vitest/Tinypool tooling phase.

## Remaining release gates

No deployment, live upload/deletion, database migration or production configuration change occurred. Previously deployed files and package-manager caches are not certified by pruning the local lockfile. Local builds use static/curated SEO inputs with external article fetching disabled and must be rebuilt with intended production inputs before release.

Staging resource isolation, representative browser/Cloudflare integration checks, provider/runtime verification, the three existing UI-contract failures and other dependency advisories remain open. This removal does not clear the entire website.
