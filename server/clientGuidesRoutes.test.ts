import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getUserTermsAcceptanceStatus: vi.fn(),
}));
import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import { verifyClientGuidePlaybackToken } from '../backend/_core/clientGuidePlayback';
import { CLIENT_GUIDES } from '../shared/clientGuides';

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'client-guide-router-test-only-key-with-sufficient-length');
  vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({ requiresAcceptance: false } as any);
});
const caller = (user: any = null) => appRouter.createCaller({ user, req: { headers: {}, method: 'GET' } } as any);
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('client guide access', () => {
  it('requires sign-in before issuing playback access', async () => {
    await expect(caller().clientGuides.playback({ slug: 'demo-account' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('lets a signed-in client watch every guide without an active service or activation call', async () => {
    for (const guide of CLIENT_GUIDES) {
      const result = await caller({ id: 25, email: 'client@example.test' }).clientGuides.playback({ slug: guide.slug });
      const url = new URL(result.streamPath, 'https://api.xflexacademy.com');
      expect(await verifyClientGuidePlaybackToken(url.searchParams.get('token')!, guide.slug)).toBe(true);
    }
  });
  it('does not issue access to arbitrary objects', async () => {
    await expect(caller({ id: 25, email: 'client@example.test' }).clientGuides.playback({ slug: '../private-file' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
