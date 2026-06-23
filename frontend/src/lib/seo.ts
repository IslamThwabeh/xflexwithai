import { useEffect } from "react";
import {
  DEFAULT_SOCIAL_IMAGE,
  SITE_NAME,
  SITE_ORIGIN,
  getSeoCopy,
  localizedPath,
  type SeoLanguage,
  type SeoRouteKey,
} from "@shared/seo";

type SeoOverride = {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

function setMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element!.setAttribute(name, value));
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function applySeoMetadata(key: SeoRouteKey, language: SeoLanguage, override: SeoOverride = {}) {
  const { route, copy } = getSeoCopy(key, language);
  const title = override.title || copy.title;
  const description = override.description || copy.description;
  const image = override.image || route.image || DEFAULT_SOCIAL_IMAGE;
  const canonicalPath = override.canonicalPath || localizedPath(route.path, language);
  const canonical = `${SITE_ORIGIN}${canonicalPath}`;
  const alternateLanguage = language === "ar" ? "en" : "ar";
  const alternate = `${SITE_ORIGIN}${localizedPath(route.path, alternateLanguage)}`;

  document.title = title;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[name="robots"]', { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" });
  setMeta('meta[property="og:type"]', { property: "og:type", content: override.type || "website" });
  setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[property="og:image"]', { property: "og:image", content: image });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  setMeta('meta[property="og:locale"]', { property: "og:locale", content: language === "ar" ? "ar_AR" : "en_US" });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
  setLink("canonical", canonical);
  setLink("alternate", canonical, language);
  setLink("alternate", alternate, alternateLanguage);
  setLink("alternate", `${SITE_ORIGIN}/ar${route.path}`, "x-default");

  document.head.querySelectorAll('script[data-xflex-seo="json-ld"]').forEach((node) => node.remove());
  const schemas = override.jsonLd
    ? (Array.isArray(override.jsonLd) ? override.jsonLd : [override.jsonLd])
    : [];
  schemas.forEach((schema) => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.xflexSeo = "json-ld";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

export function useSeoMetadata(key: SeoRouteKey, language: SeoLanguage, override: SeoOverride = {}) {
  const serializedJsonLd = JSON.stringify(override.jsonLd || null);
  useEffect(() => {
    applySeoMetadata(key, language, override);
    // The serialized value keeps structured-data updates deterministic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    key,
    language,
    override.title,
    override.description,
    override.image,
    override.canonicalPath,
    override.type,
    serializedJsonLd,
  ]);
}
