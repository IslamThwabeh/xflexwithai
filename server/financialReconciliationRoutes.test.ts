import { describe, expect, it } from 'vitest';
import { appRouter } from '../backend/routers';

describe('financial reconciliation routes', () => {
  it('keeps reconciliation APIs disabled until their Phase 0 query-plan gates pass', () => {
    const routes = (appRouter as any)._def?.record ?? (appRouter as any)._def?.procedures ?? {};
    expect(routes.finance).toBeUndefined();
  });
});
