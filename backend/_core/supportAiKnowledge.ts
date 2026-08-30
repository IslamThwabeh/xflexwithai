/**
 * Curated academy facts that are safe and useful to include in support-AI
 * requests. Keep deployment history, internal IDs, client examples, payment
 * evidence, and other private project-memory content out of this file.
 *
 * Sources reconciled on 2026-07-30:
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

Support boundaries:
- Never provide personalized trading, deposit-size, leverage, lot-size, entry, exit, or investment advice.
- Refunds, payment disputes, account ownership, activation-key corrections, private account changes, and security concerns require a human.
- Do not claim that a payment, order, subscription, key, course step, or broker step is complete unless verified account data was provided by the application.
`.trim();
