import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { subscribeToFinancialReportChanges } from "../frontend/src/lib/financialReportInvalidation";

describe("financial snapshot invalidation after cash workflows", () => {
  it.each([false, true])(
    "invalidates summary and detail without background report reads, including partial-write failure=%s",
    async failure => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: Infinity },
          mutations: { retry: false },
        },
      });
      const summary = [
        ["financialReports", "summary"],
        { input: { viewerId: 1, access: "owner" } },
      ];
      const dashboard = [
        ["financialReports", "dashboard"],
        { input: { viewerId: 1, access: "viewer" } },
      ];
      const access = [["financialReports", "access"]];
      client.setQueryData(summary, { amount: 100 });
      client.setQueryData(dashboard, { amount: 100 });
      client.setQueryData(access, { access: "owner" });
      let reads = 0;
      const observer = new QueryObserver(client, {
        queryKey: summary,
        staleTime: 300000,
        queryFn: async () => {
          reads++;
          return { amount: 200 };
        },
      });
      const unsubscribe = observer.subscribe(() => {}),
        stop = subscribeToFinancialReportChanges(client);
      const mutation = client.getMutationCache().build(client, {
        mutationKey: [["orders", "adminUpdateStatus"]],
        mutationFn: async () => {
          if (failure) throw Error("issuance failed after payment");
          return { success: true };
        },
      });
      if (failure)
        await expect(mutation.execute(undefined)).rejects.toThrow(
          "issuance failed"
        );
      else await mutation.execute(undefined);
      expect(client.getQueryState(summary)?.isInvalidated).toBe(true);
      expect(client.getQueryState(dashboard)?.isInvalidated).toBe(true);
      expect(client.getQueryState(access)?.isInvalidated).toBe(false);
      expect(reads).toBe(0);
      stop();
      unsubscribe();
      client.clear();
    }
  );
  it("does not invalidate money snapshots for draft or unrelated successful mutations", async () => {
    const client = new QueryClient(),
      key = [["financialReports", "summary"]];
    const stop = subscribeToFinancialReportChanges(client);
    client.setQueryData(key, { amount: 100 });
    for (const path of [
      ["financeExpenses", "createDraft"],
      ["users", "updateNotificationPrefs"],
    ])
      await client
        .getMutationCache()
        .build(client, {
          mutationKey: [path],
          mutationFn: async () => ({ success: true }),
        })
        .execute(undefined);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    stop();
    client.clear();
  });
});
