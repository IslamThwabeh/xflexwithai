-- Migration: Add Quiz System Tables
-- Description: Creates all tables needed for the quiz/assessment system
-- Date: 2025-11-15

-- ============================================
-- 1. Quizzes Table
-- ============================================
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  level INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Quiz Questions Table
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  order_num INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(quiz_id, order_num)
);

-- ============================================
-- 3. Quiz Options Table
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_id VARCHAR(1) NOT NULL, -- 'a', 'b', 'c', 'd'
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(question_id, option_id)
);

-- ============================================
-- 4. Quiz Attempts Table
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  passed BOOLEAN NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_taken_seconds INTEGER
);

-- ============================================
-- 5. Quiz Answers Table
-- ============================================
CREATE TABLE IF NOT EXISTS quiz_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_option_id VARCHAR(1) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. User Quiz Progress Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_quiz_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  best_score INTEGER DEFAULT 0,
  best_percentage DECIMAL(5,2) DEFAULT 0,
  attempts_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, quiz_id)
);

-- ============================================
-- Create Indexes for Performance
-- ============================================
CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_options_question_id ON quiz_options(question_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_answers_attempt_id ON quiz_answers(attempt_id);
CREATE INDEX idx_user_quiz_progress_user_id ON user_quiz_progress(user_id);
CREATE INDEX idx_user_quiz_progress_user_quiz ON user_quiz_progress(user_id, quiz_id);

-- ============================================
-- Insert Quiz Data from JSON
-- ============================================

-- Level 1: مقدمة في التداول
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(1, 'مقدمة في التداول', 'اختبار المستوى الأول - أساسيات التداول والحسابات', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(1, 'ما هو حجم العقد (اللوت) الذي يمثل 10,000 وحدة من العملة الأساسية؟', 1),
(1, 'إذا تحرك سعر EUR/USD من 1.1000 إلى 1.1025، كم نقطة تحرك السعر؟', 2),
(1, 'ما هي الرافعة المالية إذا كانت قيمة العقد 100,000 والهامش 1000؟', 3),
(1, 'إذا كانت قيمة النقطة 1 دولار، كم تربح من 40 نقطة؟', 4),
(1, 'رأس مالك $1000، وتريد المخاطرة بنسبة %2 في صفقة وقف الخسارة فيها 40 نقطة. كم يجب أن تكون قيمة النقطة؟', 5),
(1, 'إذا ربحت 90 نقطة وكان ستوبك 30 نقطة، ما هي نسبة العائد إلى المخاطرة؟', 6);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(1, 'a', '0.01', false),
(1, 'b', '0.10', true),
(1, 'c', '1.00', false),
(1, 'd', '10.00', false),
(2, 'a', '2.5', false),
(2, 'b', '0.25', false),
(2, 'c', '25', true),
(2, 'd', '250', false),
(3, 'a', '1:10', false),
(3, 'b', '1:100', true),
(3, 'c', '1:50', false),
(3, 'd', '1:1000', false),
(4, 'a', '$4', false),
(4, 'b', '$10', false),
(4, 'c', '$40', true),
(4, 'd', '$100', false),
(5, 'a', '$1', false),
(5, 'b', '$0.5', true),
(5, 'c', '$2', false),
(5, 'd', '$0.05', false),
(6, 'a', '3:1', true),
(6, 'b', '2:1', false),
(6, 'c', '1:3', false),
(6, 'd', '1:2', false);

-- Level 2: التحليل الفني - قراءة الشارت
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(2, 'التحليل الفني - قراءة الشارت', 'اختبار المستوى الثاني - الشموع اليابانية والأنماط', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(2, 'ما هي الشمعة التي تشير إلى ضغط شرائي قوي؟', 1),
(2, 'ماذا يعني نموذج الإنغلفنغ الصعودي؟', 2),
(2, 'ما الفرق بين الإطار الزمني اليومي (D1) والساعة (H1)؟', 3),
(2, 'ما هو الترند الصاعد؟', 4),
(2, 'متى نستخدم نموذج الدوجي في التداول؟', 5);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(7, 'a', 'شمعة بجسم صغير وظلال طويلة', false),
(7, 'b', 'شمعة خضراء بجسم كبير وظلال قصيرة', true),
(7, 'c', 'شمعة دوجي', false),
(7, 'd', 'شمعة حمراء بظل علوي طويل', false),
(8, 'a', 'شمعة خضراء تبتلع شمعة حمراء سابقة', true),
(8, 'b', 'شمعة حمراء تبتلع شمعة خضراء سابقة', false),
(8, 'c', 'شمعتان متساويتان', false),
(8, 'd', 'شمعة دوجي بعد ترند', false),
(9, 'a', 'D1 يعطي إشارات أسرع', false),
(9, 'b', 'H1 أكثر استقرارًا من D1', false),
(9, 'c', 'D1 يعطي رؤية أوسع للترند', true),
(9, 'd', 'لا فرق بينهما', false),
(10, 'a', 'قيعان منخفضة وقمم منخفضة', false),
(10, 'b', 'قيعان مرتفعة وقمم مرتفعة', true),
(10, 'c', 'حركة أفقية', false),
(10, 'd', 'تذبذب عشوائي', false),
(11, 'a', 'للدخول الفوري', false),
(11, 'b', 'كإشارة تحذير لانعكاس محتمل', true),
(11, 'c', 'لتأكيد الترند', false),
(11, 'd', 'لا يستخدم في التداول', false);

-- Level 3: الدعم والمقاومة - البرايس أكشن
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(3, 'الدعم والمقاومة - البرايس أكشن', 'اختبار المستوى الثالث - مناطق الدعم والمقاومة', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(3, 'ما هي منطقة الدعم؟', 1),
(3, 'ماذا يحدث عندما يكسر السعر مستوى مقاومة قوي؟', 2),
(3, 'ما هو الفرق بين الدعم الأفقي والدعم الديناميكي؟', 3),
(3, 'كيف نحدد منطقة دعم قوية؟', 4),
(3, 'ما هي استراتيجية البرايس أكشن؟', 5);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(12, 'a', 'منطقة يتوقف عندها السعر عن الصعود', false),
(12, 'b', 'منطقة يتوقف عندها السعر عن الهبوط', true),
(12, 'c', 'منطقة تذبذب السعر', false),
(12, 'd', 'منطقة عشوائية', false),
(13, 'a', 'يعود للأسفل فورًا', false),
(13, 'b', 'يتحول إلى دعم', true),
(13, 'c', 'لا يحدث شيء', false),
(13, 'd', 'يتوقف السعر', false),
(14, 'a', 'الأفقي ثابت، الديناميكي متحرك', true),
(14, 'b', 'لا فرق بينهما', false),
(14, 'c', 'الديناميكي أقوى دائمًا', false),
(14, 'd', 'الأفقي غير موثوق', false),
(15, 'a', 'من لمسة واحدة فقط', false),
(15, 'b', 'من عدة لمسات تاريخية', true),
(15, 'c', 'من التخمين', false),
(15, 'd', 'لا يمكن تحديدها', false),
(16, 'a', 'التداول بناءً على المؤشرات فقط', false),
(16, 'b', 'التداول بناءً على حركة السعر والشموع', true),
(16, 'c', 'التداول العشوائي', false),
(16, 'd', 'التداول بدون تحليل', false);

-- Level 4: النماذج الفنية - الرموز السرية
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(4, 'النماذج الفنية - الرموز السرية', 'اختبار المستوى الرابع - النماذج الفنية الكلاسيكية', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(4, 'ما هو نموذج الرأس والكتفين؟', 1),
(4, 'ما الفرق بين المثلث الصاعد والمثلث الهابط؟', 2),
(4, 'ما هو نموذج القمة المزدوجة (Double Top)؟', 3),
(4, 'كيف نتأكد من صحة النموذج الفني؟', 4),
(4, 'ما هو نموذج العلم (Flag)؟', 5);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(17, 'a', 'نموذج انعكاسي هبوطي', true),
(17, 'b', 'نموذج استمراري', false),
(17, 'c', 'نموذج صعودي', false),
(17, 'd', 'لا يوجد نموذج بهذا الاسم', false),
(18, 'a', 'الصاعد قاعدة أفقية علوية، الهابط قاعدة أفقية سفلية', true),
(18, 'b', 'لا فرق بينهما', false),
(18, 'c', 'الصاعد دائمًا هبوطي', false),
(18, 'd', 'المثلثات غير موثوقة', false),
(19, 'a', 'نموذج انعكاسي هبوطي', true),
(19, 'b', 'نموذج انعكاسي صعودي', false),
(19, 'c', 'نموذج استمراري', false),
(19, 'd', 'نموذج عشوائي', false),
(20, 'a', 'من الشكل فقط', false),
(20, 'b', 'من كسر مستوى معين بحجم تداول جيد', true),
(20, 'c', 'من التخمين', false),
(20, 'd', 'النماذج دائمًا صحيحة', false),
(21, 'a', 'نموذج انعكاسي', false),
(21, 'b', 'نموذج استمراري', true),
(21, 'c', 'نموذج هبوطي فقط', false),
(21, 'd', 'نموذج غير معروف', false);

-- Level 5: إدارة رأس المال والمخاطر
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(5, 'إدارة رأس المال والمخاطر', 'اختبار المستوى الخامس - إدارة المخاطر ورأس المال', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(5, 'ما هي النسبة المثالية للمخاطرة في كل صفقة؟', 1),
(5, 'ما هي نسبة العائد إلى المخاطرة الجيدة (Risk:Reward)؟', 2),
(5, 'لماذا يجب وضع وقف الخسارة (Stop Loss)؟', 3),
(5, 'ما هو الخطأ الأكبر في إدارة المخاطر؟', 4),
(5, 'كيف نحسب حجم اللوت المناسب؟', 5),
(5, 'ماذا تفعل إذا خسرت 3 صفقات متتالية؟', 6);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(22, 'a', '10% من رأس المال', false),
(22, 'b', '1-2% من رأس المال', true),
(22, 'c', '50% من رأس المال', false),
(22, 'd', 'كل رأس المال', false),
(23, 'a', '1:1', false),
(23, 'b', '1:2 أو أعلى', true),
(23, 'c', '2:1', false),
(23, 'd', 'لا يهم', false),
(24, 'a', 'لحماية رأس المال من خسائر كبيرة', true),
(24, 'b', 'لزيادة الأرباح', false),
(24, 'c', 'غير ضروري', false),
(24, 'd', 'لإغلاق الصفقة فورًا', false),
(25, 'a', 'المخاطرة بنسبة صغيرة', false),
(25, 'b', 'فتح صفقات كثيرة بمخاطرة عالية', true),
(25, 'c', 'استخدام وقف الخسارة', false),
(25, 'd', 'تحليل السوق', false),
(26, 'a', 'عشوائيًا', false),
(26, 'b', 'بناءً على رأس المال ونسبة المخاطرة ووقف الخسارة', true),
(26, 'c', 'دائمًا 1.00 لوت', false),
(26, 'd', 'أكبر حجم ممكن', false),
(27, 'a', 'أضاعف حجم الصفقة التالية', false),
(27, 'b', 'أتوقف وأراجع الاستراتيجية', true),
(27, 'c', 'أفتح 10 صفقات دفعة واحدة', false),
(27, 'd', 'أغير السوق فقط', false);

-- Level 6: إدارة التوصيات
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(6, 'إدارة التوصيات', 'اختبار المستوى السادس - التعامل مع التوصيات', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(6, 'ما هي أفضل طريقة للتعامل مع التوصيات؟', 1),
(6, 'هل يجب الاعتماد الكامل على التوصيات؟', 2),
(6, 'ماذا تفعل إذا تعارضت التوصية مع تحليلك؟', 3),
(6, 'ما هي علامات التوصية الجيدة؟', 4),
(6, 'كيف تدير المخاطر عند اتباع التوصيات؟', 5);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(28, 'a', 'تنفيذها مباشرة دون تحليل', false),
(28, 'b', 'تحليلها أولاً والتأكد من توافقها مع استراتيجيتك', true),
(28, 'c', 'تجاهلها تمامًا', false),
(28, 'd', 'فتح صفقات عكسية', false),
(29, 'a', 'نعم، دائمًا', false),
(29, 'b', 'لا، يجب أن يكون لديك تحليلك الخاص', true),
(29, 'c', 'فقط في الأسواق الهادئة', false),
(29, 'd', 'فقط مع المتداولين المبتدئين', false),
(30, 'a', 'أتبع التوصية فورًا', false),
(30, 'b', 'أعيد التحليل وأقرر بناءً على قناعتي', true),
(30, 'c', 'أفتح صفقتين متعاكستين', false),
(30, 'd', 'أغلق الحساب', false),
(31, 'a', 'تحتوي على دخول، ستوب، وهدف واضح', true),
(31, 'b', 'تعد بأرباح ضخمة', false),
(31, 'c', 'بدون وقف خسارة', false),
(31, 'd', 'تأتي من أي مصدر', false),
(32, 'a', 'أستخدم كل رأس المال', false),
(32, 'b', 'ألتزم بنسبة المخاطرة المحددة (1-2%)', true),
(32, 'c', 'أفتح صفقات بدون ستوب', false),
(32, 'd', 'أتجاهل إدارة المخاطر', false);

-- Level 7: إدارة النفسية
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(7, 'إدارة النفسية', 'اختبار المستوى السابع - علم نفس التداول', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(7, 'ما هو أكبر عدو للمتداول؟', 1),
(7, 'ماذا تفعل بعد خسارة كبيرة؟', 2),
(7, 'ما هو الطمع في التداول؟', 3),
(7, 'كيف تتجنب التداول العاطفي؟', 4),
(7, 'ما هي أهمية الصبر في التداول؟', 5),
(7, 'ماذا يعني الانضباط في التداول؟', 6);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(33, 'a', 'السوق', false),
(33, 'b', 'العواطف (الخوف والطمع)', true),
(33, 'c', 'المؤشرات', false),
(33, 'd', 'الوسيط', false),
(34, 'a', 'أفتح صفقة فورًا لتعويض الخسارة', false),
(34, 'b', 'أتوقف، أهدأ، وأراجع الخطأ', true),
(34, 'c', 'أضاعف حجم الصفقة', false),
(34, 'd', 'أترك التداول نهائيًا', false),
(35, 'a', 'عدم إغلاق الصفقة الرابحة طمعًا في المزيد', true),
(35, 'b', 'إغلاق الصفقة بربح صغير', false),
(35, 'c', 'استخدام وقف الخسارة', false),
(35, 'd', 'التحليل الدقيق', false),
(36, 'a', 'بالالتزام بخطة تداول واضحة', true),
(36, 'b', 'بفتح صفقات عشوائية', false),
(36, 'c', 'بتجاهل التحليل', false),
(36, 'd', 'بالتداول بدون استراتيجية', false),
(37, 'a', 'غير مهم', false),
(37, 'b', 'ضروري لانتظار الفرص الجيدة', true),
(37, 'c', 'يؤدي للخسارة', false),
(37, 'd', 'للمتداولين المبتدئين فقط', false),
(38, 'a', 'التداول بشكل عشوائي', false),
(38, 'b', 'الالتزام بالخطة والاستراتيجية', true),
(38, 'c', 'فتح صفقات كثيرة', false),
(38, 'd', 'تجاهل وقف الخسارة', false);

-- Level 8: خطة التداول
INSERT INTO quizzes (level, title, description, passing_score) VALUES
(8, 'خطة التداول', 'اختبار المستوى الثامن - بناء خطة تداول متكاملة', 50);

INSERT INTO quiz_questions (quiz_id, question_text, order_num) VALUES
(8, 'ما هي خطة التداول؟', 1),
(8, 'ما هي أهم عناصر خطة التداول؟', 2),
(8, 'لماذا يجب توثيق الصفقات في دفتر تداول؟', 3),
(8, 'متى يجب تعديل خطة التداول؟', 4),
(8, 'ما الفرق بين المتداول الناجح والفاشل؟', 5),
(8, 'كيف تقيّم نجاح خطة التداول؟', 6);

INSERT INTO quiz_options (question_id, option_id, option_text, is_correct) VALUES
(39, 'a', 'مجموعة قواعد واضحة للدخول والخروج وإدارة المخاطر', true),
(39, 'b', 'التداول بدون قواعد', false),
(39, 'c', 'نسخ صفقات الآخرين', false),
(39, 'd', 'التداول العشوائي', false),
(40, 'a', 'الدخول، الخروج، إدارة المخاطر، الانضباط النفسي', true),
(40, 'b', 'الحظ فقط', false),
(40, 'c', 'التوصيات فقط', false),
(40, 'd', 'لا يوجد عناصر محددة', false),
(41, 'a', 'لمراجعة الأخطاء والتعلم منها', true),
(41, 'b', 'غير ضروري', false),
(41, 'c', 'لإضاعة الوقت', false),
(41, 'd', 'للمتداولين المحترفين فقط', false),
(42, 'a', 'بعد كل صفقة', false),
(42, 'b', 'بعد تقييم دوري وملاحظة نتائج ثابتة', true),
(42, 'c', 'يوميًا', false),
(42, 'd', 'لا يجب تعديلها أبدًا', false),
(43, 'a', 'الحظ', false),
(43, 'b', 'الالتزام بخطة واضحة وإدارة جيدة', true),
(43, 'c', 'رأس المال الكبير', false),
(43, 'd', 'عدد الصفقات', false),
(44, 'a', 'من صفقة واحدة', false),
(44, 'b', 'من النتائج على المدى الطويل (شهور)', true),
(44, 'c', 'من الأرباح اليومية فقط', false),
(44, 'd', 'لا يمكن تقييمها', false);

-- ============================================
-- Comments for Future Reference
-- ============================================
COMMENT ON TABLE quizzes IS 'Stores quiz/assessment information for each course level';
COMMENT ON TABLE quiz_questions IS 'Stores individual questions for each quiz';
COMMENT ON TABLE quiz_options IS 'Stores answer options for each question';
COMMENT ON TABLE quiz_attempts IS 'Records each attempt a user makes at a quiz';
COMMENT ON TABLE quiz_answers IS 'Records individual answers for each attempt';
COMMENT ON TABLE user_quiz_progress IS 'Tracks overall progress and unlock status for each user';
