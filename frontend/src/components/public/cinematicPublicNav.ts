export type CinematicPrimaryNavItem = {
  key: 'packages' | 'story' | 'mentor' | 'terms' | 'refund' | 'faq' | 'login';
  sectionId: 'packages' | 'story' | 'mentor' | 'terms' | 'refund' | 'faq' | 'auth';
  href: string;
  labelEn: string;
  labelAr: string;
};

export const CINEMATIC_PRIMARY_NAV_ITEMS: CinematicPrimaryNavItem[] = [
  {
    key: 'packages',
    sectionId: 'packages',
    href: '/#packages',
    labelEn: 'Packages',
    labelAr: 'الباقات',
  },
  {
    key: 'story',
    sectionId: 'story',
    href: '/#story',
    labelEn: 'Curriculum',
    labelAr: 'المسار',
  },
  {
    key: 'mentor',
    sectionId: 'mentor',
    href: '/#mentor',
    labelEn: 'Mentor',
    labelAr: 'المدرب',
  },
  {
    key: 'terms',
    sectionId: 'terms',
    href: '/terms',
    labelEn: 'Terms',
    labelAr: 'الشروط',
  },
  {
    key: 'refund',
    sectionId: 'refund',
    href: '/refund-policy',
    labelEn: 'Refund Policy',
    labelAr: 'سياسة الاسترداد',
  },
  {
    key: 'faq',
    sectionId: 'faq',
    href: '/#faq',
    labelEn: 'FAQ',
    labelAr: 'الأسئلة',
  },
  {
    key: 'login',
    sectionId: 'auth',
    href: '/auth',
    labelEn: 'Login',
    labelAr: 'تسجيل الدخول',
  },
];

export const DEFAULT_CINEMATIC_PRIMARY_ACTION = {
  href: '/#packages',
  labelEn: 'Get Started',
  labelAr: 'ابدأ الآن',
};
