---
description: "Use when editing XFlex frontend pages, layouts, navigation, bilingual UI, Tailwind styling, public pages, or student dashboard experiences."
name: "XFlex Frontend Rules"
applyTo: "frontend/src/**"
---

# XFlex Frontend Rules

- All user-facing text should have Arabic and English variants.
- Mobile-first matters: business-owner review happens heavily on mobile, so avoid desktop-only layouts.
- Use the March 2026 visual system: emerald/teal/amber/cream. Do not introduce blue, purple, or indigo accents.
- Primary gradients: `from-emerald-500 to-teal-600`. Accent gradients: `from-amber-400 to-orange-500`. Focus rings should stay emerald.
- `ClientLayout` header stays `dir="ltr"`; content containers switch with `dir={isRTL ? "rtl" : "ltr"}`.
- In Arabic, do not end a sentence with the word `XFlex`; rephrase so the sentence ends with Arabic text.
- Student navigation order: Dashboard, LexAI, Recommendations, Support, Quizzes, My Package, Brokers, Notifications, Points, Calculators.
- Admin sidebar sections: Overview -> Sales -> Recommendations -> LexAI -> Learning -> Content -> Students -> Team -> Reports -> Moderation -> Careers.
- Standalone admin services like Recommendations and LexAI should live as their own top-level sidebar sections instead of being nested under Team.
- `AdminClientProfileSheet.tsx` is the shared client-context surface for `AdminStudents`, `AdminSupport`, and `AdminLexai`; do not duplicate large service-context cards across those pages.
- `/admin/lexai` should stay conversation-first: queue + conversation + compact client snapshot, with deeper service/timeline context opened from the shared client profile.
- `StudentPackages.tsx` is the merged package + subscriptions page; subscriptions should redirect there rather than creating a separate nav item.
- `WhatsAppFloat` only appears on the approved public-path whitelist.
- Display episode duration with `Math.floor(duration / 60)` because the DB stores seconds.
- On all video elements, include `controlsList="nodownload"` and block the context menu.
- LexAI image thumbnails should stay compact and open the full image in a new tab.
- `ClientLayout.tsx` should track real user interaction with `users.touchInteraction`; passive polling like unread-count refreshes must not be treated as active presence for recommendation email suppression.
- Student language toggles that affect backend messaging should be persisted, not left only in localStorage, so recommendation emails can follow the student's chosen language with Arabic as the fallback.
- Recommendations UI is thread-based and chat-first: `recommendations.notifyClients` reopens the chat after a 60-second wait, while `update` and `result` render as children under the parent recommendation and each analyst message refreshes the 15-minute silence timer.
- Recommendation thread unfollow is a per-thread mute control on the student side: keep the root thread visible, add the action on the Recommendations page, and use the dashboard only for a light reminder rather than a second management surface.
- Muted recommendation threads should suppress only future `update` / `result` follow-ups; the original recommendation stays visible, and email CTAs should return through authenticated `/recommendations?threadAction=unfollow&threadId=...` flows.
- Recommendation cards must stay mobile-safe: badge rows should wrap or stack cleanly, child threads should use lighter indentation on phones, and trade details should not duplicate the message body.
- Recommendations results are created only from `Add Result` on an existing recommendation; there is no standalone `Result` publish type.
