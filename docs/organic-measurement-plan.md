# XFlex Organic Acquisition Measurement Contract

Status: Phase 1 implementation

Scope: acquisition journeys only. Admin, student dashboard, courses, support, orders, community, recommendations, and other authenticated application routes are excluded from application-owned GA4 events.

## Decision this measurement supports

Determine which unpaid Google, Bing, and AI-search visits produce meaningful interest in XFlex, and which landing pages or topics should be improved next. Search Console is the source of truth for Google impressions, queries, positions, and clicks; GA4 is the source of truth for behavior after the visitor reaches the site.

## Primary outcomes

| Event | Definition | Count as a key event? |
| --- | --- | --- |
| `generate_lead` | The public contact form was accepted successfully by the application. | Yes |
| `sign_up` | A new website account was created successfully. | Yes |
| `order_request` | The application created an order request successfully. This is not a completed payment or purchase. | Yes |

The primary business KPI is the number of these events attributed to unpaid search, split by landing page, language, country, device, and AI referrer where available. Do not combine them into a single GA4 event; preserve the outcomes so their quality can be compared.

## Diagnostic events

| Event | Definition | Important parameters |
| --- | --- | --- |
| `page_view` | One manually controlled view of an eligible public/acquisition route. | `page_type`, `content_language`, `ai_referrer` |
| `view_item` | A real package-detail response was rendered. | GA4 `items`, `currency=ILS`, `value` |
| `select_item` | A visitor selected a package link. | package `item_id`, list name |
| `registration_start` | The registration form was opened for the first time in that page instance. | method, language |
| `begin_checkout` | A valid package loaded on the checkout route. | GA4 `items`, `currency=ILS`, `value` |
| `contact_click` | The visitor selected WhatsApp, email, phone, or the contact page. This is intent, not a completed lead. | `contact_method`, language |
| `select_content` | A registration CTA was selected. | `content_type=registration_cta` |

`purchase` is deliberately not emitted when an order is created because payment has not been confirmed. No event sends names, email addresses, phone numbers, message contents, passwords, order IDs, user IDs, coupon codes, or arbitrary URL query parameters.

## Attribution and privacy guardrails

- Page URLs sent by application code keep only standard UTM and Google click identifiers. Parameters such as `email`, `ref`, `next`, and unknown query values are removed.
- Ordinary Bing search referrals remain Bing traffic; only Bing chat/copilot paths are labelled `copilot`.
- Google advertising and personalization signals are disabled in the site configuration.
- GA4 automatic initial page views are disabled because the application sends controlled SPA page views.
- In GA4 Data Stream settings, **Page views on browser history changes must also be disabled**. Google documents that Enhanced Measurement can otherwise send history-based page views even when `send_page_view` is false, causing duplication and potentially recording private SPA transitions.
- Firm traffic or conversion targets will be set only after one complete 28-day Search Console/GA4 baseline.

## GA4 account setup after release

1. In Admin → Data streams → the XFlex web stream → Enhanced measurement → Page views → advanced settings, disable **Page changes based on browser history events**.
2. In Admin → Events, mark `generate_lead`, `sign_up`, and `order_request` as key events after they first arrive.
3. Register event-scoped custom dimensions for `content_language`, `page_type`, `ai_referrer`, `lead_source`, and `contact_method` if these breakdowns are needed in standard reports.
4. Validate a page view and a safe click in Realtime/DebugView. Do not submit synthetic production contact forms, registrations, or orders for measurement testing.
5. Link Search Console to GA4 when the property is ready, while keeping each product's different metric definitions intact.

## Initial review cadence

- First 48 hours: confirm collection, duplicates, private-path exclusion, and parameter safety.
- Day 7: directional landing-page and event check; do not make ranking claims.
- Day 28: establish the first reliable baseline and agree on targets.
- Monthly: review non-branded clicks, primary outcomes, drivers, and data-quality guardrails.

Official implementation references: [GA4 recommended events](https://support.google.com/analytics/answer/9267735), [GA4 page-view control](https://developers.google.com/analytics/devguides/collection/ga4/views), and [Search Console versus GA4](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console).

