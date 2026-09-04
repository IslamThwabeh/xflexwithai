import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LIVE_PACKAGE_PRICE_MINOR,
  selectLatestQualifyingLivePackagePurchase,
  getLivePackagePurchaseTierForLatestPackage,
  getLivePackagePurchaseTier,
} from "../backend/services/live-package.service";

const router = readFileSync(new URL("../backend/routers.ts", import.meta.url), "utf8");
const database = readFileSync(new URL("../backend/db.ts", import.meta.url), "utf8");
const adminUi = readFileSync(new URL("../frontend/src/pages/AdminLivePackage.tsx", import.meta.url), "utf8");
const checkoutUi = readFileSync(new URL("../frontend/src/pages/Checkout.tsx", import.meta.url), "utf8");
const packageUi = readFileSync(new URL("../frontend/src/pages/PackageDetails.tsx", import.meta.url), "utf8");
const appUi = readFileSync(new URL("../frontend/src/App.tsx", import.meta.url), "utf8");

describe("Live Package Phase A decisions", () => {
  it("calculates all three server-owned eligibility prices and prefers Comprehensive", () => {
    expect(getLivePackagePurchaseTier([])).toEqual({
      tier: "newSubscriber",
      price: LIVE_PACKAGE_PRICE_MINOR.newSubscriber,
      eligiblePackageSlug: null,
    });
    expect(getLivePackagePurchaseTier(["basic"])).toMatchObject({
      tier: "basicSubscriber",
      price: 100_000,
      eligiblePackageSlug: "basic",
    });
    expect(getLivePackagePurchaseTier(["basic", "comprehensive"])).toMatchObject({
      tier: "comprehensiveSubscriber",
      price: 35_000,
      eligiblePackageSlug: "comprehensive",
    });
  });

  it("prices from the latest qualifying historical package purchase", () => {
    expect(getLivePackagePurchaseTierForLatestPackage(null)).toMatchObject({
      tier: "newSubscriber",
      price: 200_000,
      eligiblePackageSlug: null,
    });
    expect(getLivePackagePurchaseTierForLatestPackage("basic")).toMatchObject({
      tier: "basicSubscriber",
      price: 100_000,
      eligiblePackageSlug: "basic",
    });
    expect(getLivePackagePurchaseTierForLatestPackage("comprehensive")).toMatchObject({
      tier: "comprehensiveSubscriber",
      price: 35_000,
      eligiblePackageSlug: "comprehensive",
    });
  });

  it("selects the latest valid Basic or Comprehensive history deterministically", () => {
    const base = "2026-08-01T10:00:00.000Z";
    const later = "2026-08-20T10:00:00.000Z";
    expect(selectLatestQualifyingLivePackagePurchase([])).toBeNull();
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "basic", packageId: 1, purchasedAt: base, recordId: 1, isValid: true },
    ])?.packageSlug).toBe("basic");
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "comprehensive", packageId: 2, purchasedAt: base, recordId: 2, isValid: true },
    ])?.packageSlug).toBe("comprehensive");
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "basic", packageId: 1, purchasedAt: base, recordId: 1, isValid: true },
      { packageSlug: "comprehensive", packageId: 2, purchasedAt: later, recordId: 2, isValid: true },
    ])?.packageSlug).toBe("comprehensive");
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "comprehensive", packageId: 2, purchasedAt: base, recordId: 1, isValid: true },
      { packageSlug: "basic", packageId: 1, purchasedAt: later, recordId: 2, isValid: true },
    ])?.packageSlug).toBe("basic");
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "basic", packageId: 1, purchasedAt: base, recordId: 1, isValid: true },
      { packageSlug: "comprehensive", packageId: 2, purchasedAt: later, recordId: 2, isValid: false },
    ])?.packageSlug).toBe("basic");
    expect(selectLatestQualifyingLivePackagePurchase([
      { packageSlug: "basic", packageId: 1, purchasedAt: base, recordId: 1, isValid: true },
      { packageSlug: "comprehensive", packageId: 2, purchasedAt: base, recordId: 2, isValid: true },
    ])?.packageSlug).toBe("comprehensive");
  });

  it("uses paid order history rather than current timed services for discounts", () => {
    const quote = database.slice(
      database.indexOf("export async function getLivePackagePurchaseQuote"),
      database.indexOf("export async function hasLivePackageOrderForRecipient"),
    );
    expect(quote).toContain("getLatestQualifyingPackagePurchaseForLiveQuote");
    expect(quote).not.toContain("getAnyLexaiSubscription");
    expect(quote).not.toContain("getAnyRecommendationSubscription");
    const history = database.slice(
      database.indexOf("export async function getLatestQualifyingPackagePurchaseForLiveQuote"),
      database.indexOf("export async function hasLivePackageOrderForRecipient"),
    );
    expect(history).toContain("const validOrderStatuses = ['paid', 'completed']");
    expect(history).toContain("inArray(orders.status, validOrderStatuses)");
    expect(history).toContain("inArray(packages.slug, ['basic', 'comprehensive'])");
    expect(history).toContain("lte(purchasedAt, asOfIso)");
    expect(history).toContain("desc(orders.id)");
    expect(history).not.toContain("packageSubscriptions");
  });

  it("uses a dedicated audited manual switch with old/new/admin/time evidence", () => {
    const toggle = router.slice(
      router.indexOf("setLiveRegistration:"),
      router.indexOf("// Admin: list all packages"),
    );
    expect(toggle).toContain("adminProcedure");
    expect(toggle).toContain("LIVE_PACKAGE_SETTING_KEYS.registrationOpen");
    expect(toggle).toContain("previousValue");
    expect(toggle).toContain("nextValue");
    expect(toggle).toContain("changedAt");
    expect(toggle).toContain("ctx.admin.id");
    expect(adminUi).toContain("AlertDialog");
    expect(adminUi).toContain("This switch alone controls new order creation.");
  });

  it("checks registration again at the order write boundary but never at payment approval or activation", () => {
    const createOrder = router.slice(router.indexOf("create: protectedProcedure", router.indexOf("orders: router")), router.indexOf("// User: get my orders"));
    const approveOrder = router.slice(router.indexOf("adminUpdateStatus:"), router.indexOf("return { order: updated, activationKeys }"));
    const activateLive = database.slice(database.indexOf("if (pkg.packageType === 'live')"), database.indexOf("if (pkg.packageType !== 'live' && resolvedUserId"));
    expect(createOrder.match(/availability\.purchasable/g)?.length).toBeGreaterThanOrEqual(2);
    expect(createOrder).toContain("registration was closed before the order was created");
    expect(approveOrder).not.toContain("registrationOpen");
    expect(approveOrder).not.toContain("salesEndsAt");
    expect(activateLive).not.toContain("registrationOpen");
    expect(activateLive).not.toContain("salesEndsAt");
  });

  it("allows purchase and fulfillment while the cohort schedule is not yet approved", () => {
    const service = readFileSync(new URL("../backend/services/live-package.service.ts", import.meta.url), "utf8");
    expect(service).toContain("settings[LIVE_PACKAGE_SETTING_KEYS.sessionStartsAt]?.trim() || \"\"");
    expect(service).toContain("settings[LIVE_PACKAGE_SETTING_KEYS.sessionEndsAt]?.trim() || \"\"");
    expect(service).toContain("const hasAnyScheduleDate = Boolean(config.sessionStartsAt || config.sessionEndsAt)");
    const fulfillment = database.slice(
      database.indexOf("export async function fulfillLivePackageEntitlement"),
      database.indexOf("export async function listLivePackageSessions("),
    );
    expect(fulfillment).toContain("sessionStartsAt: config.sessionStartsAt");
    expect(fulfillment).toContain("sessionEndsAt: config.sessionEndsAt");
  });

  it("does not let pending orders lock undecided schedule while the cohort is not started", () => {
    const updateConfig = router.slice(
      router.indexOf("updateLiveConfig:"),
      router.indexOf("setLiveRegistration:"),
    );
    expect(updateConfig).toContain("commercialTermsChanged");
    expect(updateConfig).toContain("scheduleChanged");
    expect(updateConfig).toContain("previous.config.cohortStatus !== 'not_started'");
    expect(updateConfig).toContain("proposedConfig.cohortStatus !== 'not_started'");
    expect(updateConfig).toContain("hasLivePackageStarted");
    expect(updateConfig).not.toContain("'sessionStartsAt',\n          'sessionEndsAt'");
  });

  it("shares final approved schedule across early and late buyers and protects it after start", () => {
    const workspace = router.slice(
      router.indexOf("myWorkspace:"),
      router.indexOf("joinSession:"),
    );
    expect(workspace).toContain("context.config.sessionStartsAt || entitlement.sessionStartsAt");
    expect(workspace).toContain("context.config.sessionEndsAt || entitlement.sessionEndsAt");
    const joinInfo = database.slice(
      database.indexOf("export async function getLivePackageSessionJoinInfo"),
      database.indexOf("export async function getLivePackageRecordingForUser"),
    );
    expect(joinInfo).toContain("parseLivePackageConfig(await getAllAdminSettings())");
    expect(joinInfo).toContain("if (!config.sessionStartsAt || !config.sessionEndsAt) return null");
  });

  it("keeps Live independent from courses and preserves existing package subscriptions", () => {
    const fulfillment = database.slice(
      database.indexOf("export async function fulfillLivePackageEntitlement"),
      database.indexOf("export async function listLivePackageSessions("),
    );
    expect(fulfillment).not.toContain("packageSubscriptions");
    expect(fulfillment).not.toContain("enrollments");
    expect(fulfillment).not.toContain("getPackageCourses");
    expect(router).toContain("Live Package is standalone and cannot be linked to course entitlements.");
  });

  it("revokes Live access on a full refund and reports subscriber-safe admin metrics", () => {
    expect(database).toContain("revokeLivePackageEntitlementForOrder");
    expect(database).toContain("eq(livePackageEntitlements.orderId, fullyRefundedOrder.id)");
    expect(database).toContain("eq(livePackageEntitlements.isActive, true)");
    expect(database).toContain("eq(registrationKeys.packageId, fullyRefundedOrder.livePackageId)");
    expect(database).toContain("'Live order refunded'");
    expect(database).toContain("newOrders: byStatus.get('pending')");
    expect(database).toContain("awaitingConfirmation: byStatus.get('awaiting_confirmation')");
    expect(database).toContain("activeEntitlements: Number(entitlementCount");
    expect(adminUi).toContain("data.stats.activeEntitlements");
  });

  it("revokes Live on cancellation too and permanently blocks cohort re-grants", () => {
    const statusUpdate = router.slice(
      router.indexOf("adminUpdateStatus:"),
      router.indexOf("// If payment is approved", router.indexOf("adminUpdateStatus:")),
    );
    expect(statusUpdate).toContain("input.status === 'cancelled' || input.status === 'refunded'");
    expect(statusUpdate).toContain("revokeLivePackageEntitlementForOrder(order.id)");
    expect(database).toContain("getAnyLivePackageEntitlement");
    expect(database).toContain("previously revoked and cannot be re-granted");
    expect(database).toContain("eq(registrationKeys.packageId, livePackage.id)");
  });

  it("allows only order-linked discounted Live add-on keys and treats concurrent activation as success", () => {
    const createKey = database.slice(
      database.indexOf("export async function createPackageKey"),
      database.indexOf("export async function getPackageKeyByCode"),
    );
    expect(createKey).toContain("input.isUpgrade && !input.orderId");
    expect(database).toContain("reason: 'concurrent_already_activated'");
    expect(database).toContain("(!key.isUpgrade || key.orderId)");
  });

  it("locks recording access to permanent until an explicit revocation or refund", () => {
    expect(router).toContain('recordingPolicy: z.literal("permanent")');
    expect(adminUi).toContain("Permanent unless explicitly revoked or refunded");
    expect(database).toContain("revokeLivePackageEntitlementForOrder");
  });

  it("explains late and completed cohort purchases without promising future sessions", () => {
    expect(packageUi).toContain("Cohort in progress");
    expect(packageUi).toContain("does not promise future sessions");
    expect(checkoutUi).toContain("prior published recordings");
    expect(checkoutUi).toContain("does not promise future live sessions");
    expect(checkoutUi).toContain("liveQuote.price / 100");
    expect(checkoutUi).toContain("Previous Basic customer price");
    expect(checkoutUi).toContain("Previous Comprehensive customer price");
    expect(packageUi).toContain("previous Basic customer");
    expect(packageUi).toContain("previous Comprehensive customer");
    expect(checkoutUi).toContain("{!isLive && <div");
    expect(router).toContain("Live Package gift checkout is not supported");
  });

  it("keeps localized checkout routes and Live-specific pricing copy", () => {
    expect(appUi).toContain('path="/ar/checkout/:slug"');
    expect(appUi).toContain('path="/en/checkout/:slug"');
    expect(checkoutUi).toContain("Previous Basic customer price");
    expect(checkoutUi).toContain("Previous Comprehensive customer price");
    expect(checkoutUi).toContain("Cohort access");
    expect(checkoutUi).toContain("isLive ? (isRtl ? 'وصول خاص بالفوج' : 'Cohort access')");
  });
});
