import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSafePageLocation,
  buildSafeReferrer,
  classifyAiReferrer,
  getAnalyticsLanguage,
  getAnalyticsPageType,
  isAnalyticsEligiblePath,
  trackAnalyticsEvent,
} from "../frontend/src/lib/analytics";

describe("public acquisition analytics contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows only explicit public and acquisition routes", () => {
    expect(getAnalyticsPageType("/ar")).toBe("home");
    expect(getAnalyticsPageType("/en/packages/comprehensive")).toBe("course");
    expect(getAnalyticsPageType("/ar/articles/risk-management")).toBe("article");
    expect(getAnalyticsPageType("/register")).toBe("registration");
    expect(getAnalyticsPageType("/checkout/basic")).toBe("checkout");

    for (const privatePath of [
      "/admin",
      "/admin/dashboard",
      "/dashboard",
      "/courses",
      "/course/1",
      "/orders",
      "/support",
      "/community",
      "/recommendations",
    ]) {
      expect(isAnalyticsEligiblePath(privatePath), privatePath).toBe(false);
    }
  });

  it("derives language from the URL and uses the fallback only for unlocalized acquisition", () => {
    expect(getAnalyticsLanguage("/ar/contact", "en")).toBe("ar");
    expect(getAnalyticsLanguage("/en/articles", "ar")).toBe("en");
    expect(getAnalyticsLanguage("/checkout/basic", "ar")).toBe("ar");
  });

  it("keeps campaign attribution while removing email, referral, next, and arbitrary query values", () => {
    expect(buildSafePageLocation(
      "https://xflexacademy.com/register?utm_source=google&utm_campaign=academy&email=person%40example.com&ref=SECRET&next=%2Forders&unknown=value",
    )).toBe("https://xflexacademy.com/register?utm_source=google&utm_campaign=academy");
    expect(buildSafeReferrer("https://example.com/search?q=private#result"))
      .toBe("https://example.com/search");
  });

  it("distinguishes AI assistants from ordinary Bing and Google search traffic", () => {
    expect(classifyAiReferrer("https://chatgpt.com/c/123")).toBe("chatgpt");
    expect(classifyAiReferrer("https://www.perplexity.ai/search/example")).toBe("perplexity");
    expect(classifyAiReferrer("https://gemini.google.com/app/123")).toBe("gemini");
    expect(classifyAiReferrer("https://www.bing.com/chat?q=academy")).toBe("copilot");
    expect(classifyAiReferrer("https://www.bing.com/search?q=academy")).toBe("");
    expect(classifyAiReferrer("https://www.google.com/search?q=academy")).toBe("");
  });

  it("does not initialize or emit events on private routes", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/admin/dashboard", origin: "https://xflexacademy.com" },
      dataLayer: [],
      gtag,
    });
    expect(trackAnalyticsEvent("page_view", {}, "/admin/dashboard")).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("initializes without an automatic page view and emits the requested public event", () => {
    const gtag = vi.fn();
    const appendChild = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/ar",
        origin: "https://xflexacademy.com",
        href: "https://xflexacademy.com/ar?utm_source=google&email=private%40example.com",
      },
      dataLayer: [],
      gtag,
      __xflexAnalyticsConfigured: false,
    });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => null),
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => ({})),
      head: { appendChild },
      referrer: "https://www.google.com/search?q=private",
    });

    expect(trackAnalyticsEvent("page_view", { page_path: "/ar" }, "/ar")).toBe(true);
    expect(gtag).toHaveBeenCalledWith("config", "G-FF2Z99PWHG", expect.objectContaining({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    }));
    expect(gtag).toHaveBeenCalledWith("event", "page_view", expect.objectContaining({
      page_path: "/ar",
      page_location: "https://xflexacademy.com/ar?utm_source=google",
      page_referrer: "https://www.google.com/search",
    }));
    expect(appendChild).toHaveBeenCalledTimes(1);
  });
});
