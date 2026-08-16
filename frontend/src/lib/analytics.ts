import {
  DEFAULT_GA_MEASUREMENT_ID,
  SEO_ROUTES,
  localizedPath,
  type SeoLanguage,
  type SeoPageType,
} from "../../../shared/seo";

export type AnalyticsPageType = SeoPageType | "registration" | "checkout";
export type AnalyticsEventParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    __xflexAnalyticsConfigured?: boolean;
    __xflexAnalyticsMeasurementId?: string;
  }
}

const GA_SCRIPT_ID = "xflex-ga4-script";
const SAFE_ATTRIBUTION_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

const normalizedPath = (pathname: string) => {
  const value = pathname.split("?")[0]?.split("#")[0] || "/";
  if (value === "/") return value;
  return value.replace(/\/+$/, "") || "/";
};

const LOCALIZED_SEO_PATHS = new Map<string, SeoPageType>(
  SEO_ROUTES.flatMap(route =>
    (["ar", "en"] as const).map(language => [
      normalizedPath(localizedPath(route.path, language)),
      route.type,
    ] as const),
  ),
);

export function getAnalyticsPageType(pathname: string): AnalyticsPageType | null {
  const path = normalizedPath(pathname);
  const staticPageType = LOCALIZED_SEO_PATHS.get(path);
  if (staticPageType) return staticPageType;
  if (/^\/(?:ar|en)\/articles\/[^/]+$/.test(path)) return "article";
  if (/^\/(?:(?:ar|en)\/)?(?:auth|login|register|signup)$/.test(path)) return "registration";
  if (/^\/checkout\/[a-z0-9-]+$/i.test(path)) return "checkout";
  return null;
}

export function isAnalyticsEligiblePath(pathname: string) {
  return getAnalyticsPageType(pathname) !== null;
}

export function getAnalyticsLanguage(
  pathname: string,
  fallback: SeoLanguage,
): SeoLanguage {
  const locale = normalizedPath(pathname).match(/^\/(ar|en)(?:\/|$)/)?.[1];
  return locale === "ar" || locale === "en" ? locale : fallback;
}

export function buildSafePageLocation(input: string) {
  const baseOrigin = typeof window === "undefined" ? "https://xflexacademy.com" : window.location.origin;
  const url = new URL(input, baseOrigin);
  const safeParameters = new URLSearchParams();
  for (const key of SAFE_ATTRIBUTION_PARAMETERS) {
    for (const value of url.searchParams.getAll(key)) {
      safeParameters.append(key, value.slice(0, 200));
    }
  }
  const query = safeParameters.toString();
  return `${url.origin}${normalizedPath(url.pathname)}${query ? `?${query}` : ""}`;
}

export function buildSafeReferrer(input: string) {
  if (!input) return "";
  try {
    const url = new URL(input);
    return `${url.origin}${normalizedPath(url.pathname)}`;
  } catch {
    return "";
  }
}

export function classifyAiReferrer(referrer: string) {
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host === "chat.openai.com") return "chatgpt";
    if (host === "perplexity.ai" || host.endsWith(".perplexity.ai")) return "perplexity";
    if (host === "gemini.google.com" || host === "bard.google.com") return "gemini";
    if (host === "copilot.microsoft.com" || (/\bbing\.com$/.test(host) && /^\/(?:chat|copilot)(?:\/|$)/.test(path))) return "copilot";
    if (host === "claude.ai" || host.endsWith(".claude.ai")) return "claude";
    return "";
  } catch {
    return "";
  }
}

export function getSessionAiReferrer() {
  const detected = classifyAiReferrer(document.referrer);
  try {
    const stored = window.sessionStorage.getItem("xflex_ai_referrer") || "";
    const value = detected || stored;
    if (value) window.sessionStorage.setItem("xflex_ai_referrer", value);
    return value;
  } catch {
    return detected;
  }
}

export function ensureAnalyticsReady(pathname = window.location.pathname) {
  if (!isAnalyticsEligiblePath(pathname)) return false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  if (!window.__xflexAnalyticsConfigured) {
    window.gtag("js", new Date());
    window.gtag("config", DEFAULT_GA_MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: buildSafePageLocation(window.location.href),
      page_referrer: buildSafeReferrer(document.referrer) || undefined,
    });
    window.__xflexAnalyticsConfigured = true;
    window.__xflexAnalyticsMeasurementId = DEFAULT_GA_MEASUREMENT_ID;
  }

  if (!document.getElementById(GA_SCRIPT_ID)
      && !document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${DEFAULT_GA_MEASUREMENT_ID}"]`)) {
    const script = document.createElement("script");
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${DEFAULT_GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
  return true;
}

export function trackAnalyticsEvent(
  eventName: string,
  parameters: AnalyticsEventParams = {},
  pathname = window.location.pathname,
) {
  if (!ensureAnalyticsReady(pathname)) return false;
  const cleanParameters = Object.fromEntries(
    Object.entries({
      page_path: normalizedPath(pathname),
      page_location: buildSafePageLocation(window.location.href),
      page_referrer: buildSafeReferrer(document.referrer) || undefined,
      ...parameters,
    }).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
  window.gtag?.("event", eventName, cleanParameters);
  return true;
}

type PackageEvent = {
  slug: string;
  name: string;
  valueIls: number;
  language: SeoLanguage;
};

const packageItem = ({ slug, name, valueIls, language }: PackageEvent) => ({
  item_id: slug,
  item_name: name,
  item_category: "trading_education",
  item_variant: language,
  price: valueIls,
  quantity: 1,
});

export function trackPackageView(details: PackageEvent) {
  return trackAnalyticsEvent("view_item", {
    currency: "ILS",
    value: details.valueIls,
    content_language: details.language,
    items: [packageItem(details)],
  });
}

export function trackPackageSelection(slug: string, language: SeoLanguage) {
  return trackAnalyticsEvent("select_item", {
    item_list_name: "public_site_packages",
    content_language: language,
    items: [{ item_id: slug, item_category: "trading_education" }],
  });
}

export function trackRegistrationStart(language: SeoLanguage) {
  return trackAnalyticsEvent("registration_start", {
    method: "website_form",
    content_language: language,
  });
}

export function trackSignUp(language: SeoLanguage, referralPresent: boolean) {
  return trackAnalyticsEvent("sign_up", {
    method: "password",
    content_language: language,
    referral_present: referralPresent,
  });
}

export function trackBeginCheckout(details: PackageEvent) {
  return trackAnalyticsEvent("begin_checkout", {
    currency: "ILS",
    value: details.valueIls,
    content_language: details.language,
    items: [packageItem(details)],
  });
}

export function trackOrderRequest(details: PackageEvent) {
  return trackAnalyticsEvent("order_request", {
    currency: "ILS",
    value: details.valueIls,
    content_language: details.language,
    items: [packageItem(details)],
  });
}

export function trackGenerateLead(language: SeoLanguage) {
  return trackAnalyticsEvent("generate_lead", {
    lead_source: "contact_form",
    content_language: language,
  });
}

export function trackContactClick(
  method: "whatsapp" | "email" | "phone" | "contact_page",
  language: SeoLanguage,
  destinationDomain?: string,
) {
  return trackAnalyticsEvent("contact_click", {
    contact_method: method,
    content_language: language,
    destination_domain: destinationDomain,
  });
}

export function trackRegistrationCta(language: SeoLanguage) {
  return trackAnalyticsEvent("select_content", {
    content_type: "registration_cta",
    content_id: "registration",
    content_language: language,
  });
}
