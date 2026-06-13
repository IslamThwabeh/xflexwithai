import { describe, expect, it } from "vitest";

import {
  derivePendingServiceDays,
  getRemainingTimedServiceDays,
  getServiceDaysForPackageTransition,
  hasExistingStudentHistory,
  isStudentReadyForTimedServices,
  shouldBlockFreshKeyForExistingStudent,
  validateRenewalPackageTransition,
} from "../backend/services/package-key-lifecycle.service";

describe("package key lifecycle helpers", () => {
  it("treats package, timed service, or activated key history as an old student", () => {
    expect(hasExistingStudentHistory({ packageSubscriptionCount: 1 })).toBe(true);
    expect(hasExistingStudentHistory({ timedSubscriptionCount: 1 })).toBe(true);
    expect(hasExistingStudentHistory({ activatedPackageKeyCount: 1 })).toBe(true);
    expect(hasExistingStudentHistory({})).toBe(false);
  });

  it("blocks fresh keys for old students but not renewal or upgrade keys", () => {
    const history = { activatedPackageKeyCount: 1 };

    expect(shouldBlockFreshKeyForExistingStudent({ history })).toBe(true);
    expect(shouldBlockFreshKeyForExistingStudent({ history, isRenewal: true })).toBe(false);
    expect(shouldBlockFreshKeyForExistingStudent({ history, isUpgrade: true })).toBe(false);
  });

  it("requires course completion or skip plus broker completion", () => {
    expect(isStudentReadyForTimedServices({ courseCompleted: true, brokerCompleted: true })).toBe(true);
    expect(isStudentReadyForTimedServices({ courseAdminSkipped: true, brokerCompleted: true })).toBe(true);
    expect(isStudentReadyForTimedServices({ courseCompleted: true, brokerCompleted: false })).toBe(false);
    expect(isStudentReadyForTimedServices({ brokerCompleted: true })).toBe(false);
  });

  it("allows basic to comprehensive but blocks active comprehensive to basic", () => {
    expect(validateRenewalPackageTransition({
      targetPackageSlug: "comprehensive",
      activePackageSlugs: ["basic"],
      hasActiveLexai: false,
    })).toEqual({ allowed: true });

    expect(validateRenewalPackageTransition({
      targetPackageSlug: "basic",
      activePackageSlugs: ["comprehensive"],
      hasActiveLexai: true,
    })).toEqual({ allowed: false, reason: "comprehensive_to_basic_active" });
  });

  it("gives basic remaining days to recommendations only on comprehensive upgrade", () => {
    expect(getServiceDaysForPackageTransition({
      sourcePackageSlug: "basic",
      targetPackageSlug: "comprehensive",
      keyDays: 30,
      remainingRecommendationDays: 5,
    })).toEqual({ recommendationDays: 35, lexaiDays: 30 });
  });

  it("calculates remaining and pending service days", () => {
    expect(getRemainingTimedServiceDays("2026-06-10T00:00:00.000Z", new Date("2026-06-05T00:00:00.000Z"))).toBe(5);
    expect(derivePendingServiceDays({
      maxActivationDate: "2026-06-19T00:00:00.000Z",
      placeholderEndDate: "2026-07-24T00:00:00.000Z",
      fallbackDays: 30,
    })).toBe(35);
  });

  it("does not add the protection window to new pending service age", () => {
    expect(derivePendingServiceDays({
      activationAnchorDate: "2026-06-05T00:00:00.000Z",
      maxActivationDate: "2026-06-19T00:00:00.000Z",
      placeholderEndDate: "2026-07-05T00:00:00.000Z",
      fallbackDays: 30,
    })).toBe(30);
  });

  it("keeps old pending rows from turning the protection window into extra service days", () => {
    expect(derivePendingServiceDays({
      activationAnchorDate: "2026-06-13T15:05:13.604Z",
      maxActivationDate: "2026-06-27T15:05:13.604Z",
      placeholderEndDate: "2026-06-29T15:05:13.604Z",
      fallbackDays: 2,
    })).toBe(2);
  });
});
