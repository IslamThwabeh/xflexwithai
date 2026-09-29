# Staff Notification Archive Automation Runbook

Status: implemented locally as disabled-by-default automation. Do not enable in
production until after the combined optimization deploy is verified and a fresh
D1 guardrail sample leaves enough write headroom.

## Scope

- Eligible rows: `staff_notifications` with `eventType` in
  `new_support_message` or `human_escalation`.
- Retention: at least 30 complete days old.
- Operation: sets `archivedAt`, `archiveReason`, and `archiveBatchKey`.
- Not allowed: hard deletes, support message cleanup, order/payment cleanup,
  recommendation cleanup, user cleanup, or changing unread/read state.
- Rollback: use `rollbackStaffNotificationArchiveBatch` with the exact
  `archiveBatchKey`.

## Production Defaults

`wrangler-worker.toml` keeps all environments safe by default:

- `STAFF_NOTIFICATION_ARCHIVE_ENABLED = "false"`
- `STAFF_NOTIFICATION_ARCHIVE_DRY_RUN = "true"`
- `STAFF_NOTIFICATION_ARCHIVE_RETENTION_DAYS = "30"`
- `STAFF_NOTIFICATION_ARCHIVE_BATCH_LIMIT = "50"`

With these defaults, deployment alone cannot archive records.

## Enablement Sequence

1. Deploy with defaults and verify production health.
2. Run at least one full D1 guardrail sample.
3. Set `STAFF_NOTIFICATION_ARCHIVE_ENABLED = "true"` and keep
   `STAFF_NOTIFICATION_ARCHIVE_DRY_RUN = "true"`.
4. Let the daily maintenance cron report candidate counts without mutation.
5. If candidate counts and D1 write headroom are acceptable, set
   `STAFF_NOTIFICATION_ARCHIVE_DRY_RUN = "false"`.
6. Keep `STAFF_NOTIFICATION_ARCHIVE_BATCH_LIMIT` small, ideally `50`, until
   multiple days verify cleanly.
7. Record each batch key from logs. The default key is
   `staff-support-archive:YYYY-MM-DD`.

## Stop Rules

Stop and revert to dry-run if any of these happen:

- D1 writes approach the free-plan safety budget.
- Active staff badges include archived rows.
- Archive history fails to load.
- Support notifications disappear from active views before the 30-day cutoff.
- Any staff workflow reports missing current notifications.

## Rollback

Rollback is batch-scoped and non-destructive:

```ts
await rollbackStaffNotificationArchiveBatch({
  batchKey: "staff-support-archive:YYYY-MM-DD",
  limit: 50,
});
```

Repeat with the same batch key until `restoredCount` is `0`.
