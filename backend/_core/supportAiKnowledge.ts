/**
 * Curated academy facts that are safe and useful to include in support-AI
 * requests. Keep deployment history, internal IDs, client examples, payment
 * evidence, and other private project-memory content out of this file.
 *
 * Sources reconciled on 2026-09-06:
 * - .codex/project-memory.md (Package Key Lifecycle Rules)
 * - package seed/configuration and timed-service activation implementation
 * - public English/Arabic academy copy
 */
export const SUPPORT_AI_ACADEMY_KNOWLEDGE = `
Academy and package facts:
- XFlex Trading Academy is a Palestinian online trading academy serving students in Arabic and English.
- Rawan is the founder. She is Palestinian and holds a Master's degree in Accounting from Birzeit University.
- Course access included with an activated package is permanent; the course itself does not expire.
- Basic includes permanent course access plus time-limited Recommendations.
- Comprehensive includes permanent course access plus time-limited Recommendations and LexAI.
- LexAI is not included in Basic.
- Standard staff-facing package prices are Basic ₪700 and Comprehensive ₪1,700. Standard renewal prices are Basic ₪175 and Comprehensive ₪350. If a student's order shows a different stored amount, do not contradict it; ask support to review the order.

Live Package facts:
- Live Package (بكج لايف) is a standalone, fixed-cohort program. It is separate from Basic and Comprehensive and is not a renewal or upgrade of either package.
- Its planned program format is four live sessions weekly for three months: two educational sessions and two live trading/analysis sessions. Never invent exact session dates or promise future sessions; the approved schedule shown in the student's Live Package workspace is authoritative.
- The account-based one-time price is ₪2,000 for a new customer, ₪1,000 for a customer whose latest qualifying previous package was Basic, or ₪350 for a customer whose latest qualifying previous package was Comprehensive. These prices include VAT. The signed-in checkout quote is authoritative for the individual account.
- Live Package purchases are non-refundable, have no renewal path, cannot be bought as a gift, and do not promise access to future cohorts.
- Visibility and registration can be opened or closed by the academy. Never claim registration is currently open based only on this knowledge; direct the student to the localized Live Package details page to see the current status.
- An entitled student opens /live-package to see the cohort schedule, join an eligible scheduled session, and watch published protected recordings. If the cohort has not started, the workspace may correctly say that the schedule will be announced and no action is required yet.
- Published recordings remain available permanently unless the entitlement is revoked or refunded. Meeting links are protected and appear only through the eligible Join session action; never provide or invent a Zoom link.
- Account-specific price tier, entitlement, schedule, join eligibility, and missing access must be verified from the student's account; never guess them.

Activation and renewal facts:
- A new package purchase creates an order-linked, email-bound activation key after approval. The student redeems the key to start package and course access.
- If activation says a key is waiting for a matching completed order, the key is not usable yet. Support must check Order Management and the customer's existing keys; never advise generating another key when an unused matching key already exists. If the completed order already issued a key, direct the customer to that original order-linked key.
- If that original order-linked key is unused but its redemption deadline passed, an authorized operator should extend the deadline through the audited key-settings control. Do not create a replacement key merely to change the redemption deadline.
- When the student is already speaking inside the support chat, do not tell them generically to "contact support." Explain that the support team is checking the order/key link and state the next verified action without claiming it is complete.
- The duration of LexAI and Recommendations is configured on the student's key/order. Do not assume every student has exactly 30 days.
- For a fresh package, timed services wait until both readiness gates are complete: course completion (or an approved course skip) and broker onboarding completion (or an approved broker skip).
- If the readiness gates are not completed first, timed services activate at the configured protection deadline. When activated, the student receives the full configured service duration.
- Renewal extends the time-limited services. It does not renew the permanent course.
- Basic renewal extends Recommendations. Comprehensive renewal extends Recommendations and LexAI.
- Account-specific activation dates, expiry dates, keys, payments, and eligibility must be verified from the student's account; never guess them.

Course and quiz facts:
- The course has eight learning levels with checkpoint quizzes. Not every lesson has a quiz.
- An intermediate lesson without a quiz should not be blocked merely because no quiz appears.
- If a lesson stays locked, first ask the student to complete/mark the previous lesson. At a real level checkpoint, the configured level quiz may need to be passed or explicitly bypassed through the supported flow.
- Missing playback tracking should not permanently strand a student; the platform can offer a confirmation flow for the previous lesson when no real quiz requirement is pending.

Other current platform features:
- Paid-course owners can open the protected Course Documents library at /documents. Qualifying course documents remain available permanently even if LexAI or Recommendations later expires. If paid course ownership exists but documents are locked, support must review the account.
- The public Free Starter Library is available at the localized /free-content page and does not require a paid package.
- Students upload or replace payment proof from the relevant Order Details page while the order is awaiting confirmation. Supported evidence is JPEG, PNG, WebP, HEIC, or PDF up to 10 MB. Payment approval and order status still require human verification.
- Support chat accepts text, screenshots/files, voice notes, and short videos. Automatic AI cannot inspect attachment contents; ask the student for a short text description. Support videos must be shorter than one minute.
- A student may edit or delete their own support-chat message. A deletion leaves a generic tombstone; deleted content cannot be restored.
- Notification troubleshooting should distinguish in-platform notifications from email delivery. Students can review notification preferences in Profile and open the relevant feature page directly.

Support boundaries:
- Never provide personalized trading, deposit-size, leverage, lot-size, entry, exit, or investment advice.
- Refunds, payment disputes, account ownership, activation-key corrections, private account changes, and security concerns require a human.
- Do not claim that a payment, order, subscription, key, course step, or broker step is complete unless verified account data was provided by the application.
`.trim();
