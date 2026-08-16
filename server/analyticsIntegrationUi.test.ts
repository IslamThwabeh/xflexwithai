import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tracker = readFileSync("frontend/src/components/AnalyticsTracker.tsx", "utf8");
const contact = readFileSync("frontend/src/pages/Contact.tsx", "utf8");
const registration = readFileSync("frontend/src/components/RegisterForm.tsx", "utf8");
const auth = readFileSync("frontend/src/pages/Auth.tsx", "utf8");
const packageDetails = readFileSync("frontend/src/pages/PackageDetails.tsx", "utf8");
const checkout = readFileSync("frontend/src/pages/Checkout.tsx", "utf8");

describe("organic acquisition analytics integrations", () => {
  it("tracks successful outcomes instead of treating every click as a conversion", () => {
    expect(contact).toContain("trackGenerateLead(language)");
    expect(registration).toContain("trackSignUp(language, !!referralCode)");
    expect(auth).toContain("trackRegistrationStart(language)");
    expect(packageDetails).toContain("trackPackageView({");
    expect(checkout).toContain("trackBeginCheckout({");
    expect(checkout).toContain("trackOrderRequest({");
    expect(tracker).not.toContain('"seo_conversion"');
  });

  it("scopes page and delegated click tracking to eligible acquisition routes", () => {
    expect(tracker).toContain("isAnalyticsEligiblePath(pathname)");
    expect(tracker).toContain("buildSafePageLocation(window.location.href)");
    expect(tracker).toContain('trackAnalyticsEvent("page_view"');
    expect(tracker).toContain('trackContactClick("whatsapp"');
    expect(tracker).toContain("trackPackageSelection(");
  });
});

