import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "./trpc";
import { FINANCIAL_REPORT_FRESH_MS } from "@shared/financialReport";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useFinanceReportAccess() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = trpc.financialReports.access.useQuery(
    { viewerId: user?.id ?? 0 },
    {
      enabled: !!user,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );
  const access =
    !query.error && query.data?.viewerId === user?.id
      ? query.data?.access
      : null;
  useEffect(() => {
    if (!query.isSuccess || query.isFetching) return;
    client.removeQueries({
      predicate(cached) {
        const [path, options] = cached.queryKey as [
          string[]?,
          { input?: { viewerId?: number; access?: string } }?,
        ];
        if (
          path?.[0] !== "financialReports" ||
          !["summary", "dashboard"].includes(path[1])
        )
          return false;
        return (
          options?.input?.viewerId !== user?.id ||
          options?.input?.access !== access
        );
      },
    });
  }, [access, user?.id, client, query.isSuccess, query.isFetching]);
  return {
    viewerId: user?.id ?? 0,
    access: access ?? null,
    checking: query.isPending || query.isFetching,
    error: query.error,
  };
}

/** One five-minute age budget measured from the server snapshot, not remount time. */
export function financeReportStaleTime(query: {
  state: { data?: { generatedAt?: string }; dataUpdatedAt: number };
}) {
  return (
    Math.max(
      0,
      Date.parse(query.state.data?.generatedAt ?? "") +
        FINANCIAL_REPORT_FRESH_MS -
        query.state.dataUpdatedAt
    ) || 0
  );
}
