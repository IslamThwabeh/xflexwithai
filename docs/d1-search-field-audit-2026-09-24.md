# D1 search-field and automatic-refresh audit

Audit date: 2026-09-24  
Scope: production React/tRPC paths that accept free-text search, plus browser-only filters that do not issue a search query.

## Result

- No remote search is intended to poll while search text is active.
- Support inbox already suspends its 60-second refresh during search.
- LexAI case search previously repeated an active wildcard search every 15 seconds. The 2026-09-24 change disables interval and window-focus refetch while search text is active.
- Email-log text filters run only when **Apply search** is pressed. Only the small outbox-health query refreshes automatically.
- Several administrative fields still query once per keystroke. They are not background loops, but should receive debounce/minimum-length guards in a later low-risk change.

## Phase 1 implementation status (2026-09-24)

- `supportDashboard.searchClients` now executes a database-side lookup selecting only ID, email, name, phone, and creation time, with a hard maximum of 50 rows.
- The route rejects trimmed searches shorter than two characters and no longer calls `getAllUsers()`.
- The production Worker change is deployed as version `b1d1cf49-365c-47f1-adb7-9dcdbf207281`.
- The frontend source now uses a 400 ms debounce and disables interval, background, and window-focus refetch. The production Pages build is pending because the local Vite process was terminated during transformation; no stale frontend artifact was deployed.

## Phase 2 implementation status (2026-09-24)

- Support lookup now uses prefix ranges instead of leading-wildcard matching, backed by expression indexes for normalized email, normalized name, and phone. Migration 130 completed with 919 rows read and 459 rows written; no application records were changed or deleted.
- Production Worker version `d527b4ef-db3b-47e3-b03a-95a12dbd4db2` serves the indexed prefix query.
- A shared 400 ms/two-character search hook is applied in source to onboarding records, broker reporting, recommendation history, community members, and the loyalty-points picker.
- Recommendation history, community-member search, and the points picker also explicitly disable interval, background, and focus refetch in source.
- The Phase 2 frontend source is tested but its Pages deployment remains pending because the local Vite build process was terminated during transformation. Production backend validation remains backward-compatible until the coordinated frontend/API deployment.

## Phase 3 implementation status (2026-09-24)

- All identified manual remote-search queries explicitly disable interval, background, and window-focus refetch. Support inbox keeps its normal visible-page refresh only when no search is active.
- API boundaries enforce a trimmed two-character minimum for global search, LexAI cases, support inbox, recommendation history, community members, engagement students, onboarding records, broker reporting, support client lookup, and loyalty-points lookup.
- Email delivery log text filters remain explicit **Apply search** actions and no longer refetch on focus; their operational health query remains intentionally separate.
- All Phase 2 and Phase 3 frontend/API changes are being held for one coordinated Pages + Worker deployment so the stricter API validation cannot precede its matching UI.

## Searches that reach D1

| Screen / endpoint | Searchable fields | Trigger and current guard | Automatic repeat | Risk / follow-up |
|---|---|---|---|---|
| Public global search (`search.public`) | Course title/description EN+AR; package name/description EN+AR; article title/content EN+AR; event title/description EN+AR | 300 ms debounce, minimum 2 characters, 20 results/type | No interval | Broad `%text%`; keep manual-only |
| Admin global search (`search.admin`) | User email/name/phone; order ID/status; course title EN+AR; article title EN+AR; registration key/email | 300 ms debounce, minimum 2 characters, 20 results/type | No interval | Broad search across five tables; keep manual-only |
| Support inbox (`supportChat.inboxPage`) | Client name/email; support-message content from last 90 days | 300 ms debounce, minimum 2 characters, 30 results | Polling stops during search | Protected |
| Support new conversation (`supportDashboard.searchClients`) | Client email/name/phone | 250 ms debounce, minimum 2 characters, returns 50 | No interval | Backend currently loads all users before filtering; replace with bounded SQL query |
| LexAI support cases (`lexaiSupport.listCases`) | Client name/email | 250 ms debounce, minimum 2 characters after this change | **Disabled during search** after this change | Protected from repeated search; wildcard query remains manual |
| Recommendation history (`recommendations.threadMessages`) | Root message ID, symbol, side, root content, reply content | On input change; paginated | No interval | Add 400 ms debounce and minimum 2 characters |
| Loyalty points student picker (`points.searchStudents`) | Student name/email | Minimum 2 characters, 12 results | No interval | Add debounce; already bounded server-side |
| Community member access (`community.adminMembers`) | Member name/email | Only when live controls are opened; paginated | No interval | Add debounce and minimum 2 characters |
| Engagement event students (`engagement.eventUsers`) | Name/email/phone/user ID | Search is committed after a 250 ms delay; paginated | No interval | Acceptable; date/event filters bound the dataset |
| Broker onboarding records (`onboarding.recordsPage`) | Client name/email; broker name EN+AR | On every input change; 25-row page | No interval | Add debounce and minimum 2 characters |
| Broker report (`onboarding.report`) | Broker name EN+AR | On every input change; 25-row page | No interval | Add debounce and minimum 2 characters |
| Email delivery logs (`adminEmail.deliveryLogs` and summary) | Recipient; event type, plus status/category/date filters | Explicit **Apply search** button; paginated | No search polling | Protected; health-only polling does not run delivery-log search |

## Browser-only filters (zero extra D1 reads while typing)

These screens load their dataset once and filter it in React: LexAI subscriptions, recommendation subscriptions, package keys, legacy plan progress, offer agreements, terms acceptance, subscriber report, admin roles/staff lists, notification recipient selection, and other table filters implemented with `Array.filter`/`useMemo`.

They may still incur the original page-load query, but typing in their search boxes does not perform additional D1 reads.

## Recommended follow-up order

1. Replace `supportDashboard.searchClients` full-user loading with a direct SQL `WHERE ... LIMIT 50` query.
2. Add a shared 400 ms debounce and two-character minimum to onboarding records, broker report, recommendation history, community member search, and the points picker.
3. Explicitly set `refetchOnWindowFocus: false` on all manual search queries so tab switching cannot repeat a completed search.
4. Re-measure D1 rows read for one complete UTC day before considering indexes. Leading-wildcard searches generally cannot use ordinary B-tree indexes effectively, so behavior guards are safer than adding speculative indexes.
