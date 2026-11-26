import type { QueryClient } from "@tanstack/react-query";

const privateReads = new Set([
  "financialReports.summary",
  "financialReports.dashboard",
  "financialControls.workspace",
  "financialReconciliation.preview",
  "financialReconciliation.workspace",
  "financeExpenses.workspaceList",
  "financeExpenses.list",
]);

export function clearMismatchedFinanceWorkspaceCache(
  client: QueryClient,
  viewerId: number,
  access: string | null,
  identityOnly = false
) {
  client.removeQueries({
    predicate(query) {
      const [path, options] = query.queryKey as [
        string[]?,
        { input?: { viewerId?: number; access?: string } }?,
      ];
      if (!Array.isArray(path) || !privateReads.has(path.join(".")))
        return false;
      return (
        options?.input?.viewerId !== viewerId ||
        (!identityOnly && options?.input?.access !== access)
      );
    },
  });
}

export function isFinanceAccessDenied(error: unknown) {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  return code === "FORBIDDEN" || code === "UNAUTHORIZED";
}
