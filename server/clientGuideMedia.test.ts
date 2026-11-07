import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';
import { generateClientGuidePlaybackToken, verifyClientGuidePlaybackToken } from '../backend/_core/clientGuidePlayback';
import { parseClientGuideRange, serveClientGuideMedia } from '../backend/services/client-guide-media';

const origin = 'https://xflexacademy.com';
const cors = new Headers({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
const head = vi.fn();
const get = vi.fn();
const bucket = { head, get } as unknown as R2Bucket;
const slug = 'demo-account';
const request = (token = '', method = 'GET', headers: Record<string, string> = {}) => new Request(
  `https://api.xflexacademy.com/api/client-guides/${slug}/stream?token=${token}`, { method, headers },
);

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'client-guide-unit-test-only-key-with-sufficient-length');
  head.mockResolvedValue({ size: 1000, httpEtag: '"video-v1"' });
  get.mockImplementation(async (_key, options) => ({ body: new Uint8Array(options?.range?.length ?? 1000) }));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('client guide playback authorization', () => {
  it('binds the token to one guide and expires after two hours', async () => {
    vi.useFakeTimers();
    const token = await generateClientGuidePlaybackToken(slug, 25);
    expect(await verifyClientGuidePlaybackToken(token, slug)).toBe(true);
    expect(await verifyClientGuidePlaybackToken(token, 'lexai-analysis')).toBe(false);
    expect(await verifyClientGuidePlaybackToken(token + 'x', slug)).toBe(false);
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000 + 1000);
    expect(await verifyClientGuidePlaybackToken(token, slug)).toBe(false);
  });

  it('rejects anonymous requests before reading private storage', async () => {
    const response = await serveClientGuideMedia(request(), bucket, cors);
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(head).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('client guide video delivery', () => {
  it('supports range playback and returns correct CORS and byte headers', async () => {
    const token = await generateClientGuidePlaybackToken(slug, 25);
    const response = await serveClientGuideMedia(request(token, 'GET', { Range: 'bytes=100-199' }), bucket, cors);
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 100-199/1000');
    expect(response.headers.get('Content-Length')).toBe('100');
    expect(response.headers.get('Content-Type')).toBe('video/mp4');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect((await response.arrayBuffer()).byteLength).toBe(100);
    expect(get).toHaveBeenCalledWith('client-guides/v1/demo-account.mp4', { range: { offset: 100, length: 100 } });
  });

  it('answers HEAD and invalid ranges without loading video bytes', async () => {
    const token = await generateClientGuidePlaybackToken(slug, 25);
    const headResponse = await serveClientGuideMedia(request(token, 'HEAD'), bucket, cors);
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('Content-Length')).toBe('1000');
    expect(await headResponse.text()).toBe('');
    const invalid = await serveClientGuideMedia(request(token, 'GET', { Range: 'bytes=1000-' }), bucket, cors);
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('Content-Range')).toBe('bytes */1000');
    expect(get).not.toHaveBeenCalled();
  });

  it('supports preflight, rejects unsupported methods, and handles missing storage/files', async () => {
    expect((await serveClientGuideMedia(request('', 'OPTIONS'), undefined, cors)).status).toBe(204);
    expect((await serveClientGuideMedia(request('', 'POST'), bucket, cors)).status).toBe(405);
    const token = await generateClientGuidePlaybackToken(slug, 25);
    expect((await serveClientGuideMedia(request(token), undefined, cors)).status).toBe(503);
    head.mockResolvedValue(null);
    expect((await serveClientGuideMedia(request(token), bucket, cors)).status).toBe(404);
  });

  it.each([
    ['bytes=-100', { start: 900, end: 999 }], ['bytes=950-2000', { start: 950, end: 999 }],
    ['bytes=100-', { start: 100, end: 999 }], ['bytes=-0', null], ['bytes=500-100', null],
    ['bytes=0-10,20-30', null], ['items=0-10', null], ['bytes=9007199254740993-', null],
  ])('handles byte range %s', (value, expected) => {
    expect(parseClientGuideRange(value, 1000)).toEqual(expected);
  });
});
