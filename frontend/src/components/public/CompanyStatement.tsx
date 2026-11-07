import { useLanguage } from '@/contexts/LanguageContext';
import { COMPANY_PUBLIC_INFO } from '@shared/companyPublicInfo';

export default function CompanyStatement({ className = '' }: { className?: string }) {
  const { language } = useLanguage();
  return <p className={className}>{COMPANY_PUBLIC_INFO[language].statement}</p>;
}
