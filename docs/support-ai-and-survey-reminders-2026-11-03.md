# Support AI safeguards and survey reminder email pause

The owner requested that repeated questionnaire emails stop while website notifications remain available, followed by the first support AI reliability improvements discussed after an account-recovery case.

## Survey delivery

`student_surveys_email_reminders_enabled=false` disables automatic and manual reminder emails independently of in-app notifications. New-assignment emails retain their existing behaviour. An absent setting preserves the previous email behaviour.

The scheduler continues creating website notifications and advancing each assignment's existing reminder schedule. The delivery-time guard also suppresses reminder emails already queued before the pause. Survey activation, submissions, questions, assignment deadlines and the existing blocking policy are unchanged.

Production pause was applied on 3 November 2026. All three surveys remain active and all 524 answer records were retained. The anonymous response review found 38/76 general-feedback submissions, 19/40 community submissions and 6/20 broker submissions: 63 forms from 41 distinct students. Broker responses are too few and include respondents with no current broker, so they do not establish broker quality. The general expectations question permits multiple selections and has three multi-selection responses, including contradictory options; it must not be reported as an exclusive satisfaction percentage.

Ignored calculation evidence and source extracts are under `output/survey-review-20261103/` and `tmp/survey-*-20261103.json`. Raw answers and individual identifiers are not committed.

## Support behaviour

- A human escalation persists until a student explicitly resumes AI or staff clear the escalation. The old `support_ai_resume_minutes` setting no longer controls replies; the settings screen explains the manual handoff instead.
- Academy email/account recovery is identified before broker routing and receives an approved human-review response.
- Model-classified account changes, security requests and billing/refund requests require human review even if the model returns high confidence and `needsHuman=false`. The application replaces the proposed substantive answer with approved review copy.
- Low-confidence automatic model responses receive a safe handoff acknowledgement. Attachment-description acknowledgements retain their existing separate behaviour.
- Only student-authored messages can establish context for the deterministic broker-transfer rule. A model-generated broker-transfer answer without student-provided broker context is replaced by a clarifying question, preserving any existing escalation decision.
- Bot publication is conditional on the same user owning an open, non-escalated conversation, a valid client trigger, and no newer non-deleted message. This prevents a stale response appearing after a staff reply, a newer student message, account reassignment or closure, and prevents duplicate publication for the same trigger.
- The existing decision log records policy normalizations and suppressed publication. Staff still receive notifications for suppressed, failed and escalated cases.

This release does not add account-data tools, image reading, voice transcription, a new model, or automatic account/payment changes. It fixes the first routing and handoff defects and adds local regressions. No global error-rate reduction is claimed without subsequent measured production outcomes.

## Verification and recovery

Survey checks cover continued in-app reminders, schedule advancement, delivery-time suppression, assignment/support email isolation and restoring the reminder setting. Support checks cover account-recovery routing, legitimate broker migration, bot-history contamination, sensitive-intent enforcement, persistent handoff and conditional publication against disposable SQLite/D1 fixtures.

The survey-only production Worker is `5081df7b-0f06-477c-ae98-c4ab342a28c6`. Restore this version if reverting only the subsequent support AI release; it retains the email pause. Restoring a Worker from before this version would not honour the new reminder setting. Restore only compatible application code and preserve customer data.

Reminder emails can be resumed deliberately by setting `student_surveys_email_reminders_enabled=true`. Resuming does not reactivate previously suppressed queued messages or require changes to answers or survey assignments.

## Published release

- Final API Worker: `7263bad1-29e8-4bc0-bc9e-1664e3ae087a`.
- Pages production deployment: `dadeeeae-225b-488e-80bc-6d90855f2c5c`, https://dadeeeae.xflexwithai.pages.dev.
- TypeScript, application build and Worker build passed. The focused suite passed 113 tests across seven files; the repository critical cycle passed 218 tests across 33 files. Survey-only checks previously passed 82 tests across six files.
- Live API health and database-connectivity endpoints returned 200. Anonymous support inbox access returned 401.
- Live `AdminSettings-BvPiKkEI.js` returned 200 and matched the local tested asset's SHA-256: `3b03ea70138a236f72543c48d8a1dbb8b464afe74cc98ac2406337f8bcb77b3a`.
- Final D1 verification retained three active surveys and 524 answer records, with `student_surveys_email_reminders_enabled=false` and zero pending/failed/processing reminder emails.
- These artifacts were initially deployed from the reviewed working tree using the Pages dirty-source flag; the Pages source label `a07445a` identifies the checkout HEAD at deployment time, not a commit containing this change. The subsequent source checkpoint is recorded in Git history; the application artifacts do not need rebuilding solely to record that checkpoint.
- No synthetic production conversation, student message, survey answer, reminder or OpenAI request was created for validation. Local fixtures establish behaviour; longer-term production error-rate and workload changes remain unmeasured.

## Follow-up scope

The completed first release covers handoff persistence, sensitive-topic enforcement, broker-context isolation, publication guards and reminder-email control. Account-aware AI answers, richer staff summaries, screenshot reading and voice transcription remain future enhancements. Production support quality and workload should be observed before claiming a measured improvement.

Customer-specific access and email-recovery operations are recorded in production audit logs. Private source extracts, customer identifiers and one-off repair SQL remain local and are excluded from the source checkpoint. The recovered customer confirmed successful sign-in and restored access in support chat before closure review on 3 November 2026.
