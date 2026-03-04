INSERT OR IGNORE INTO packages (slug, nameEn, nameAr, descriptionEn, descriptionAr, price, currency, renewalPrice, renewalPeriodDays, renewalDescription, includesLexai, includesRecommendations, includesSupport, includesPdf, isLifetime, isPublished, displayOrder)
VALUES
  ('comprehensive', 'Comprehensive Package', 'الباقة الشاملة',
   'Everything in the Basic package plus LexAI artificial intelligence analysis and full recommendations.',
   'كل ما في الباقة الأساسية بالإضافة إلى تحليل الذكاء الاصطناعي LexAI والتوصيات الكاملة.',
   50000, 'USD', 10000, 30,
   '$100/month renewal for recommendations + LexAI',
   1, 1, 1, 1, 1, 1, 2);
