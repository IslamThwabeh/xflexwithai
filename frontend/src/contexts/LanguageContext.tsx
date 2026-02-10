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
    
    'home.footer.tagline': 'Empowering traders worldwide with expert knowledge and practical skills',
    'home.footer.quickLinks': 'Quick Links',
    'home.footer.aboutUs': 'About Us',
    'home.footer.courses': 'Courses',
    'home.footer.pricing': 'Pricing',
    'home.footer.contact': 'Contact',
    'home.footer.support': 'Support',
    'home.footer.helpCenter': 'Help Center',
    'home.footer.terms': 'Terms of Service',
    'home.footer.privacy': 'Privacy Policy',
    'home.footer.faq': 'FAQ',
    'home.footer.newsletter': 'Newsletter',
    'home.footer.newsletterDesc': 'Subscribe to get trading tips and course updates',
    'home.footer.emailPlaceholder': 'Your email',
    'home.footer.subscribe': 'Subscribe',
    'home.footer.rights': 'All rights reserved.',
    
    // Dashboard
    'dashboard.title': 'Welcome back, {name}!',
    'dashboard.settings': 'Settings',
    'dashboard.logout': 'Logout',
    'dashboard.loading': 'Loading your dashboard...',
    'dashboard.stats.enrolledCourses': 'Enrolled Courses',
    'dashboard.stats.courses': 'active courses',
    'dashboard.stats.completedCourses': 'Completed Courses',
    'dashboard.stats.finished': 'finished courses',
    'dashboard.stats.quizzesPassed': 'Quizzes Passed',
    'dashboard.stats.levels': 'quiz levels completed',
    'dashboard.enrolledCourses.title': 'My Courses',
    'dashboard.enrolledCourses.description': 'Continue learning and track your progress',
    'dashboard.noCoursesEnrolled': 'You haven\'t enrolled in any courses yet',
    'dashboard.browseCourses': 'Browse Courses',
    'dashboard.completed': 'complete',
    'dashboard.episodes': 'episodes',
    'dashboard.continue': 'Continue',
    'dashboard.review': 'Review',
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
    
    'home.footer.tagline': 'تمكين المتداولين في جميع أنحاء العالم بالمعرفة والمهارات العملية',
    'home.footer.quickLinks': 'روابط سريعة',
    'home.footer.aboutUs': 'من نحن',
    'home.footer.courses': 'الدورات',
    'home.footer.pricing': 'الأسعار',
    'home.footer.contact': 'اتصل بنا',
    'home.footer.support': 'الدعم',
    'home.footer.helpCenter': 'مركز المساعدة',
    'home.footer.terms': 'شروط الخدمة',
    'home.footer.privacy': 'سياسة الخصوصية',
    'home.footer.faq': 'الأسئلة الشائعة',
    'home.footer.newsletter': 'النشرة الإخبارية',
    'home.footer.newsletterDesc': 'اشترك للحصول على نصائح التداول وتحديثات الدورة',
    'home.footer.emailPlaceholder': 'بريدك الإلكتروني',
    'home.footer.subscribe': 'اشترك',
    'home.footer.rights': 'جميع الحقوق محفوظة.',
    
    // Dashboard
    'dashboard.title': 'مرحبًا بك مجددًا، {name}!',
    'dashboard.settings': 'الإعدادات',
    'dashboard.logout': 'تسجيل الخروج',
    'dashboard.loading': 'جاري تحميل لوحتك...',
    'dashboard.stats.enrolledCourses': 'الدورات المسجلة',
    'dashboard.stats.courses': 'دورات نشطة',
    'dashboard.stats.completedCourses': 'الدورات المكتملة',
    'dashboard.stats.finished': 'دورات منتهية',
    'dashboard.stats.quizzesPassed': 'الاختبارات المجتازة',
    'dashboard.stats.levels': 'مستويات الاختبار المكتملة',
    'dashboard.enrolledCourses.title': 'دوراتي',
    'dashboard.enrolledCourses.description': 'تابع التعلم وراقب تقدمك',
    'dashboard.noCoursesEnrolled': 'لم تسجل في أي دورات بعد',
    'dashboard.browseCourses': 'تصفح الدورات',
    'dashboard.completed': 'مكتمل',
    'dashboard.episodes': 'حلقات',
    'dashboard.continue': 'متابعة',
    'dashboard.review': 'مراجعة',
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
