# XFlex SEO Content and Measurement Playbook

## Search positioning

XFlex is Arabic-first. Priority pages should answer a clear learner question before presenting a package or conversion action. English pages remain complete equivalents, but Arabic content receives publishing priority.

Primary Arabic topic clusters:

1. تعليم التداول للمبتدئين: ما هو التداول، أنواع الأسواق، المنصات، المصطلحات، وكيف يبدأ المتعلم بأقل قدر من الالتباس.
2. إدارة المخاطر ورأس المال: حجم الصفقة، وقف الخسارة، نسبة المخاطرة إلى العائد، التراجع، وسلاسل الخسارة.
3. التحليل الفني: الدعم والمقاومة، الاتجاه، الشموع، تعدد الأطر الزمنية، وفشل الاختراق.
4. علم نفس التداول: الانتقام من السوق، الخوف من فوات الفرصة، الإفراط في التداول، الالتزام بالخطة، وتوثيق الصفقات.
5. الذهب والفوركس: محتوى تعليمي يشرح خصائص السوق والمخاطر من دون توقعات سعرية أو وعود ربح.
6. التوصيات وأدوات الذكاء الاصطناعي: كيفية تقييم خدمة توصيات، حدود التحليل الآلي، التحقق البشري، وتعارض المصالح.

Each cluster should have one durable guide, supporting question-led articles, links to the risk disclosure and editorial policy, and a relevant—not forced—service link.

## Publishing requirements

- Use one descriptive H1 and an answer-first opening paragraph.
- Include author, reviewer when applicable, publication date, update date, risk context, and primary sources.
- Separate facts, interpretation, examples, and commercial claims.
- Do not use isolated profit screenshots or unverifiable win rates as evidence.
- Add at least two contextual internal links and one link back to the cluster guide.
- Review changing financial/platform claims at least every six months.

## Measurement setup

Set these deployment variables:

- `VITE_GA_MEASUREMENT_ID`
- `VITE_GOOGLE_SITE_VERIFICATION`
- `VITE_BING_SITE_VERIFICATION`
- `SEO_REBUILD_WEBHOOK_URL`
- Optional `SEO_REBUILD_WEBHOOK_SECRET`

After deployment:

1. Verify the HTTPS apex property in Google Search Console and Bing Webmaster Tools.
2. Submit `https://xflexacademy.com/sitemap.xml`.
3. Inspect `/ar`, `/ar/articles`, one Arabic article, `/en`, and one English article.
4. Record baseline indexed pages, impressions, clicks, average position, branded/non-branded queries, and Core Web Vitals.
5. Review technical coverage weekly and content performance monthly.

GA4 receives route-level page views, language, AI-referral classification, and conversion signals for contact, WhatsApp, registration, and package-view actions.
