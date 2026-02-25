import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation keys
const translations = {
  en: {
    // Header/Navigation
    'nav.myCourses': 'My Courses',
    'nav.lexai': 'LexAI',
    'nav.adminPanel': 'Admin Panel',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    
    // Homepage
    'home.hero.title': 'Master Trading with',
    'home.hero.subtitle': 'Expert Guidance',
    'home.hero.description': 'Learn from industry experts and take your trading skills to the next level with our comprehensive courses. Start your journey to financial freedom today.',
    'home.hero.browseCourses': 'Browse Courses',
    'home.hero.startTrial': 'Start Free Trial',
    'home.hero.activeStudents': 'Active Students',
    'home.hero.expertCourses': 'Expert Courses',
    'home.hero.rating': 'Rating',
    
    'home.cta.title': 'Get Started Today',
    'home.cta.subtitle': 'Join thousands of successful traders',
    'home.cta.email': 'Enter your email',
    'home.cta.password': 'Choose a password',
    'home.cta.createAccount': 'Create Free Account',
    'home.cta.haveAccount': 'Already have an account?',
    'home.cta.signIn': 'Sign in',
    'home.cta.guarantee': '30-day money-back guarantee',
    
    'home.why.title': 'Why Choose XFlex Academy?',
    'home.why.subtitle': 'Everything you need to become a successful trader in one place',
    'home.why.expertCourses': 'Expert-Led Courses',
    'home.why.expertDesc': 'Learn from experienced traders with proven track records in the markets',
    'home.why.practicalStrategies': 'Practical Strategies',
    'home.why.practicalDesc': 'Apply real-world trading strategies that work in today\'s markets',
    'home.why.lifetimeAccess': 'Lifetime Access',
    'home.why.lifetimeDesc': 'Get unlimited access to course materials and future updates',
    
    'home.courses.title': 'Available Courses',
    'home.courses.subtitle': 'Choose from our selection of trading courses designed for all skill levels',
    'home.courses.noCourses': 'No courses available yet. Check back soon!',
    
    // Services Section
    'home.services.title': 'Our Services',
    'home.services.subtitle': 'Everything you need to succeed in Forex trading',
    
    // Course Card
    'home.service.course.title': 'Trading Courses',
    'home.service.course.desc': 'Learn Forex trading from basics to advanced strategies with comprehensive video courses.',
    'home.service.course.f1': 'Complete Trading Course',
    'home.service.course.f2': 'Price Action Strategies',
    'home.service.course.f3': 'Risk Management',
    'home.service.course.f4': 'Technical Analysis',
    'home.service.course.cta': 'Activate Course Access',
    'home.service.course.price': 'One-Time Payment',
    
    // Recommendations Card
    'home.service.rec.title': 'Recommendations Group',
    'home.service.rec.desc': 'Live trading signals from expert analysts with real-time alerts and email notifications.',
    'home.service.rec.f1': 'Live Trading Signals',
    'home.service.rec.f2': 'Expert Analyst Posts',
    'home.service.rec.f3': 'Email Alerts on New Signals',
    'home.service.rec.f4': 'Interactive Reactions',
    'home.service.rec.cta': 'Subscribe Now',
    'home.service.rec.price': '$100 / month',
    
    // LexAI Card
    'home.service.lexai.title': 'LexAI Assistant',
    'home.service.lexai.desc': 'Get AI-powered chart analysis and trading recommendations powered by advanced AI.',
    'home.service.lexai.f1': 'Multi-timeframe Analysis',
    'home.service.lexai.f2': 'Support & Resistance Levels',
    'home.service.lexai.f3': 'Entry & Exit Points',
    'home.service.lexai.f4': 'Risk Management Tips',
    'home.service.lexai.cta': 'Activate LexAI (30 Days)',
    'home.service.lexai.price': '$30 / month',
    
    // Already Registered
    'home.alreadyRegistered': 'Already Registered?',
    'home.loginHere': 'Login Here',
    
    // Contact Support
    'home.contact.title': 'Contact Support',
    'home.contact.subtitle': 'Have a question? Send us a message and we\'ll get back to you.',
    'home.contact.email': 'Your Email',
    'home.contact.emailPlaceholder': 'email@example.com',
    'home.contact.message': 'Your Message',
    'home.contact.messagePlaceholder': 'How can we help you?',
    'home.contact.send': 'Send Message',
    'home.contact.sending': 'Sending...',
    'home.contact.sent': 'Message sent! We\'ll get back to you soon.',
    
    'home.footer.tagline': 'Empowering traders worldwide with expert knowledge and practical skills',
    'home.footer.rights': 'All rights reserved.',
    
    // Dashboard
    'dashboard.title': 'Welcome back, {name}!',
    'dashboard.subtitle': 'Continue your learning journey',
    'dashboard.settings': 'Settings',
    'dashboard.logout': 'Logout',
    'dashboard.loading': 'Loading your dashboard...',
    'dashboard.signInTitle': 'Welcome to XFlex Trading Academy',
    'dashboard.signInDesc': 'Please sign in to access your learning dashboard',
    'dashboard.signInBtn': 'Sign In to Continue',
    'dashboard.stats.totalCourses': 'Total Courses',
    'dashboard.stats.enrolledLabel': 'Enrolled courses',
    'dashboard.stats.enrolledCourses': 'Enrolled Courses',
    'dashboard.stats.courses': 'active courses',
    'dashboard.stats.completedCourses': 'Completed',
    'dashboard.stats.finished': 'Finished courses',
    'dashboard.stats.inProgress': 'In Progress',
    'dashboard.stats.activeLearning': 'Active learning',
    'dashboard.stats.avgProgress': 'Avg. Progress',
    'dashboard.stats.overallCompletion': 'Overall completion',
    'dashboard.stats.quizzesPassed': 'Quizzes Passed',
    'dashboard.stats.levels': 'quiz levels completed',
    'dashboard.enrolledCourses.title': 'My Courses',
    'dashboard.enrolledCourses.description': 'Continue learning and track your progress',
    'dashboard.noCoursesEnrolled': 'You haven\'t enrolled in any courses yet',
    'dashboard.noCoursesTitle': 'No courses yet',
    'dashboard.noCoursesDesc': 'Start learning by enrolling in a course',
    'dashboard.browseCourses': 'Browse Courses',
    'dashboard.completed': 'Completed',
    'dashboard.episodes': 'episodes',
    'dashboard.episodesCompleted': 'episodes completed',
    'dashboard.progress': 'Progress',
    'dashboard.continue': 'Continue Learning',
    'dashboard.review': 'Review Course',
    'dashboard.myAccess': 'My Access',
    'dashboard.myAccessDesc': 'Your course access and LexAI status are linked to your email.',
    'dashboard.courseAccess': 'Course',
    'dashboard.lexaiAccess': 'LexAI',
    'dashboard.recAccess': 'Recommendations',
    'dashboard.active': 'Active',
    'dashboard.notActive': 'Not active',
    'dashboard.openCourses': 'Open Courses',
    'dashboard.openLexai': 'Open LexAI',
    'dashboard.openRec': 'Open Recommendations',
    'dashboard.activateRec': 'Activate Recommendations',
    'dashboard.nav.home': 'Home',
    'dashboard.nav.quizzes': 'Quizzes',
    'dashboard.nav.lexai': 'LexAI',
    'dashboard.nav.rec': 'Recommendations Group',
    'dashboard.quickActions.browseMore': 'Discover More',
    'dashboard.quickActions.discoverNewCourses': 'Explore more trading courses and expand your knowledge',
    'dashboard.quickActions.browseCourses': 'Browse All Courses',
    'dashboard.quickActions.aiAssistant': 'FlexAI Assistant',
    'dashboard.quickActions.getAIHelp': 'Get instant help from our AI trading assistant',
    'dashboard.quickActions.openChat': 'Open Chat',
    
    // LexAI
    'lexai.title': 'LexAI - AI Currency Analysis',
    'lexai.subscribe.title': 'Subscribe to LexAI',
    'lexai.subscribe.desc': 'Get AI-powered currency analysis and trading recommendations',
    'lexai.subscribe.price': '$29.99/month',
    'lexai.subscribe.feature1': '100 chart analyses per month',
    'lexai.subscribe.feature2': 'Real-time market insights',
    'lexai.subscribe.feature3': 'Trading recommendations',
    'lexai.subscribe.feature4': 'Technical analysis reports',
    'lexai.subscribe.button': 'Subscribe Now',
    'lexai.chat.title': 'Chat with LexAI',
    'lexai.chat.remaining': 'analyses remaining this month',
    'lexai.chat.placeholder': 'Ask about currency analysis or upload a chart image...',
    'lexai.chat.send': 'Send',
    'lexai.chat.uploadImage': 'Upload Chart Image',
    'lexai.chat.uploading': 'Uploading...',
    
    // Admin
    'admin.dashboard': 'Dashboard',
    'admin.courses': 'Courses',
    'admin.episodes': 'Episodes',
    'admin.users': 'Users & Enrollments',
    'admin.totalUsers': 'Total Users',
    'admin.totalCourses': 'Total Courses',
    'admin.activeEnrollments': 'Active Enrollments',
    'admin.totalRevenue': 'Total Revenue',
    
    // Auth Pages
    'auth.login.title': 'Welcome Back',
    'auth.login.description': 'Sign in to continue learning',
    'auth.login.adminTitle': 'Admin Login',
    'auth.login.adminDescription': 'Sign in to access the admin panel',
    'auth.login.email': 'Email',
    'auth.login.password': 'Password',
    'auth.login.emailPlaceholder': 'john@example.com',
    'auth.login.passwordPlaceholder': '••••••••',
    'auth.login.submit': 'Sign In',
    'auth.login.submitting': 'Signing In...',
    'auth.login.allFieldsRequired': 'All fields are required',
    
    'auth.register.title': 'Create Account',
    'auth.register.description': 'Sign up to start learning trading',
    'auth.register.fullName': 'Full Name',
    'auth.register.email': 'Email',
    'auth.register.password': 'Password',
    'auth.register.confirmPassword': 'Confirm Password',
    'auth.register.namePlaceholder': 'John Doe',
    'auth.register.emailPlaceholder': 'john@example.com',
    'auth.register.passwordPlaceholder': '••••••••',
    'auth.register.passwordHint': 'At least 8 characters with 1 uppercase, 1 lowercase, and 1 number',
    'auth.register.submit': 'Create Account',
    'auth.register.submitting': 'Creating Account...',
    'auth.register.allFieldsRequired': 'All fields are required',
    'auth.register.passwordMismatch': 'Passwords do not match',
    'auth.register.passwordTooShort': 'Password must be at least 8 characters',
    
    'auth.page.backToHome': '← Back to Home',
    'auth.page.tagline': 'Master the art of trading',
    'auth.page.switchToRegister': "Don't have an account?",
    'auth.page.switchToLogin': 'Already have an account?',
    'auth.page.signUp': 'Sign up',
    'auth.page.signIn': 'Sign in',
    
    // Profile Page
    'profile.title': 'Account Settings',
    'profile.description': 'Manage your profile and security settings',
    'profile.backToDashboard': 'Back to Dashboard',
    'profile.email': 'Email',
    'profile.emailReadonly': 'Email cannot be changed',
    'profile.name': 'Full Name',
    'profile.nameplaceholder': 'Enter your full name',
    'profile.phone': 'Phone Number',
    'profile.phoneExample': '+1 (555) 000-0000',
    'profile.saveChanges': 'Save Changes',
    'profile.updating': 'Saving...',
    'profile.cancel': 'Cancel',
    'profile.updates.success': 'Profile updated successfully',
    'profile.error': 'Error',
    
    'profile.profileInfo.title': 'Profile Information',
    'profile.profileInfo.description': 'Update your personal information',
    
    'profile.security.title': 'Security',
    'profile.security.description': 'Manage your password and security settings',
    'profile.password.change': 'Change Password',
    'profile.password.current': 'Current Password',
    'profile.password.new': 'New Password',
    'profile.password.confirm': 'Confirm New Password',
    'profile.password.enterCurrent': 'Enter your current password',
    'profile.password.enterNew': 'Enter your new password',
    'profile.password.confirmNew': 'Confirm your new password',
    'profile.password.requirements': 'Minimum 8 characters with uppercase, lowercase, and numbers',
    'profile.password.allFieldsRequired': 'All password fields are required',
    'profile.password.mismatch': 'New passwords do not match',
    'profile.password.tooShort': 'Password must be at least 8 characters',
    'profile.password.changed': 'Password changed successfully',
    'profile.password.update': 'Update Password',
    'profile.password.updating': 'Updating password...',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.back': 'Back',
  },
  ar: {
    // Header/Navigation
    'nav.myCourses': 'دوراتي',
    'nav.lexai': 'ليكس إيه آي',
    'nav.adminPanel': 'لوحة الإدارة',
    'nav.logout': 'تسجيل الخروج',
    'nav.login': 'تسجيل الدخول',
    
    // Homepage
    'home.hero.title': 'أتقن التداول مع',
    'home.hero.subtitle': 'إرشاد الخبراء',
    'home.hero.description': 'تعلم من خبراء الصناعة وارتقِ بمهاراتك في التداول إلى المستوى التالي من خلال دوراتنا الشاملة. ابدأ رحلتك نحو الحرية المالية اليوم.',
    'home.hero.browseCourses': 'تصفح الدورات',
    'home.hero.startTrial': 'ابدأ تجربة مجانية',
    'home.hero.activeStudents': 'طالب نشط',
    'home.hero.expertCourses': 'دورة احترافية',
    'home.hero.rating': 'التقييم',
    
    'home.cta.title': 'ابدأ اليوم',
    'home.cta.subtitle': 'انضم إلى آلاف المتداولين الناجحين',
    'home.cta.email': 'أدخل بريدك الإلكتروني',
    'home.cta.password': 'اختر كلمة مرور',
    'home.cta.createAccount': 'إنشاء حساب مجاني',
    'home.cta.haveAccount': 'هل لديك حساب بالفعل؟',
    'home.cta.signIn': 'تسجيل الدخول',
    'home.cta.guarantee': 'ضمان استرداد الأموال لمدة 30 يومًا',
    
    'home.why.title': 'لماذا تختار أكاديمية XFlex؟',
    'home.why.subtitle': 'كل ما تحتاجه لتصبح متداولًا ناجحًا في مكان واحد',
    'home.why.expertCourses': 'دورات يقودها خبراء',
    'home.why.expertDesc': 'تعلم من متداولين ذوي خبرة وسجلات حافلة في الأسواق',
    'home.why.practicalStrategies': 'استراتيجيات عملية',
    'home.why.practicalDesc': 'طبق استراتيجيات تداول حقيقية تعمل في أسواق اليوم',
    'home.why.lifetimeAccess': 'وصول مدى الحياة',
    'home.why.lifetimeDesc': 'احصل على وصول غير محدود إلى مواد الدورة والتحديثات المستقبلية',
    
    'home.courses.title': 'الدورات المتاحة',
    'home.courses.subtitle': 'اختر من مجموعتنا من دورات التداول المصممة لجميع مستويات المهارة',
    'home.courses.noCourses': 'لا توجد دورات متاحة حتى الآن. تحقق مرة أخرى قريبًا!',
    
    // Services Section
    'home.services.title': 'خدماتنا',
    'home.services.subtitle': 'كل ما تحتاجه للنجاح في تداول الفوركس',
    
    // Course Card
    'home.service.course.title': 'دورات التداول',
    'home.service.course.desc': 'تعلم تداول الفوركس من الأساسيات إلى الاستراتيجيات المتقدمة عبر دورات فيديو شاملة.',
    'home.service.course.f1': 'دورة تداول كاملة',
    'home.service.course.f2': 'استراتيجيات حركة السعر',
    'home.service.course.f3': 'إدارة المخاطر',
    'home.service.course.f4': 'التحليل الفني',
    'home.service.course.cta': 'تفعيل الوصول للدورة',
    'home.service.course.price': 'دفعة واحدة',
    
    // Recommendations Card
    'home.service.rec.title': 'قروب التوصيات',
    'home.service.rec.desc': 'توصيات تداول حية من محللين خبراء مع تنبيهات فورية وإشعارات بالبريد الإلكتروني.',
    'home.service.rec.f1': 'توصيات تداول حية',
    'home.service.rec.f2': 'منشورات محللين خبراء',
    'home.service.rec.f3': 'تنبيهات بريد إلكتروني فورية',
    'home.service.rec.f4': 'تفاعلات مباشرة',
    'home.service.rec.cta': 'اشترك الآن',
    'home.service.rec.price': '$100 / شهرياً',
    
    // LexAI Card
    'home.service.lexai.title': 'مساعد LexAI',
    'home.service.lexai.desc': 'احصل على تحليل الرسوم البيانية وتوصيات التداول بالذكاء الاصطناعي المتقدم.',
    'home.service.lexai.f1': 'تحليل متعدد الأطر الزمنية',
    'home.service.lexai.f2': 'مستويات الدعم والمقاومة',
    'home.service.lexai.f3': 'نقاط الدخول والخروج',
    'home.service.lexai.f4': 'نصائح إدارة المخاطر',
    'home.service.lexai.cta': 'تفعيل LexAI (30 يوم)',
    'home.service.lexai.price': '$30 / شهرياً',
    
    // Already Registered
    'home.alreadyRegistered': 'مسجل مسبقاً؟',
    'home.loginHere': 'سجل الدخول هنا',
    
    // Contact Support
    'home.contact.title': 'تواصل مع الدعم',
    'home.contact.subtitle': 'هل لديك سؤال؟ أرسل لنا رسالة وسنعود إليك قريباً.',
    'home.contact.email': 'بريدك الإلكتروني',
    'home.contact.emailPlaceholder': 'email@example.com',
    'home.contact.message': 'رسالتك',
    'home.contact.messagePlaceholder': 'كيف يمكننا مساعدتك؟',
    'home.contact.send': 'إرسال الرسالة',
    'home.contact.sending': 'جاري الإرسال...',
    'home.contact.sent': 'تم إرسال الرسالة! سنعود إليك قريباً.',
    
    'home.footer.tagline': 'تمكين المتداولين في جميع أنحاء العالم بالمعرفة والمهارات العملية',
    'home.footer.rights': 'جميع الحقوق محفوظة.',
    
    // Dashboard
    'dashboard.title': 'مرحبًا بك مجددًا، {name}!',
    'dashboard.subtitle': 'تابع رحلتك التعليمية',
    'dashboard.settings': 'الإعدادات',
    'dashboard.logout': 'تسجيل الخروج',
    'dashboard.loading': 'جاري تحميل لوحتك...',
    'dashboard.signInTitle': 'مرحبًا بك في أكاديمية XFlex',
    'dashboard.signInDesc': 'سجل الدخول للوصول إلى لوحة التعلم',
    'dashboard.signInBtn': 'تسجيل الدخول للمتابعة',
    'dashboard.stats.totalCourses': 'إجمالي الدورات',
    'dashboard.stats.enrolledLabel': 'دورات مسجلة',
    'dashboard.stats.enrolledCourses': 'الدورات المسجلة',
    'dashboard.stats.courses': 'دورات نشطة',
    'dashboard.stats.completedCourses': 'مكتملة',
    'dashboard.stats.finished': 'دورات منتهية',
    'dashboard.stats.inProgress': 'قيد التقدم',
    'dashboard.stats.activeLearning': 'تعلم نشط',
    'dashboard.stats.avgProgress': 'متوسط التقدم',
    'dashboard.stats.overallCompletion': 'الإكمال العام',
    'dashboard.stats.quizzesPassed': 'الاختبارات المجتازة',
    'dashboard.stats.levels': 'مستويات الاختبار المكتملة',
    'dashboard.enrolledCourses.title': 'دوراتي',
    'dashboard.enrolledCourses.description': 'تابع التعلم وراقب تقدمك',
    'dashboard.noCoursesEnrolled': 'لم تسجل في أي دورات بعد',
    'dashboard.noCoursesTitle': 'لا توجد دورات بعد',
    'dashboard.noCoursesDesc': 'ابدأ التعلم بالتسجيل في دورة',
    'dashboard.browseCourses': 'تصفح الدورات',
    'dashboard.completed': 'مكتمل',
    'dashboard.episodes': 'حلقات',
    'dashboard.episodesCompleted': 'حلقات مكتملة',
    'dashboard.progress': 'التقدم',
    'dashboard.continue': 'متابعة التعلم',
    'dashboard.review': 'مراجعة الدورة',
    'dashboard.myAccess': 'وصولي',
    'dashboard.myAccessDesc': 'حالة اشتراكاتك مرتبطة ببريدك الإلكتروني.',
    'dashboard.courseAccess': 'الدورة',
    'dashboard.lexaiAccess': 'LexAI',
    'dashboard.recAccess': 'التوصيات',
    'dashboard.active': 'مفعل',
    'dashboard.notActive': 'غير مفعل',
    'dashboard.openCourses': 'فتح الدورات',
    'dashboard.openLexai': 'فتح LexAI',
    'dashboard.openRec': 'فتح التوصيات',
    'dashboard.activateRec': 'تفعيل التوصيات',
    'dashboard.nav.home': 'الرئيسية',
    'dashboard.nav.quizzes': 'الاختبارات',
    'dashboard.nav.lexai': 'LexAI',
    'dashboard.nav.rec': 'قروب التوصيات',
    'dashboard.quickActions.browseMore': 'استكشف المزيد',
    'dashboard.quickActions.discoverNewCourses': 'استكشف المزيد من دورات التداول وكسّع معلوماتك',
    'dashboard.quickActions.browseCourses': 'استعرض جميع الدورات',
    'dashboard.quickActions.aiAssistant': 'مساعد FlexAI',
    'dashboard.quickActions.getAIHelp': 'احصل على مساعدة فورية من مساعد الذكاء الاصطناعي للتداول',
    'dashboard.quickActions.openChat': 'فتح الدردشة',
    
    // LexAI
    'lexai.title': 'ليكس إيه آي - تحليل العملات بالذكاء الاصطناعي',
    'lexai.subscribe.title': 'اشترك في ليكس إيه آي',
    'lexai.subscribe.desc': 'احصل على تحليل العملات وتوصيات التداول بالذكاء الاصطناعي',
    'lexai.subscribe.price': '$29.99/شهريًا',
    'lexai.subscribe.feature1': '100 تحليل رسم بياني شهريًا',
    'lexai.subscribe.feature2': 'رؤى السوق في الوقت الفعلي',
    'lexai.subscribe.feature3': 'توصيات التداول',
    'lexai.subscribe.feature4': 'تقارير التحليل الفني',
    'lexai.subscribe.button': 'اشترك الآن',
    'lexai.chat.title': 'الدردشة مع ليكس إيه آي',
    'lexai.chat.remaining': 'تحليل متبقي هذا الشهر',
    'lexai.chat.placeholder': 'اسأل عن تحليل العملات أو قم بتحميل صورة الرسم البياني...',
    'lexai.chat.send': 'إرسال',
    'lexai.chat.uploadImage': 'تحميل صورة الرسم البياني',
    'lexai.chat.uploading': 'جاري التحميل...',
    
    // Admin
    'admin.dashboard': 'لوحة التحكم',
    'admin.courses': 'الدورات',
    'admin.episodes': 'الحلقات',
    'admin.users': 'المستخدمون والتسجيلات',
    'admin.totalUsers': 'إجمالي المستخدمين',
    'admin.totalCourses': 'إجمالي الدورات',
    'admin.activeEnrollments': 'التسجيلات النشطة',
    'admin.totalRevenue': 'إجمالي الإيرادات',
    
    // Auth Pages
    'auth.login.title': 'مرحبًا بعودتك',
    'auth.login.description': 'سجل الدخول لمتابعة التعلم',
    'auth.login.adminTitle': 'تسجيل دخول المسؤول',
    'auth.login.adminDescription': 'سجل الدخول للوصول إلى لوحة الإدارة',
    'auth.login.email': 'البريد الإلكتروني',
    'auth.login.password': 'كلمة المرور',
    'auth.login.emailPlaceholder': 'john@example.com',
    'auth.login.passwordPlaceholder': '••••••••',
    'auth.login.submit': 'تسجيل الدخول',
    'auth.login.submitting': 'جاري تسجيل الدخول...',
    'auth.login.allFieldsRequired': 'جميع الحقول مطلوبة',
    
    'auth.register.title': 'إنشاء حساب',
    'auth.register.description': 'سجل للبدء في تعلم التداول',
    'auth.register.fullName': 'الاسم الكامل',
    'auth.register.email': 'البريد الإلكتروني',
    'auth.register.password': 'كلمة المرور',
    'auth.register.confirmPassword': 'تأكيد كلمة المرور',
    'auth.register.namePlaceholder': 'أحمد محمد',
    'auth.register.emailPlaceholder': 'ahmad@example.com',
    'auth.register.passwordPlaceholder': '••••••••',
    'auth.register.passwordHint': 'على الأقل 8 أحرف مع حرف كبير وحرف صغير ورقم واحد',
    'auth.register.submit': 'إنشاء حساب',
    'auth.register.submitting': 'جاري إنشاء الحساب...',
    'auth.register.allFieldsRequired': 'جميع الحقول مطلوبة',
    'auth.register.passwordMismatch': 'كلمات المرور غير متطابقة',
    'auth.register.passwordTooShort': 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
    
    'auth.page.backToHome': '→ العودة إلى الصفحة الرئيسية',
    'auth.page.tagline': 'أتقن فن التداول',
    'auth.page.switchToRegister': 'ليس لديك حساب؟',
    'auth.page.switchToLogin': 'هل لديك حساب بالفعل؟',
    'auth.page.signUp': 'سجل',
    'auth.page.signIn': 'تسجيل الدخول',
    
    // Profile Page
    'profile.title': 'إعدادات الحساب',
    'profile.description': 'إدارة ملفك الشخصي وإعدادات الأمان',
    'profile.backToDashboard': 'العودة إلى لوحة التحكم',
    'profile.email': 'البريد الإلكتروني',
    'profile.emailReadonly': 'لا يمكن تغيير البريد الإلكتروني',
    'profile.name': 'الاسم الكامل',
    'profile.nameplaceholder': 'أدخل اسمك الكامل',
    'profile.phone': 'رقم الهاتف',
    'profile.phoneExample': '+966 50 000 0000',
    'profile.saveChanges': 'حفظ التغييرات',
    'profile.updating': 'جاري الحفظ...',
    'profile.cancel': 'إلغاء',
    'profile.updates.success': 'تم تحديث الملف الشخصي بنجاح',
    'profile.error': 'خطأ',
    
    'profile.profileInfo.title': 'معلومات الملف الشخصي',
    'profile.profileInfo.description': 'حدث معلوماتك الشخصية',
    
    'profile.security.title': 'الأمان',
    'profile.security.description': 'إدارة كلمة المرور والإعدادات الأمنية',
    'profile.password.change': 'تغيير كلمة المرور',
    'profile.password.current': 'كلمة المرور الحالية',
    'profile.password.new': 'كلمة المرور الجديدة',
    'profile.password.confirm': 'تأكيد كلمة المرور الجديدة',
    'profile.password.enterCurrent': 'أدخل كلمة المرور الحالية',
    'profile.password.enterNew': 'أدخل كلمة المرور الجديدة',
    'profile.password.confirmNew': 'أكد كلمة المرور الجديدة',
    'profile.password.requirements': 'الحد الأدنى 8 أحرف مع أحرف كبيرة وصغيرة وأرقام',
    'profile.password.allFieldsRequired': 'جميع حقول كلمة المرور مطلوبة',
    'profile.password.mismatch': 'كلمات المرور الجديدة غير متطابقة',
    'profile.password.tooShort': 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
    'profile.password.changed': 'تم تغيير كلمة المرور بنجاح',
    'profile.password.update': 'تحديث كلمة المرور',
    'profile.password.updating': 'جاري تحديث كلمة المرور...',
    
    // Common
    'common.loading': 'جاري التحميل...',
    'common.error': 'خطأ',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.create': 'إنشاء',
    'common.back': 'رجوع',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get language from localStorage or default to Arabic
    const saved = localStorage.getItem('language');
    return (saved === 'ar' || saved === 'en') ? saved : 'ar';
  });

  useEffect(() => {
    // Save language preference
    localStorage.setItem('language', language);
    
    // Update document direction and lang attribute
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
