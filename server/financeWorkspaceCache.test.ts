import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { clearMismatchedFinanceWorkspaceCache, isFinanceAccessDenied } from '../frontend/src/lib/financeWorkspaceCache';

const key = (path: string, viewerId?: number, access?: string) => [path.split('.'), { input: { viewerId, access }, type: 'query' }];

describe('financial workspace cache boundaries', () => {
  it('clears other accounts immediately while preserving the current account until role verification', () => {
    const client = new QueryClient();
    const current = key('financialControls.workspace', 20, 'owner');
    const other = key('financialControls.workspace', 21, 'owner');
    const legacy = key('financeExpenses.list');
    const auth = key('financialReports.access', 21);
    const unrelated = key('orders.list', 21);
    for (const queryKey of [current, other, legacy, auth, unrelated]) client.setQueryData(queryKey, { private: true });
    clearMismatchedFinanceWorkspaceCache(client, 20, null, true);
    expect(client.getQueryData(current)).toBeTruthy();
    expect(client.getQueryData(other)).toBeUndefined();
    expect(client.getQueryData(legacy)).toBeUndefined();
    expect(client.getQueryData(auth)).toBeTruthy();
    expect(client.getQueryData(unrelated)).toBeTruthy();
    client.clear();
  });

  it.each(['manager', 'clerk', 'viewer', null])('removes prior privileged financial reads after access becomes %s without fetching', access => {
    const client = new QueryClient();
    const fetcher = vi.fn();
    const paths = ['financialReports.summary', 'financialReports.dashboard', 'financialControls.workspace', 'financialReconciliation.preview', 'financialReconciliation.workspace', 'financeExpenses.workspaceList'];
    for (const path of paths) client.setQueryDefaults(key(path, 20, 'owner'), { queryFn: fetcher });
    for (const path of paths) client.setQueryData(key(path, 20, 'owner'), { private: true });
    const retained = key('financeExpenses.workspaceList', 20, access ?? undefined);
    if (access) client.setQueryData(retained, { scope: access });
    clearMismatchedFinanceWorkspaceCache(client, 20, access);
    for (const path of paths) expect(client.getQueryData(key(path, 20, 'owner'))).toBeUndefined();
    if (access) expect(client.getQueryData(retained)).toEqual({ scope: access });
    expect(fetcher).not.toHaveBeenCalled();
    client.clear();
  });

  it('treats only explicit authorization failures as denial', () => {
    expect(isFinanceAccessDenied({ data: { code: 'FORBIDDEN' } })).toBe(true);
    expect(isFinanceAccessDenied({ data: { code: 'UNAUTHORIZED' } })).toBe(true);
    expect(isFinanceAccessDenied({ data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false);
    expect(isFinanceAccessDenied(new Error('Network unavailable'))).toBe(false);
    expect(isFinanceAccessDenied(null)).toBe(false);
  });
});
