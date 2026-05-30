ALTER TABLE brokers ADD COLUMN offerSummaryEn TEXT;
ALTER TABLE brokers ADD COLUMN offerSummaryAr TEXT;
ALTER TABLE brokers ADD COLUMN supportHoursEn TEXT;
ALTER TABLE brokers ADD COLUMN supportHoursAr TEXT;
ALTER TABLE brokers ADD COLUMN fundingMethodsEn TEXT;
ALTER TABLE brokers ADD COLUMN fundingMethodsAr TEXT;
ALTER TABLE brokers ADD COLUMN accountRequirementsEn TEXT;
ALTER TABLE brokers ADD COLUMN accountRequirementsAr TEXT;

INSERT INTO brokers (
  nameEn,
  nameAr,
  descriptionEn,
  descriptionAr,
  logoUrl,
  affiliateUrl,
  supportWhatsapp,
  minDeposit,
  minDepositCurrency,
  featuresEn,
  featuresAr,
  offerSummaryEn,
  offerSummaryAr,
  supportHoursEn,
  supportHoursAr,
  fundingMethodsEn,
  fundingMethodsAr,
  accountRequirementsEn,
  accountRequirementsAr,
  videoOpenAccount,
  videoVerify,
  videoDeposit,
  isActive,
  displayOrder
)
SELECT
  'VT Markets',
  'في تي ماركتس',
  'Open your live VT Markets account, complete the broker setup, and move into real-market execution with XFlex support.',
  'افتح حسابك الحقيقي في VT Markets، وأكمل إعداد الوسيط، وابدأ التنفيذ في السوق الحقيقي مع دعم XFlex.',
  'https://www.vtmarkets.com/wp-content/themes/vt/images/header_logo_white.webp',
  'https://vtm.pro/Fjyi2e',
  '+201283099406',
  50,
  'USD',
  '["$50 minimum deposit","50% first deposit bonus","20% bonus on later deposits","WhatsApp support","Card, bank, and USDT funding"]',
  '["الحد الأدنى 50$","بونص 50٪ على أول إيداع","بونص 20٪ على الإيداعات التالية","دعم عبر واتساب","إيداع عبر البطاقة والبنك وUSDT"]',
  'Launch offer: you cover the academy subscription and the broker offer helps with half of your first deposit through a 50% bonus. Later deposits receive a 20% bonus.',
  'عرض الإطلاق: الاشتراك عليك، وعرض الوسيط يساعدك بنصف قيمة أول إيداع عبر بونص 50٪. وبعدها تحصل على بونص 20٪ على الإيداعات التالية.',
  'VT Markets support is available on WhatsApp from Monday to Friday. Saturday is off.',
  'دعم VT Markets متاح عبر واتساب من الاثنين إلى الجمعة، والسبت عطلة.',
  'Funding works through Arab Bank, Reflect, Bank of Palestine, USDT, bank transfer, and Visa or Mastercard.',
  'الإيداع والسحب متاحان عبر بنك عربي وReflect وبنك فلسطين وUSDT، وكذلك عبر الحوالات البنكية والفيزا كارد.',
  'Personal details on the trading account should match the bank card details. The card should support online purchases and the deposit amount should be in USD.',
  'يجب أن تكون المعلومات الشخصية في الحساب مطابقة لمعلومات البطاقة البنكية، وأن تكون البطاقة مفعلة للشراء عبر الإنترنت، وأن يكون مبلغ الإيداع بالدولار.',
  'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4',
  'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4',
  'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4',
  1,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM brokers WHERE lower(nameEn) = 'vt markets'
);

