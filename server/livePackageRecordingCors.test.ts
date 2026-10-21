import type { ExecutionContext } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/routers', () => ({ appRouter: {} }));
vi.mock('../backend/_core/context-worker', () => ({ createWorkerContext: vi.fn() }));
vi.mock('../backend/db', () => ({
  getDb: vi.fn(),
  getAdminByEmail: vi.fn(),
  getLivePackageRecordingForAdmin: vi.fn(),
  deleteUnpublishedLivePackageRecording: vi.fn(),
  logAdminAction: vi.fn(),
}));

import worker from '../backend/_core/worker';
import * as db from '../backend/db';
import { createWorkerContext } from '../backend/_core/context-worker';

const origin = 'https://xflexacademy.com';
const endpoint = 'https://api.xflexacademy.com/api/live-package-recordings/15/stream';
const deleteObject = vi.fn();
const env = { DB: {}, VIDEOS_BUCKET: { delete: deleteObject } } as unknown as Parameters<typeof worker.fetch>[1];
const context = {} as ExecutionContext;
const recording = {
  id: 15,
  isPublished: false,
  objectKey: 'live/test-recording.mp4',
  originalFileName: 'test-recording.mp4',
} as Awaited<ReturnType<typeof db.getLivePackageRecordingForAdmin>>;

function request(method: string, headers: Record<string, string> = {}) {
  return worker.fetch(new Request(endpoint, { method, headers: { Origin: origin, ...headers } }), env, context);
}

describe('Live recording CORS and deletion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createWorkerContext).mockResolvedValue({ user: { id: 7, email: 'admin@example.com' } } as any);
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 3 } as any);
    vi.mocked(db.getLivePackageRecordingForAdmin).mockResolvedValue(recording);
    vi.mocked(db.deleteUnpublishedLivePackageRecording).mockResolvedValue(true);
    deleteObject.mockResolvedValue(undefined);
  });

  it('allows the credentialed DELETE preflight without authenticating or deleting anything', async () => {
    const response = await request('OPTIONS', {
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'content-type',
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('content-type');
    expect(await response.text()).toBe('');
    expect(createWorkerContext).not.toHaveBeenCalled();
    expect(db.deleteUnpublishedLivePackageRecording).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('does not grant CORS access to an untrusted origin', async () => {
    const response = await request('OPTIONS', {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'DELETE',
    });

    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('deletes an unpublished recording for a full admin and returns CORS headers', async () => {
    const response = await request('DELETE');

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(await response.json()).toEqual({ success: true });
    expect(db.deleteUnpublishedLivePackageRecording).toHaveBeenCalledWith(15);
    expect(deleteObject).toHaveBeenCalledWith(recording!.objectKey);
    expect(db.logAdminAction).toHaveBeenCalledWith(3, 3, 'delete_live_package_recording', expect.objectContaining({ recordingId: 15 }));
  });

  it.each([
    ['non-admin', 403],
    ['missing', 404],
    ['published', 409],
    ['changed', 409],
  ] as const)('preserves the %s guard and returns a readable CORS error', async (state, status) => {
    if (state === 'non-admin') vi.mocked(db.getAdminByEmail).mockResolvedValue(undefined);
    if (state === 'missing') vi.mocked(db.getLivePackageRecordingForAdmin).mockResolvedValue(null);
    if (state === 'published') vi.mocked(db.getLivePackageRecordingForAdmin).mockResolvedValue({ ...recording!, isPublished: true });
    if (state === 'changed') vi.mocked(db.deleteUnpublishedLivePackageRecording).mockResolvedValue(false);

    const response = await request('DELETE');

    expect(response.status).toBe(status);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(deleteObject).not.toHaveBeenCalled();
    expect(db.logAdminAction).not.toHaveBeenCalled();
    if (state !== 'changed') expect(db.deleteUnpublishedLivePackageRecording).not.toHaveBeenCalled();
  });

  it('includes CORS and allowed methods on unsupported-method responses', async () => {
    const response = await request('POST');

    expect(response.status).toBe(405);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(response.headers.get('Allow')).toBe('GET, HEAD, DELETE, OPTIONS');
    expect(createWorkerContext).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
