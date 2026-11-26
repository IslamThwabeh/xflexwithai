import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "./trpc";
import { useFinanceReportAccess } from "./useFinanceReport";
import { clearMismatchedFinanceWorkspaceCache, isFinanceAccessDenied } from "./financeWorkspaceCache";

export function useFinanceWorkspaceAccess(kind: "controls" | "expenses") {
  const { user } = useAuth();
  const client = useQueryClient();
  const report = useFinanceReportAccess(kind === "controls");
  const expense = trpc.financeExpenses.access.useQuery(
    { viewerId: user?.id ?? 0 },
    {
      enabled: kind === "expenses" && !!user,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );
  const expenseAccess =
    !expense.error && expense.data?.viewerId === user?.id
      ? expense.data?.access ?? null
      : null;
  const access = kind === "expenses" ? expenseAccess : report.access;
  const checking =
    kind === "expenses"
      ? expense.isPending || expense.isFetching
      : report.checking;
  const error = kind === "expenses" ? expense.error : report.error;
  const viewerId = user?.id ?? 0;
  const lastVerifiedAccess = useRef(access);
  useEffect(() => {
    clearMismatchedFinanceWorkspaceCache(client, viewerId, null, true);
  }, [client, viewerId]);
  useEffect(() => {
    if (!checking && (!error || isFinanceAccessDenied(error))) {
      lastVerifiedAccess.current = error ? null : access;
      clearMismatchedFinanceWorkspaceCache(client, viewerId, error ? null : access);
    }
  }, [client, viewerId, access, checking, error]);
  return {
    viewerId,
    access,
    checking,
    error,
    verified: kind === "expenses" ? expense.isSuccess && !expense.error && expense.data?.viewerId === user?.id : report.verified,
    identityKey: `${viewerId}:${error ? lastVerifiedAccess.current : access}`,
    allowed:
      kind === "expenses"
        ? access === "owner" || access === "manager" || access === "clerk"
        : access === "owner" || access === "manager",
    refetch: kind === "expenses" ? expense.refetch : report.refetch,
  };
}

export type FinanceWorkspaceAccess = ReturnType<
  typeof useFinanceWorkspaceAccess
>;
