-- Jobs / Careers System Migration
-- Creates tables for job listings, questions, applications, and answers

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  description_en TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER,  -- NULL = general question for all jobs
  question_ar TEXT NOT NULL,
  question_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT,
  cv_file_url TEXT,
  cv_file_key TEXT,
  status TEXT NOT NULL DEFAULT 'new',  -- new | reviewed | shortlisted | rejected
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ai_score INTEGER,
  ai_summary TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_application_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES job_questions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_job_application_answers_app_id ON job_application_answers(application_id);
CREATE INDEX IF NOT EXISTS idx_job_questions_job_id ON job_questions(job_id);

-- ============================================================================
-- Seed Data: Job Positions
-- ============================================================================

INSERT INTO jobs (title_ar, title_en, description_ar, description_en, sort_order) VALUES
  ('موظفة مبيعات', 'Sales Specialist', 'بيع خدمات أكاديمية XFlex التعليمية في مجال التداول من خلال التواصل مع العملاء عبر الهاتف والسوشل ميديا وتحويل المهتمين إلى عملاء مشتركين.', 'Sell XFlex Academy educational trading services by communicating with clients through phone and social media and converting interested prospects into subscribers.', 1),
  ('موظفة تسويق وسوشل ميديا', 'Social Media & Marketing Specialist', 'إدارة صفحات السوشل ميديا للأكاديمية وإنشاء محتوى تسويقي وإدارة الحملات الإعلانية لزيادة الانتشار وجذب العملاء المهتمين بخدمات الأكاديمية.', 'Manage the academy social media pages, create marketing content, and run advertising campaigns to increase reach and attract clients interested in the academy services.', 2),
  ('مدرب تداول', 'Trading Instructor', 'تدريب الطلاب على التداول والتحليل الفني وتقديم كورسات تعليمية وبث مباشر لتحليل الأسواق.', 'Train students on trading and technical analysis, provide educational courses and live streaming for market analysis.', 3);

-- ============================================================================
-- Seed Data: Job-Specific Questions
-- ============================================================================

-- Sales Specialist questions (job_id = 1)
INSERT INTO job_questions (job_id, question_ar, question_en, sort_order) VALUES
  (1, 'كم سنة خبرة لديك في المبيعات؟', 'How many years of sales experience do you have?', 1),
  (1, 'ما نوع الخدمات أو المنتجات التي قمت ببيعها سابقاً؟', 'What types of services or products have you previously sold?', 2),
  (1, 'كيف تتعامل مع عميل متردد؟', 'How do you handle a hesitant customer?', 3),
  (1, 'كيف تقنع عميل يعتقد أن السعر مرتفع؟', 'How do you convince a customer who thinks the price is too high?', 4),
  (1, 'ما أكثر صفقة بيع نجحت فيها؟ وكيف تمت؟', 'What was your most successful sale? How did it happen?', 5),
  (1, 'كيف تدير محادثات البيع عبر السوشل ميديا؟', 'How do you manage sales conversations through social media?', 6),
  (1, 'كيف تستخدم أدوات الذكاء الاصطناعي في عملك؟', 'How do you use AI tools in your work?', 7),
  (1, 'لماذا تعتقد أنك مناسب لهذه الوظيفة؟', 'Why do you think you are suitable for this position?', 8),
  (1, 'ما الذي يجعلك تحقق مبيعات أعلى من غيرك؟', 'What makes you achieve higher sales than others?', 9);

-- Marketing Specialist questions (job_id = 2)
INSERT INTO job_questions (job_id, question_ar, question_en, sort_order) VALUES
  (2, 'ما الصفحات التي قمت بإدارتها سابقاً؟', 'What pages have you previously managed?', 1),
  (2, 'ما أكثر حملة تسويقية نجحت فيها؟', 'What was your most successful marketing campaign?', 2),
  (2, 'كيف تبني خطة محتوى شهرية؟', 'How do you build a monthly content plan?', 3),
  (2, 'ما نوع المحتوى الذي يحقق انتشاراً كبيراً؟', 'What type of content achieves wide reach?', 4),
  (2, 'هل لديك خبرة في الحملات الممولة؟', 'Do you have experience with paid campaigns?', 5),
  (2, 'كم ميزانية حملات قمت بإدارتها سابقاً؟', 'What campaign budgets have you managed previously?', 6),
  (2, 'هل لديك تجربة في الظهور أمام الكاميرا؟', 'Do you have experience appearing on camera?', 7),
  (2, 'كيف تستخدم أدوات الذكاء الاصطناعي في صناعة المحتوى؟', 'How do you use AI tools in content creation?', 8),
  (2, 'كيف تزيد عدد المتابعين الحقيقيين لصفحة؟', 'How do you increase real followers for a page?', 9);

-- Trading Instructor questions (job_id = 3)
INSERT INTO job_questions (job_id, question_ar, question_en, sort_order) VALUES
  (3, 'كم سنة خبرة لديك في التداول؟', 'How many years of trading experience do you have?', 1),
  (3, 'ما الأسواق التي تتداول فيها؟', 'What markets do you trade in?', 2),
  (3, 'ما الاستراتيجية الأساسية التي تستخدمها؟', 'What is the main strategy you use?', 3),
  (3, 'كيف تحلل السوق قبل دخول الصفقة؟', 'How do you analyze the market before entering a trade?', 4),
  (3, 'كيف تدير المخاطر؟', 'How do you manage risks?', 5),
  (3, 'كيف تشرح مفهوم التداول للمبتدئين؟', 'How do you explain trading concepts to beginners?', 6),
  (3, 'هل سبق أن دربت طلاباً في التداول؟', 'Have you previously trained students in trading?', 7),
  (3, 'هل تستطيع تقديم بث مباشر وتحليل السوق؟', 'Can you provide live streaming and market analysis?', 8),
  (3, 'كيف تستخدم أدوات الذكاء الاصطناعي في التداول؟', 'How do you use AI tools in trading?', 9);

-- ============================================================================
-- Seed Data: General Questions (job_id IS NULL → apply to all jobs)
-- ============================================================================

INSERT INTO job_questions (job_id, question_ar, question_en, sort_order) VALUES
  (NULL, 'كيف تتعامل مع ضغط العمل؟', 'How do you handle work pressure?', 100),
  (NULL, 'كيف تتعامل مع مشكلة مفاجئة في العمل؟', 'How do you handle an unexpected problem at work?', 101),
  (NULL, 'ما أكبر تحدٍ واجهته في عملك؟', 'What is the biggest challenge you faced in your work?', 102),
  (NULL, 'كيف تستخدم الذكاء الاصطناعي في عملك؟', 'How do you use AI in your work?', 103),
  (NULL, 'ما الذي يجعلك مختلفاً عن باقي المتقدمين؟', 'What makes you different from other applicants?', 104),
  (NULL, 'لماذا تريد العمل معنا؟', 'Why do you want to work with us?', 105),
  (NULL, 'كيف تقيم سرعتك في الإنجاز؟', 'How do you rate your speed of accomplishment?', 106);
