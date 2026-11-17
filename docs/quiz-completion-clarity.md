# Quiz completion clarity

## Behavior

The quiz overview previously showed a prominent “إعادة الاختبار” action even when a level was passed. Passed levels now lead to saved results. Scores below 100% show “تم اجتيازه” and a secondary optional redo action. A passed best score of 100% shows “العلامة الكاملة”, explains that no redo is needed, and removes the redo prompt from the overview and attempt history. History uses the best saved result, so a later lower attempt does not restore the prompt. A newly submitted 100% result also omits redo. This is presentation behavior; server access and submission rules remain unchanged. The successful submission screen prioritizes returning to the overview and confirms the saved pass. Result screens reserve mobile bottom-navigation space. Failed attempts retain the retry action.

An explicit refresh button reuses the existing progress query. Both standalone and in-course quiz submissions invalidate the shared progress/history caches; standalone submission also invalidates cached episode quiz requirements. This prevents cached views from retaining pre-submission results. Existing server pass, unlock, watch, bypass and package rules remain unchanged. Empty quiz lists no longer display a completion message or divide by zero. Overview dates use the shared Palestine timezone.

## Cost and release

Frontend-only change; no backend SQL, schema, migration or production data repair. No new polling or background processing. Rendering has negligible expected CPU impact. Explicit refresh repeats the existing on-demand query (quiz catalog plus the account's indexed progress lookup); mutation invalidation marks inactive views stale and revalidates active views through existing endpoints. No new query shape or historical attempt scan is introduced. Worker deployment is unnecessary. Source `42b140e` was pushed and deployed to production Pages with owner approval on 2026-11-17.

## Verification

- TypeScript check and production application build passed using the project's Node 24.22.1 runtime.
- 17 existing quiz access/progress and lesson-completion regression tests passed.
- Isolated browser checks use synthetic API responses and do not submit real quizzes, send customer emails or alter student records. Evidence is ignored under `output/playwright/quiz-progress/`.
- Eleven browser check groups cover Arabic 1440/390/320 px with mixed passed/full-mark scores, explicit refresh, full-mark submission/return unlocking level 7, optional redo below full marks, failed submission retaining retry, four history states (including an older full score followed by a failure), and an empty list without false completion. Physical-device/Safari behavior and the real customer's browser session were not exercised.
- Post-deployment verification passed seven exact asset hashes, seven canonical/preview routes, private-page headers, API health and anonymous quiz-progress denial. All eleven synthetic browser groups passed on deployed assets, with zero page exceptions or unknown fixtures. Three quiz submissions were intercepted; no real customer attempts or emails were created.

The reported historical lock could not be reproduced from current persisted progress. Do not describe the cache change as proof of that historical cause. Account details and diagnostic findings belong in private operational context, not student-facing documentation or support-AI knowledge.
