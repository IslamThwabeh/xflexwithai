import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../frontend/src/pages/AdminLivePackage.tsx', import.meta.url),
  'utf8',
);

describe('Admin Live Package loading state', () => {
  it('returns the loading UI before reading the query-backed config', () => {
    const loadingGuard = source.indexOf('if (isLoading || !config || !data?.package)');
    const firstConfigRead = source.indexOf('const configPayload');

    // This ordering protects the initial render, when config is intentionally null
    // until the adminWorkspace response has been copied into editable form state.
    expect(loadingGuard).toBeGreaterThan(-1);
    expect(firstConfigRead).toBeGreaterThan(-1);
    expect(loadingGuard).toBeLessThan(firstConfigRead);
  });
});
