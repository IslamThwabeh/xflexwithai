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
const customerWorkflows = new Set([
  "users.updateProfile",
  "tradeCopier.adminUpdateSubscription",
  "packageKeys.freeze",
  "packageKeys.unfreeze",
  "packageKeys.deactivateKey",
  "packageKeys.reactivateKey",
  "packageKeys.assignKey",
  "packageKeys.updateUnusedKey",
  "packageKeys.generateKey",
  "packageKeys.generateBulkKeys",
  "lexaiAdmin.pauseSubscription",
  "lexaiAdmin.resumeSubscription",
  "recommendationAdmin.subscriptions.pause",
  "recommendationAdmin.subscriptions.resume",
  "recommendationAdmin.subscriptions.grantComplimentary",
  "clientProfiles.unblockAccess",
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
    if (!Array.isArray(path)) return;
    const name = path.join("."),
      cashChanged = cashWorkflows.has(name),
      customerChanged = cashChanged || customerWorkflows.has(name);
    if (!customerChanged) return;
    // An issuance failure may follow a committed payment: errors must also
    // invalidate the saved snapshot. Existing write/idempotency rules stand.
    void client.invalidateQueries({
      predicate: query => {
        const key = query.queryKey[0];
        return (
          Array.isArray(key) &&
          ((cashChanged &&
            key[0] === "financialReports" &&
            ["summary", "dashboard"].includes(key[1])) ||
            (customerChanged &&
              key[0] === "reports" &&
              ["customers", "studentsPage"].includes(key[1])))
        );
      },
      refetchType: "none",
    });
  });
}
