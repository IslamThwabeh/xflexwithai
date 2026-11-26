# Finance workspace reliability

Status: released and deployment-verified on November26. Follow-up items R13–R16 in [the session plan](admin-finance-follow-up-plan-2026-11-25.md).

## What changes

Financial Controls, Historical Reconciliation and Expenses have a separate **Refresh view** action and a Palestine-time snapshot label. Refresh verifies current access and rereads the relevant workspace. It does not build the historical review queue, submit a draft or record a financial decision. Queue-building retains its separate action.

Failed or unverified reads show an explicit retry screen. They do not render zero totals or an apparently empty register. Successful empty results remain distinguishable from denied access and network/server failures. Controls and reconciliation retain finance-owner/manager access; expense clerks retain their existing actor-filtered expense workspace.

Read keys and responses include the signed-in user ID and verified finance role. The server validates that scope before calling financial readers. The user ID is distinct from an administrator/finance-actor primary key. Old unscoped read calls remain compatible; Expenses adds a scoped workspace response without changing the legacy list-array response. Account changes remove other-account financial caches; verified role changes remove obsolete private reads and reset local correction/review drafts. A transient access-check failure hides the workspace but preserves a same-account draft for retry.

Manual-adjustment copy now explains that approval of an unallocated ledger adjustment does not automatically add it to the operating cash result. Receipt/refund/expense corrections belong in their source workflows. A shared four-purpose tuple aligns the payment-category UI/API with the database's existing Academy/Copier reclassification support. Forms default to the current category, require a real change and reason, and identify ledger IDs explicitly. Reclassification remains owner-only and does not change total cash or customer entitlements.

## Runtime and data impact

No migration, production repair, new dependency, polling or scheduler. Existing financial read implementations and row limits are reused. Reads happen on authorized entry, explicit refresh/retry or existing successful workflow invalidation; page focus rechecks authority without automatically refreshing an unchanged financial snapshot. Local cache freshness remains five minutes on re-entry, with the loaded time visible. These pages do not promise continuous live figures or independent bank reconciliation.

Read-only Refresh targets only its scoped workspace reads. Historical Refresh reads the preview and current queue; it does not invoke `materializeQueue`. Expense registration keeps the existing maximum of 100 displayed matching rows. Old financial writes, independent-review rules, period locks, append-only corrections and idempotency remain in place.

## Verification

Seven focused test files / 73 tests passed both in the working tree and in an isolated source copy excluding unrelated staff changes. Coverage includes authorization, account/role mismatches rejected before database reads, legacy compatibility, role-filtered expense reads, cache isolation without fetches, existing real-SQLite correction behavior and dashboard calculations. Isolated TypeScript, application/server/Worker builds and SEO/private-route checks passed.

The final artifact passed 65 synthetic Chrome assertions: 29 refresh/failure/empty/role/draft cases, 21 classification/copy/form cases, and 15 focus/responsive cases, including Arabic/English at 1440/390/320px. Focus revalidated authority without rereading an unchanged financial snapshot. Refresh issued one controls read, two historical reads, or one expense-register read; no financial mutation was sent. All fixture APIs were known and no browser exceptions occurred. Arabic 320px controls/reconciliation screenshots were inspected. No actual order, receipt, correction or expense was changed for QA. Evidence: `output/order-pricing-rounding/` and `output/playwright/order-pricing-rounding/`.

Deploy the Worker before Pages so the scoped responses are available to the new clients. Preserve all business records during a code rollback. Real signed-in production checks and physical mobile/Safari remain separate from local browser verification.


## November26 production verification

Production release verified November26: the approved49-file source plus supporting documents is committed/pushed; additive migrations139/140 are applied. Worker→Pages rollout passed11 Worker-stage and41 final read-only route/privacy/asset checks. Configuration/bindings/four schedules were preserved. No historical financial rewrite, real order cancellation, checkout or message was used for verification. Signed-in UI recheck of this combined release is pending because the Chrome connector is unavailable and no Chrome window is currently open. Earlier real student/admin reviews remain dated evidence.
