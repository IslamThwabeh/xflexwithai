# Confirmed-payment key issuance incident — 2026-11-26

Status: local recovery/privacy hotfix prepared; production deployment and a real-order recovery attempt are not authorized yet. The broader finance batch and migration141 remain paused at the owner's request.

## Confirmed facts

- The owner reported a failed key INSERT while approving order206. The existing error response included Drizzle SQL and parameters, including customer information and a generated key. Do not copy that payload into documentation, support knowledge or messages.
- An approved read-only, in-place diagnostic returned payment-confirmed=true, linked-key-count=0, and another-matching-active-unused-key=false. It made zero writes. These describe the diagnostic snapshot, not a guarantee about subsequent changes or the state at the exact original failure time.
- A production EXPLAIN using entirely synthetic INSERT values compiled successfully: zero rows read/written and changed_db=false. EXPLAIN does not execute the INSERT and does not prove that it would succeed against production data.
- Equivalent synthetic issuance using the actual createPackageKey implementation succeeded in both local SQLite and Cloudflare's installed local D1 runtime. Each created exactly one key, configuration-audit row and delivery job. No real customer record, message provider or production mutation was involved.
- The underlying production INSERT failure is **unconfirmed**. The screenshot omits Drizzle's nested cause, and the previous server log recorded only issuance_failed. Do not describe an unused-key conflict, schema defect, transient D1 failure or the latest release as the established cause.

## Local changes

- Return a fixed, actionable confirmed-payment/key-pending response; retain the cause internally and log only fixed failure categories and error-name/code metadata. Never log SQL, parameters or arbitrary cause messages in this path.
- Sanitize raw database messages at the tRPC boundary even when a route wraps them as BAD_REQUEST, CONFLICT or PRECONDITION_FAILED. Preserve deliberate safe application messages with database causes.
- Translate the approval recovery message into Arabic and hide details from the older response during rollout overlap. Show one accessible inline alert instead of a duplicate mobile-footer-covering toast.
- Update the open dialog's payment-confirmed snapshot and clear payment-entry fields after that definitive server response. Offer key-only retry and preserve the chosen key configuration. Existing immutable payment confirmation/idempotency checks remain authoritative on the server.
- No new queries, polling, tables, migrations, automatic approval retries or historical rewrites. Error classification runs only on failures. The isolated seven-file source is based on the deployed commit and excludes paused finance and unrelated staff/navigation work.

## Validation and remaining steps

- 98 distinct focused tests in seven files passed:87 error/retry/delivery/policy cases plus11 actual payment-confirmation SQL, approval-authority and fulfillment cases. TypeScript, app/server/Worker builds and SEO/private-route checks passed. The final server/Worker builds include the safe SQLite diagnostic-code extraction.
- Final80 synthetic browser assertions passed in Arabic/English at1440/390/320px, covering the old leaking API response and the new fixed message. Verified one initial attempt, explicit key-only recovery without financialPayment, preserved30-day configuration, no raw SQL/customer/key leakage, no duplicate toast, viewport fit, no unknown API requests and no browser application exceptions. Twelve intercepted synthetic approval attempts; no real messages or orders. Visually inspected final Arabic390/320px screenshots; physical Safari remains unverified.
- Local evidence and exact source/artifact hashes belong in ignored output/hotfix-order-206/; synthetic screenshots/checks in output/playwright/key-issuance-hotfix/. A rejected customer/order-metadata export was not executed; the permitted in-place redacted diagnostic was used instead.
- Before release: freeze the isolated source, obtain approval for this separate hotfix's commit/push and Worker→Pages deployment/private rollback metadata. Do not include or apply migration141.
- Before any real retry: obtain explicit approval to issue/deliver order206's actual key, including the workflow's email and private support message. Recheck saved payment/key state first; do not create or alter cash confirmation. If a key now exists, inspect/reuse the saved state rather than creating another. A fresh failure should be diagnosed from the new safe category/code metadata.
- Keep the broader follow-up plan paused until this incident is resolved or the owner directs otherwise. Final memory reconciliation and both Arabic WhatsApp drafts remain pending.
