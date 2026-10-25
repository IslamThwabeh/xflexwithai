# Security maintenance notice and deployment gate

Owner instructions: notify all registered clients, staff and administrators from Support about security updates tonight, refresh/cache troubleshooting and dashboard Support chat. The owner explicitly selected **90% provider-confirmed delivery**, not opens or explicit acknowledgements, as the prerequisite for production release.

## Fixed audience

Snapshot: 25 October 2026, 17:35 UTC. 166 client accounts, eight staff accounts and one separate administrator account. One client account uses an invalid archived-account placeholder. The resulting audience is **174 unique valid addresses**. Required confirmation: **157 unique delivered addresses** (`ceil(174 × 0.9)`). Eleven addresses have permanent provider suppressions, which are preserved. They remain in the fixed denominator and are not treated as delivered. No marketing unsubscribe was present in this snapshot.

Private addresses and per-recipient evidence stay under ignored `.tools/security-notice-20261025/`; only counts are recorded here. Audience SHA-256: `0cf8477dd7e3056735945a9ba4e41eb96ac65497bcf1947a1aa4a927375ded7b`.

## Authorized notice

From: **support@xflexacademy.com**. Arabic subject: **تحديثات أمنية للموقع الليلة — 25 أكتوبر 2026**. English heading: **Website security updates tonight — 25 October 2026**. The bilingual message says security updates are planned tonight, Sunday 25 October, Amman time, in small stages. It asks recipients to refresh the page for errors, clear cached website files if necessary, and contact Support through dashboard chat if the problem persists. Link: `https://xflexacademy.com/support`. It does not promise a downtime duration or claim an incident.

The signed-in website announcement workflow created client batch **`batch_1792949980900_eq2un9`** at approximately 17:39 UTC for 166 client accounts. **155** client addresses were provider-accepted; the invalid placeholder and existing suppressions were excluded from sending. Provider acceptance is not confirmed delivery. The default workflow also created the corresponding in-app notification.

Staff/admin addresses are handled separately with per-address deduplication through the existing email outbox because the announcement target picker excludes them. This is an email operation authorized by the owner, not a security code/configuration deployment. Existing suppression flags remain unchanged. Final queue/delivery status will be appended after verification.

## Release gate

**Owner override, 25 October:** after confirming that the owner and team received the notice, the owner explicitly directed deployment after the required backups. This replaces the earlier 90% provider-verification prerequisite. It is an owner release decision, **not measured evidence that 90% of clients received the email**. The last measured snapshot was eight confirmed unique deliveries out of 174 selected addresses, with 163 provider-accepted addresses in total. The client BCC request has a delivered webhook for the primary mailbox but does not establish delivery to each client. No accepted campaign was resent.

- Match this subject/campaign to the fixed unique-address snapshot and provider request/reference identifiers.
- Count only recipient-specific provider delivery evidence. A successful API request, `sent`/accepted status or campaign notification badge is insufficient. A batch-level delivery acknowledgement without recipient coverage must not establish that every BCC recipient received it.
- Bounces, rejects, deferrals, suppressions, and addresses without delivery confirmation do not count. Do not resend an already accepted campaign merely because confirmations are missing.
- Original gate before the owner's override: no security commit/push/deployment until the 157-delivery threshold was established and confirmed. Under the explicit override above, deployment can proceed after new-candidate verification and required recovery evidence; provider delivery figures must continue to be reported accurately.
- Use the current support release as the rollback baseline. The previous archived security candidate is obsolete and must not be deployed.
