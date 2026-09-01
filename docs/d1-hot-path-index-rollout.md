# D1 hot-path index rollout

This runbook applies only `database/migrations/081_d1_hot_path_indexes.sql` to
the production D1 database. It must not be combined with the historical
migration directory because Wrangler migration tracking is not configured for
this repository.

## Safety properties

- Six additive `CREATE INDEX IF NOT EXISTS` statements only.
- No table rebuild, row update, deletion, deduplication, or uniqueness change.
- Safe to run again if the deployment response is lost.
- Migration SHA-256:
  `F6F6CE6B06F4D7FB121336267B2D91B4599B7DD440DCFF070D2183E1B09C4606`.
- Production contains duplicate `(userId, episodeId)` progress rows; both
  episode indexes are deliberately non-unique.

## Pre-change checks (read-only)

```powershell
npx wrangler whoami
Get-FileHash ".\database\migrations\081_d1_hot_path_indexes.sql" -Algorithm SHA256
npx wrangler d1 time-travel info xflexwithai-db --json
npx wrangler d1 execute xflexwithai-db --remote --command "PRAGMA index_list('supportConversations'); PRAGMA index_list('supportMessages'); PRAGMA index_list('episodeProgress');"
```

Save the Time Travel bookmark in the deployment record. Time Travel is a
last-resort full-database recovery tool, not the normal index rollback.

## Apply (requires separate production approval)

```powershell
npx wrangler d1 execute xflexwithai-db --remote --file ".\database\migrations\081_d1_hot_path_indexes.sql"
```

Do not deploy a Worker or Pages build for this index-only change until the
database verification below succeeds.

## Verify (read-only)

```powershell
npx wrangler d1 execute xflexwithai-db --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_support_conversations_updated_id','idx_support_conversations_status_updated_id','idx_support_messages_conversation_created_id','idx_support_messages_unread_client','idx_episode_progress_user_course_watched','idx_episode_progress_user_episode') ORDER BY name; EXPLAIN QUERY PLAN SELECT id FROM supportMessages WHERE conversationId=1 ORDER BY createdAt DESC,id DESC LIMIT 1; EXPLAIN QUERY PLAN SELECT * FROM episodeProgress WHERE userId=1 AND courseId=1 ORDER BY lastWatchedAt; EXPLAIN QUERY PLAN SELECT * FROM episodeProgress WHERE userId=1 AND episodeId=1 LIMIT 1;"
```

Expected plans name the new composite indexes and no longer report a temporary
B-tree for the support latest-message query or a full `episodeProgress` scan.

After verification, record the manual application:

```powershell
npx wrangler d1 execute xflexwithai-db --remote --command "INSERT OR IGNORE INTO schema_migrations (migration_name,source,notes) VALUES ('081_d1_hot_path_indexes.sql','manual','Reconciled production support and episode progress hot-path indexes');"
```

## Index-only rollback

Use this only if production query plans or writes regress after application.
It removes indexes without changing application data:

```powershell
npx wrangler d1 execute xflexwithai-db --remote --command "DROP INDEX IF EXISTS idx_support_conversations_updated_id; DROP INDEX IF EXISTS idx_support_conversations_status_updated_id; DROP INDEX IF EXISTS idx_support_messages_conversation_created_id; DROP INDEX IF EXISTS idx_support_messages_unread_client; DROP INDEX IF EXISTS idx_episode_progress_user_course_watched; DROP INDEX IF EXISTS idx_episode_progress_user_episode; DELETE FROM schema_migrations WHERE migration_name='081_d1_hot_path_indexes.sql';"
```

Re-run the application health, D1 connectivity, admin support inbox, course
progress, and recommendation queue smoke checks after either apply or rollback.

## Production execution record — 2026-08-10

- Cloudflare account: `79e9ff531db92d17c6579430b86a5f3c`.
- Database: `xflexwithai-db` (`cf374361-2caa-4597-a38d-5cecced7827d`).
- Local SQL backup:
  `tmp/prd-backups/xflexwithai-db-before-081-20260810-112933.sql`.
- SQL backup size: `246847292` bytes (`235.41 MiB`).
- SQL backup SHA-256:
  `853F6F3CF858ED9E9114A399C5543817DD68720703E51DBC55016011DF9C0E88`.
