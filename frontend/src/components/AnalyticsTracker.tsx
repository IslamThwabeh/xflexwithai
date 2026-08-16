import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  buildSafePageLocation,
  buildSafeReferrer,
  getAnalyticsLanguage,
  getAnalyticsPageType,
  getSessionAiReferrer,
  isAnalyticsEligiblePath,
  trackAnalyticsEvent,
  trackContactClick,
  trackPackageSelection,
  trackRegistrationCta,
} from "@/lib/analytics";

export default function AnalyticsTracker() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const previousPageRef = useRef("");
  const lastPageViewRef = useRef("");

  useEffect(() => {
    const pathname = window.location.pathname;
    if (!isAnalyticsEligiblePath(pathname)) return;
    // Public pages are lazy-loaded and apply their localized SEO metadata after
    // the route first mounts. A short delay prevents recording the shell title.
    const timer = window.setTimeout(() => {
      const pageLocation = buildSafePageLocation(window.location.href);
      if (lastPageViewRef.current === pageLocation) return;
      const contentLanguage = getAnalyticsLanguage(pathname, language);
      const pageReferrer = previousPageRef.current || buildSafeReferrer(document.referrer);
      trackAnalyticsEvent("page_view", {
        page_path: pathname,
        page_location: pageLocation,
        page_referrer: pageReferrer || undefined,
        page_title: document.title,
        page_type: getAnalyticsPageType(pathname) || undefined,
        content_language: contentLanguage,
        ai_referrer: getSessionAiReferrer() || undefined,
      }, pathname);
      previousPageRef.current = pageLocation;
      lastPageViewRef.current = pageLocation;
    }, 500);
    return () => window.clearTimeout(timer);
  }, [language, location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const pathname = window.location.pathname;
      if (!isAnalyticsEligiblePath(pathname)) return;
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const contentLanguage = getAnalyticsLanguage(pathname, language);
      const rawHref = anchor.getAttribute("href") || "";
      const destination = (() => {
        try {
          return new URL(rawHref, window.location.origin);
        } catch {
          return null;
        }
      })();
      if (!destination) return;

      const packageMatch = destination.pathname.match(/^\/(?:(?:ar|en)\/)?packages\/([a-z0-9-]+)\/?$/i);
      if (packageMatch) {
        trackPackageSelection(packageMatch[1], contentLanguage);
        return;
      }
      if (destination.hostname === "wa.me" || /whatsapp/i.test(destination.hostname)) {
        trackContactClick("whatsapp", contentLanguage, destination.hostname);
        return;
      }
      if (destination.protocol === "mailto:") {
        trackContactClick("email", contentLanguage);
        return;
      }
      if (destination.protocol === "tel:") {
        trackContactClick("phone", contentLanguage);
        return;
      }
      if (/^\/(?:(?:ar|en)\/)?contact\/?$/.test(destination.pathname)) {
        trackContactClick("contact_page", contentLanguage, destination.hostname);
        return;
      }
      if (/^\/(?:(?:ar|en)\/)?(?:auth|register|signup)\/?$/.test(destination.pathname)
          && (destination.pathname.includes("register")
            || destination.pathname.includes("signup")
            || destination.searchParams.get("mode") === "register")) {
        trackRegistrationCta(contentLanguage);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [language]);

  return null;
}
