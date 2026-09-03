import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkout = readFileSync(
  new URL("../frontend/src/pages/Checkout.tsx", import.meta.url),
  "utf8"
);

describe("checkout account gate", () => {
  it("shows account creation before rendering checkout for an anonymous customer", () => {
    expect(checkout).toContain(
      "const { isAuthenticated, loading: authLoading } = useAuth();"
    );
    expect(checkout).toContain("if (!isAuthenticated)");
    expect(checkout).toContain("<CheckoutAccountGate");
    expect(checkout).toMatch(
      /useState<["']register["'] \| ["']login["']>\(["']register["']\)/
    );
    expect(checkout).toContain("<RegisterForm />");
    expect(checkout).toContain(
      "mode=login&next=${encodeURIComponent(localizedCheckoutPath)}"
    );
  });

  it("does not request account-priced Live checkout data while anonymous", () => {
    expect(checkout).toMatch(
      /enabled: params\.slug === ["']live-package["'] && isAuthenticated/
    );
  });

  it("keeps order creation behind the authenticated branch", () => {
    const accountGate = checkout.indexOf("if (!isAuthenticated)");
    const orderForm = checkout.indexOf("const displayPricing");

    expect(accountGate).toBeGreaterThan(-1);
    expect(orderForm).toBeGreaterThan(accountGate);
  });
});
