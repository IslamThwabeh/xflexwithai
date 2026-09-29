import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("backend/db.ts", "utf8");
const routerSource = readFileSync("backend/routers.ts", "utf8");
const adminPageSource = readFileSync("frontend/src/pages/AdminRecommendations.tsx", "utf8");

describe("complimentary recommendation grant", () => {
  it("keeps the admin grant isolated from payment and ledger paths", () => {
    const helper = dbSource.slice(
      dbSource.indexOf("export async function grantComplimentaryRecommendationAccess"),
      dbSource.indexOf("export async function updateRecommendationSubscription"),
    );

    expect(helper).toContain("paymentStatus");
    expect(helper).toContain('"complimentary"');
    expect(helper).toContain("paymentAmount: 0");
    expect(helper).toContain('paymentCurrency: "ILS"');
    expect(helper).not.toMatch(/createOrder|orderItems|registrationKeys|financialLedgerEntries|orderPaymentConfirmations/);
  });

  it("exposes the grant only through the recommendation admin subscription router", () => {
    const route = routerSource.slice(
      routerSource.indexOf("grantComplimentary: adminProcedure"),
      routerSource.indexOf("setAnalyst: adminProcedure"),
    );

    expect(route).toContain("grantComplimentary: adminProcedure");
    expect(route).toContain("db.getUserById(input.userId)");
    expect(route).toContain("db.grantComplimentaryRecommendationAccess(input)");
    expect(route).toContain("days: z.number().int().min(1).max(366).default(30)");
  });

  it("surfaces the admin UI with the approved compensation reason", () => {
    expect(adminPageSource).toContain("Grant Complimentary Recommendations");
    expect(adminPageSource).toContain("Compensation for unavailable live copier service");
    expect(adminPageSource).toContain("grantComplimentaryMutation.mutate");
    expect(adminPageSource).toContain("creates no order, key, or financial income");
  });
});
