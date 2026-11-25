import type { QueryClient } from "@tanstack/react-query";

const cashWorkflows = new Set([
  "orders.adminUpdateStatus",
  "tradeCopier.adminConfirmPayment",
  "financialControls.reviewAdjustment",
  "financialControls.reverseEntry",
  "financialControls.reclassifyPayment",
  "financialReconciliation.resolveItem",
  "financeExpenses.review",
  "clientProfiles.blockAccess",
]);

/** Mark saved reports stale without fetching reports on unrelated pages. */
export function subscribeToFinancialReportChanges(client: QueryClient) {
  return client.getMutationCache().subscribe(event => {
    if (
      event.type !== "updated" ||
      !["success", "error"].includes(event.action.type)
    )
      return;
    const path = event.mutation.options.mutationKey?.[0];
    if (!Array.isArray(path) || !cashWorkflows.has(path.join("."))) return;
    // An issuance failure may follow a committed payment: errors must also
    // invalidate the saved snapshot. Existing write/idempotency rules stand.
    void client.invalidateQueries({
      predicate: query => {
        const key = query.queryKey[0];
        return (
          Array.isArray(key) &&
          key[0] === "financialReports" &&
          ["summary", "dashboard"].includes(key[1])
        );
      },
      refetchType: "none",
    });
  });
}
