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
    'dashboard.title': 'My Learning Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.enrolledCourses': 'Enrolled Courses',
    'dashboard.noCourses': 'You haven\'t enrolled in any courses yet.',
    'dashboard.browseCourses': 'Browse Courses',
    'dashboard.continueLearning': 'Continue Learning',
    'dashboard.progress': 'Progress',
    'dashboard.episodes': 'episodes',
    
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
    'dashboard.title': 'لوحة التعلم الخاصة بي',
    'dashboard.welcome': 'مرحبًا بعودتك',
    'dashboard.enrolledCourses': 'الدورات المسجلة',
    'dashboard.noCourses': 'لم تسجل في أي دورات بعد.',
    'dashboard.browseCourses': 'تصفح الدورات',
    'dashboard.continueLearning': 'متابعة التعلم',
    'dashboard.progress': 'التقدم',
    'dashboard.episodes': 'حلقات',
    
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