UPDATE brokers
SET
  logoUrl = CASE WHEN lower(nameEn) = 'vt markets' THEN 'https://www.vtmarkets.com/wp-content/themes/vt/images/header_logo_white.webp' ELSE logoUrl END,
  affiliateUrl = CASE WHEN lower(nameEn) = 'vt markets' THEN 'https://vtm.pro/Fjyi2e' ELSE affiliateUrl END,
  supportWhatsapp = CASE WHEN lower(nameEn) = 'vt markets' THEN '+201283099406' ELSE supportWhatsapp END,
  minDeposit = CASE WHEN lower(nameEn) = 'vt markets' THEN 50 ELSE minDeposit END,
  minDepositCurrency = CASE WHEN lower(nameEn) = 'vt markets' THEN 'USD' ELSE minDepositCurrency END,
  featuresEn = CASE WHEN lower(nameEn) = 'vt markets' THEN '["$50 minimum deposit","50% first deposit bonus","20% bonus on later deposits","WhatsApp support","Card, bank, and USDT funding"]' ELSE featuresEn END,
  featuresAr = CASE WHEN lower(nameEn) = 'vt markets' THEN '["الحد الأدنى 50$","بونص 50٪ على أول إيداع","بونص 20٪ على الإيداعات التالية","دعم عبر واتساب","إيداع عبر البطاقة والبنك وUSDT"]' ELSE featuresAr END,
  offerSummaryEn = CASE WHEN lower(nameEn) = 'vt markets' THEN 'Launch offer: you cover the academy subscription and the broker offer helps with half of your first deposit through a 50% bonus. Later deposits receive a 20% bonus.' ELSE offerSummaryEn END,
  offerSummaryAr = CASE WHEN lower(nameEn) = 'vt markets' THEN 'عرض الإطلاق: الاشتراك عليك، وعرض الوسيط يساعدك بنصف قيمة أول إيداع عبر بونص 50٪. وبعدها تحصل على بونص 20٪ على الإيداعات التالية.' ELSE offerSummaryAr END,
  supportHoursEn = CASE WHEN lower(nameEn) = 'vt markets' THEN 'VT Markets support is available on WhatsApp from Monday to Friday. Saturday is off.' ELSE supportHoursEn END,
  supportHoursAr = CASE WHEN lower(nameEn) = 'vt markets' THEN 'دعم VT Markets متاح عبر واتساب من الاثنين إلى الجمعة، والسبت عطلة.' ELSE supportHoursAr END,
  fundingMethodsEn = CASE WHEN lower(nameEn) = 'vt markets' THEN 'Funding works through Arab Bank, Reflect, Bank of Palestine, USDT, bank transfer, and Visa or Mastercard.' ELSE fundingMethodsEn END,
  fundingMethodsAr = CASE WHEN lower(nameEn) = 'vt markets' THEN 'الإيداع والسحب متاحان عبر بنك عربي وReflect وبنك فلسطين وUSDT، وكذلك عبر الحوالات البنكية والفيزا كارد.' ELSE fundingMethodsAr END,
  accountRequirementsEn = CASE WHEN lower(nameEn) = 'vt markets' THEN 'Personal details on the trading account should match the bank card details. The card should support online purchases and the deposit amount should be in USD.' ELSE accountRequirementsEn END,
  accountRequirementsAr = CASE WHEN lower(nameEn) = 'vt markets' THEN 'يجب أن تكون المعلومات الشخصية في الحساب مطابقة لمعلومات البطاقة البنكية، وأن تكون البطاقة مفعلة للشراء عبر الإنترنت، وأن يكون مبلغ الإيداع بالدولار.' ELSE accountRequirementsAr END,
  videoOpenAccount = CASE WHEN lower(nameEn) = 'vt markets' THEN 'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4' ELSE videoOpenAccount END,
  videoVerify = CASE WHEN lower(nameEn) = 'vt markets' THEN 'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4' ELSE videoVerify END,
  videoDeposit = CASE WHEN lower(nameEn) = 'vt markets' THEN 'https://videos.xflexacademy.com/brokers/vt-markets/onboarding-guide.mp4' ELSE videoDeposit END,
  displayOrder = CASE
    WHEN lower(nameEn) = 'vt markets' THEN 1
    WHEN lower(nameEn) = 'equiti' THEN 2
    ELSE displayOrder
  END,
  updatedAt = CURRENT_TIMESTAMP
WHERE lower(nameEn) IN ('vt markets', 'equiti');