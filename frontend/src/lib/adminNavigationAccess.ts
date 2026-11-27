import { ROLE_PAGE_ACCESS } from "../../../shared/const";
import {
  employeeTrainingSection,
  menuSectionsDef,
  type MenuSection,
} from "./adminNavigationCatalog";

export type AdminNavigationAccess = {
  adminCheck?: { isAdmin?: boolean; staffRoles?: readonly string[] } | null;
  financeAuthority?: { isFinanceOwner?: boolean };
  hasEmployeeTraining?: boolean;
  performanceAvailability?: {
    enabled?: boolean;
    access?: "manager" | "employee" | null;
  };
  surveyAvailability?: { access?: "admin" | "student" | null };
  communityAvailability?: { enabled?: boolean };
  rewardsAvailability?: { enabled?: boolean };
  jobEligibilityAvailability?: { enabled?: boolean };
};

/** Visibility only: server procedures remain the authority for every action. */
export function getVisibleAdminMenuSections(
  input: AdminNavigationAccess
): MenuSection[] {
  const {
    adminCheck,
    financeAuthority,
    hasEmployeeTraining,
    performanceAvailability,
    surveyAvailability,
    communityAvailability,
    rewardsAvailability,
    jobEligibilityAvailability,
  } = input;
  const staffRolesForAvailability = adminCheck?.staffRoles ?? [];
  const canPrepareRewards = staffRolesForAvailability.includes(
    "loyalty_rewards_manager"
  );
  const filterUnavailableFeatures = (sections: MenuSection[]) =>
    sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (item.path === "/admin/features") return false;
          if (item.path === "/admin/finance/expenses")
            return (
              financeAuthority?.isFinanceOwner === true ||
              staffRolesForAvailability.includes("finance_manager") ||
              staffRolesForAvailability.includes("finance_clerk")
            );
          if (item.path === "/admin/finance")
            return (
              financeAuthority?.isFinanceOwner === true ||
              staffRolesForAvailability.includes("finance_manager") ||
              staffRolesForAvailability.includes("finance_viewer")
            );
          if (
            [
              "/admin/finance/controls",
              "/admin/finance/reconciliation",
            ].includes(item.path)
          )
            return (
              financeAuthority?.isFinanceOwner === true ||
              staffRolesForAvailability.includes("finance_manager")
            );
          if (item.path === "/admin/finance/legacy-migrations")
            return (
              financeAuthority?.isFinanceOwner === true ||
              staffRolesForAvailability.some(role =>
                [
                  "finance_manager",
                  "finance_clerk",
                  "key_manager",
                  "support",
                ].includes(role)
              )
            );
          if (item.path === "/admin/staff-performance")
            return performanceAvailability?.access === "manager";
          if (item.path === "/admin/my-performance")
            return (
              performanceAvailability?.enabled === true &&
              performanceAvailability?.access === "employee"
            );
          if (item.path === "/admin/student-surveys")
            return surveyAvailability?.access === "admin";
          if (item.path === "/admin/community")
            return (
              communityAvailability?.enabled === true ||
              staffRolesForAvailability.includes("student_community_moderator")
            );
          if (item.path === "/admin/points")
            return rewardsAvailability?.enabled === true || canPrepareRewards;
          if (item.path === "/admin/job-eligibility")
            return (
              jobEligibilityAvailability?.enabled === true ||
              staffRolesForAvailability.includes(
                "student_job_eligibility_manager"
              )
            );
          return true;
        }),
      }))
      .filter(section => section.items.length > 0);

  // Preserve discovery of management pages for full admins, including disabled features.
  if (adminCheck?.isAdmin)
    return menuSectionsDef
      .map(section => ({
        ...section,
        items: section.items.filter(
          item =>
            item.path !== "/admin/my-performance" &&
            (![
              "/admin/finance/expenses",
              "/admin/finance",
              "/admin/finance/controls",
            ].includes(item.path) ||
              financeAuthority?.isFinanceOwner === true)
        ),
      }))
      .filter(section => section.items.length > 0);
  if (!adminCheck) return filterUnavailableFeatures(menuSectionsDef);
  const accessiblePaths = new Set(
    staffRolesForAvailability.flatMap(role => ROLE_PAGE_ACCESS[role] ?? [])
  );
  const roleSections = menuSectionsDef
    .map(section => ({
      ...section,
      items: section.items.filter(item => accessiblePaths.has(item.path)),
    }))
    .filter(section => section.items.length > 0);
  return filterUnavailableFeatures([
    ...(hasEmployeeTraining ? [employeeTrainingSection] : []),
    ...roleSections,
  ]);
}

export function getStaffReviewMenuSections(input: {
  isStaff: boolean;
  roles: readonly string[];
  loginBlockedAt?: string | null;
  hasEmployeeTraining?: boolean;
  performanceEnabled?: boolean;
}): MenuSection[] {
  if (!input.isStaff || input.loginBlockedAt) return [];
  const roles = input.roles;
  return getVisibleAdminMenuSections({
    adminCheck: { isAdmin: false, staffRoles: roles },
    hasEmployeeTraining: input.hasEmployeeTraining,
    performanceAvailability: {
      enabled: input.performanceEnabled,
      access: roles.includes("staff_performance_manager")
        ? "manager"
        : roles.includes("staff_performance_employee")
          ? "employee"
          : null,
    },
    surveyAvailability: {
      access: roles.includes("student_surveys_manager") ? "admin" : null,
    },
    // Assigned managers retain preparation access while these features are disabled.
    communityAvailability: { enabled: false },
    rewardsAvailability: { enabled: false },
    jobEligibilityAvailability: { enabled: false },
  });
}
