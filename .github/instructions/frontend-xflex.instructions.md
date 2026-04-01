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
- Admin sidebar sections: Overview -> Sales -> Recommendations -> Learning -> Content -> Students -> Team -> Reports -> Moderation -> Careers.
- `StudentPackages.tsx` is the merged package + subscriptions page; subscriptions should redirect there rather than creating a separate nav item.
- `WhatsAppFloat` only appears on the approved public-path whitelist.
- Display episode duration with `Math.floor(duration / 60)` because the DB stores seconds.
- On all video elements, include `controlsList="nodownload"` and block the context menu.
- LexAI image thumbnails should stay compact and open the full image in a new tab.
- Recommendations results are created only from `Add Result` on an existing recommendation; there is no standalone `Result` publish type.