- Local restore-check database:
  `tmp/prd-backups/xflexwithai-db-before-081-20260810-112933.restore-check.sqlite`.
- Restore-check size: `220139520` bytes (`209.94 MiB`).
- Restore validation: SQLite `integrity_check` returned `ok`; restored counts
  included 93 support conversations, 13,518 support messages, 1,156 episode
  progress rows, and 19,471 staff notifications.
- Pre-change Time Travel bookmark:
  `0000106e-0000014c-000050c3-5288ca43baa54ad3e18478d3881b8301`.
- Migration final bookmark:
  `0000106e-00000152-000050c3-f0fe243c494aa0f9c101018712dac5d7`.
- Migration execution: six queries completed successfully in `67.97 ms`.
- Verification: all six indexes were present and all four representative query
  plans selected their intended composite index.
- Data preservation: episode progress duplicates remained unchanged at 57
  groups and 64 extra rows.
- Support inbox measurement: the PII-free production query shape read 804 rows,
  compared with the previous 33,912-row average (approximately 97.6% fewer).
- Smoke checks: `/health`, `/api/test/db`, the public site, admin support, and
  student support all returned HTTP 200.
- Audit record: `081_d1_hot_path_indexes.sql` was inserted into
  `schema_migrations` with source `manual` after verification succeeded.

## Production execution record — 2026-09-01 (migration 096)

- Cloudflare warned that daily Free-plan D1 reads had reached 81% of the
  5,000,000-row allowance. The reset was scheduled for 2026-09-02 00:00 UTC.
- The rolling production snapshot showed 5,526,290 rows read. The largest
  measured two-hour query was staff-notification deduplication: 416,892 rows
  across 21 executions, averaging about 19,852 rows per execution.
- Pre-change Time Travel bookmark:
  `000011a3-00000000-000050d9-56ba42c2c6c608f984a64e018d66917b`.
- Migration `096_d1_remaining_hot_path_indexes.sql` added seven non-unique,
  idempotent indexes for staff notification deduplication/listing, support
  edit/delete/unread changes, enrollment ownership, and points history.
- Migration SHA-256:
  `F3DD074446E4D54193EC091DB140A9C664BAA2629BD179AB0EE97B5E26FFE18F`.
- D1 executed all seven statements in 678.53 ms, reading 146,624 rows and
  writing 49,029 index entries. It was recorded as `schema_migrations.id = 37`
  with source `codex_wrangler` only after all seven production query plans
  selected the intended indexes.
- The direct post-release deduplication probe read one row and completed in
  0.12 ms, down from the prior approximately 19,852-row average.
- Incremental support changes now use three bounded, indexable branches and
  deterministically merge/deduplicate at most 200 messages. Indexed email
  lookups use the normalized stored email rather than applying functions to
  the indexed database column.
- Visible-tab polling changed from 5 to 15 seconds for active support changes,
  8 to 30 seconds for the admin support inbox, and 30 to 120 seconds for client
  notification and staff badge/list refreshes. Mutations and window focus
  still refresh immediately; background tabs do not poll.
- Scheduled Free-plan work is bounded: one recommendation provider batch per
  minute, lower-priority lanes rotate across minutes, survey materialization is
  capped at 10, health checks are reduced, and timed-service repair processes
  one cursor-selected user per five-minute invocation.
- Verification passed TypeScript, the Worker build, the production application
  build, the new D1 contract tests, and all 185 critical-cycle tests across 33
  files. Worker health, database health, Pages preview, and the production
  domain returned HTTP 200.
- Worker version: `13afcbd0-2641-41c4-b4cf-23f1c751462e`. Pages deployment:
  `1223c794-49cf-4311-9bcc-1567b85868e9`.
- Final Time Travel bookmark:
  `000011a5-00000014-000050d9-9ea752aa11d71bd3ddad73583ecb7cba`.
- Two full `user_notifications` composite indexes were deliberately deferred.
  Production already has `idx_user_notifications_user_id`, and telemetry read
  exactly 50 rows for a 50-row history page. With 37,389 notification rows and
  70,715 rolling writes already consumed, either full index could cross the
  100,000-row write limit. A partial unread index would cover 24,383 rows and
  leave inadequate operational headroom, so it was also not applied.
