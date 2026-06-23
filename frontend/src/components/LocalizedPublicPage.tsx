import { useEffect, type ReactNode } from "react";
import { useSeoMetadata } from "@/lib/seo";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildPageStructuredData, type SeoLanguage, type SeoRouteKey } from "@shared/seo";

export default function LocalizedPublicPage({
  language,
  seoKey,
  children,
}: {
  language: SeoLanguage;
  seoKey: SeoRouteKey;
  children: ReactNode;
}) {
  const { setLanguage } = useLanguage();
  useSeoMetadata(seoKey, language, { jsonLd: buildPageStructuredData(seoKey, language) });

  useEffect(() => {
    if (window.localStorage.getItem("language") !== language) setLanguage(language);
  }, [language, setLanguage]);

  return <>{children}</>;
}
