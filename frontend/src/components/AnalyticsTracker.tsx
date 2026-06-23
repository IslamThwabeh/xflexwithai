import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function classifyAiReferrer(referrer: string) {
  const host = (() => {
    try { return new URL(referrer).hostname.toLowerCase(); } catch { return ""; }
  })();
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt";
  if (host.includes("perplexity")) return "perplexity";
  if (host.includes("gemini") || host.includes("bard.google")) return "gemini";
  if (host.includes("copilot") || host.includes("bing.com")) return "copilot";
  if (host.includes("claude")) return "claude";
  return "";
}

export default function AnalyticsTracker() {
  const [location] = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    const aiReferrer = classifyAiReferrer(document.referrer)
      || window.sessionStorage.getItem("xflex_ai_referrer")
      || "";
    if (aiReferrer) window.sessionStorage.setItem("xflex_ai_referrer", aiReferrer);
    window.gtag?.("event", "page_view", {
      page_path: `${location}${window.location.search}`,
      page_location: window.location.href,
      content_language: language,
      ai_referrer: aiReferrer || undefined,
    });
  }, [language, location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = anchor.href;
      let conversionType = "";
      if (/wa\.me|whatsapp/i.test(href)) conversionType = "whatsapp";
      else if (/\/contact(?:[/?#]|$)/.test(href)) conversionType = "contact";
      else if (/\/(?:register|signup)(?:[/?#]|$)/.test(href)) conversionType = "registration";
      else if (/\/(?:ar|en)\/packages\//.test(href)) conversionType = "package_view";
      if (!conversionType) return;
      window.gtag?.("event", "seo_conversion", {
        conversion_type: conversionType,
        destination: href,
        content_language: language,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [language]);

  return null;
}
