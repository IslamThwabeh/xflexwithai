# Project conventions

- Read `.codex/project-memory.md` for current project context and use the linked feature documents for detailed release history.
- The academy is based in Palestine. Default new academy copy, customer messages, emails and location/time labels to **فلسطين / Palestine**.
- Reuse `shared/academyLocale.ts` for academy country labels and customer notification times. The default business timezone is `Asia/Hebron`, which follows Palestine's seasonal clock changes. Do not use Jordan/Amman or a fixed UTC offset as the academy's messaging default.
- Keep stored UTC timestamps, existing schedules and explicit user/report timezone choices intact unless the task specifically changes them. Convert customer-facing times for display using the academy default.
- Keep internal deployment identifiers, recovery details and private project-memory content out of support-AI knowledge and student-facing copy.
