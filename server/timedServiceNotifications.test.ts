import { describe, expect, it } from "vitest";
import {
  buildTimedServiceActivationContent,
  buildTimedServiceReminderContent,
} from "../backend/services/timed-service-notifications.service";

describe("timed service lifecycle notification content", () => {
  it("builds bilingual three-day and one-day reminders with the Amman deadline", () => {
    const threeDays = buildTimedServiceReminderContent({
      clientName: "Yasmine",
      services: ["Recommendations"],
      deadline: "2026-08-15T18:30:00.000Z",
      stage: "three_days",
    });
    const oneDay = buildTimedServiceReminderContent({
      clientName: "Yasmine",
      services: ["LexAI", "Recommendations"],
      deadline: "2026-08-15T18:30:00.000Z",
      stage: "one_day",
    });

    expect(threeDays.titleAr).toContain("3 أيام");
    expect(threeDays.titleEn).toContain("3 days");
    expect(threeDays.contentAr).toContain("التوصيات");
    expect(threeDays.deadlineEn).toContain("21:30");
    expect(oneDay.titleAr).toContain("24 ساعة");
    expect(oneDay.titleEn).toContain("24 hours");
    expect(oneDay.contentEn).toContain("LexAI + Recommendations");
  });

  it("explains policy activation and renders exact dates for each service", () => {
    const content = buildTimedServiceActivationContent({
      activationReason: "protection_expired",
      courseWaivedByPolicy: false,
      brokerWaivedByPolicy: true,
      services: [
        {
          name: "Recommendations",
          startDate: "2026-08-15T18:30:00.000Z",
          endDate: "2026-09-14T18:30:00.000Z",
        },
      ],
    });

    expect(content.reasonAr).toContain("تلقائياً");
    expect(content.reasonEn).toContain("automatically");
    expect(content.waiverAr).toContain("الوسيط");
    expect(content.waiverEn).toContain("broker");
    expect(content.detailsAr).toContain("التوصيات");
    expect(content.rows[0].startEn).toContain("21:30");
    expect(content.rows[0].endEn).toContain("21:30");
  });
});
