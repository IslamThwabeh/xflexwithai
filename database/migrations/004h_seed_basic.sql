INSERT OR IGNORE INTO packages (slug, nameEn, nameAr, descriptionEn, descriptionAr, price, currency, renewalPrice, renewalPeriodDays, renewalDescription, includesLexai, includesRecommendations, includesSupport, includesPdf, isLifetime, isPublished, displayOrder)
VALUES
  ('basic', 'Basic Package', 'الباقة الأساسية',
   'Complete trading education program with recommendations support and printable materials.',
   'برنامج تعليمي شامل للتداول مع التوصيات والدعم الفني وملفات قابلة للطباعة.',
   20000, 'USD', 5000, 30,
   'Optional $50/month renewal for recommendations',
   0, 1, 1, 1, 1, 1, 1);
