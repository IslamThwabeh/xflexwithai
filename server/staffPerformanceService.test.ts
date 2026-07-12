import { describe, expect, it } from "vitest";
import {
  canTransitionStaffPerformanceStatus,
  isEditableStaffPerformanceStatus,
  isStaffPerformanceEnabled,
  isValidIanaTimezone,
  isValidIsoCalendarDate,
  isValidPerformanceMonth,
  isValidPerformanceWeek,
} from "../backend/services/staff-performance.service";

describe("staff performance feature flag", () => {
  it("is disabled unless the stored value is explicitly true", () => {
    expect(isStaffPerformanceEnabled(null)).toBe(false);
    expect(isStaffPerformanceEnabled("false")).toBe(false);
    expect(isStaffPerformanceEnabled("1")).toBe(false);
    expect(isStaffPerformanceEnabled(" TRUE ")).toBe(true);
  });
});

describe("staff performance workflow", () => {
  it("allows employees to submit editable records only", () => {
    expect(canTransitionStaffPerformanceStatus("employee", "draft", "submitted")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("employee", "returned", "submitted")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("employee", "submitted", "approved")).toBe(false);
  });

  it("allows managers to review and lock without reopening locked records", () => {
    expect(canTransitionStaffPerformanceStatus("manager", "draft", "submitted")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("manager", "submitted", "returned")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("manager", "submitted", "approved")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("manager", "approved", "locked")).toBe(true);
    expect(canTransitionStaffPerformanceStatus("manager", "locked", "draft")).toBe(false);
  });

  it("treats only draft and returned records as editable", () => {
    expect(isEditableStaffPerformanceStatus("draft")).toBe(true);
    expect(isEditableStaffPerformanceStatus("returned")).toBe(true);
    expect(isEditableStaffPerformanceStatus("submitted")).toBe(false);
    expect(isEditableStaffPerformanceStatus("approved")).toBe(false);
    expect(isEditableStaffPerformanceStatus("locked")).toBe(false);
  });
});

describe("staff performance period validation", () => {
  it("accepts real calendar dates and rejects normalized invalid dates", () => {
    expect(isValidIsoCalendarDate("2026-02-28")).toBe(true);
    expect(isValidIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isValidIsoCalendarDate("2026-13-01")).toBe(false);
  });

  it("accepts only canonical months", () => {
    expect(isValidPerformanceMonth("2026-07")).toBe(true);
    expect(isValidPerformanceMonth("2026-7")).toBe(false);
    expect(isValidPerformanceMonth("2026-13")).toBe(false);
  });

  it("requires weekly reports to cover Monday through Sunday", () => {
    expect(isValidPerformanceWeek("2026-07-06", "2026-07-12")).toBe(true);
    expect(isValidPerformanceWeek("2026-07-05", "2026-07-11")).toBe(false);
    expect(isValidPerformanceWeek("2026-07-06", "2026-07-13")).toBe(false);
  });

  it("validates IANA timezones", () => {
    expect(isValidIanaTimezone("Asia/Amman")).toBe(true);
    expect(isValidIanaTimezone("Not/A_Timezone")).toBe(false);
  });
});
