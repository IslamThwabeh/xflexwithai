import { describe, expect, it } from "vitest";
import { ROLE_PAGE_ACCESS, STAFF_NOTIFICATION_EVENTS } from "../shared/const";

describe("feature task-bar mappings", () => {
  const featureTasks = [
    {
      role: "student_surveys_manager",
      route: "/admin/student-surveys",
      event: "student_survey_submitted",
    },
    {
      role: "loyalty_rewards_manager",
      route: "/admin/points",
      event: "loyalty_reward_requested",
    },
    {
      role: "student_community_moderator",
      route: "/admin/community",
      event: "community_content_reported",
    },
    {
      role: "student_job_eligibility_manager",
      route: "/admin/job-eligibility",
      event: "job_eligibility_review_requested",
    },
    {
      role: "staff_performance_manager",
      route: "/admin/staff-performance",
      event: "staff_performance_submitted",
    },
  ] as const;

  it.each(featureTasks)("keeps $event aligned with $role and $route", ({ role, route, event }) => {
    expect(ROLE_PAGE_ACCESS[role]).toContain(route);
    expect(STAFF_NOTIFICATION_EVENTS[event].roles).toContain(role);
    expect(STAFF_NOTIFICATION_EVENTS[event].actionUrl).toBe(route);
  });

  it("keeps employee daily work separate from manager review", () => {
    expect(ROLE_PAGE_ACCESS.staff_performance_employee).toEqual(["/admin/my-performance"]);
    expect(ROLE_PAGE_ACCESS.staff_performance_manager).toEqual(["/admin/staff-performance"]);
  });
});
