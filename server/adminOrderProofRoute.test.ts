import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/_core/context-worker', () => ({ createWorkerContext: vi.fn() }));
vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getDb: vi.fn(), getAdminByEmail: vi.fn(), hasAnyRole: vi.fn(), getOrderById: vi.fn(),
  submitOrderPaymentProof: vi.fn(), logAdminAction: vi.fn(), logOrderStatusHistory: vi.fn(), trackEngagement: vi.fn(),
}));
vi.mock('../backend/storage-r2', async () => ({ ...await vi.importActual('../backend/storage-r2'), storagePutR2: vi.fn() }));
import worker from '../backend/_core/worker';
import * as db from '../backend/db';
import { createWorkerContext } from '../backend/_core/context-worker';
import { storagePutR2 } from '../backend/storage-r2';
const order = { id: 42, userId: 7, status: 'pending', paymentMethod: 'bank_transfer', paymentProofUrl: null, paymentReference: 'SAVED' };
const env = { DB: {}, VIDEOS_BUCKET: {} } as any;
const request = (path = 'admin-order-proof', bytes: Uint8Array = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) => worker.fetch(new Request(`https://api.xflexacademy.com/api/uploads/${path}?orderId=42`, { method: 'POST', headers: { Origin: 'https://xflexacademy.com', 'Content-Type': 'image/jpeg' }, body: bytes as BodyInit }), env, {} as any);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createWorkerContext).mockResolvedValue({ user: { id: -1, email: 'admin@example.test' } } as any);
  vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1 } as any);
  vi.mocked(db.hasAnyRole).mockResolvedValue(false);
  vi.mocked(db.getOrderById).mockResolvedValue(order as any);
  vi.mocked(storagePutR2).mockImplementation(async (_bucket, key) => ({ key, url: `https://videos.xflexacademy.com/${key}` }));
  vi.mocked(db.submitOrderPaymentProof).mockImplementation(async input => ({ ...order, ...input, status: 'awaiting_confirmation' }) as any);
});
describe('admin binary receipt endpoint', () => {
  it('saves a real admin upload for the customer, with actor attribution and credentials CORS', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(db.submitOrderPaymentProof).toHaveBeenCalledWith(expect.objectContaining({ orderId: 42, userId: 7, paymentReference: 'SAVED' }));
    expect(db.logAdminAction).toHaveBeenCalledWith(1, 7, 'payment_proof_upload_succeeded', expect.objectContaining({ actorType: 'admin', actorId: 1, orderId: 42 }));
    expect(db.logOrderStatusHistory).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, actorType: 'admin', actorId: 1 }));
  });
  it('allows finance staff, without impersonating the customer in the audit', async () => {
    vi.mocked(createWorkerContext).mockResolvedValue({ user: { id: 130, email: 'finance@example.test' } } as any);
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    expect((await request()).status).toBe(200);
    expect(db.logOrderStatusHistory).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, actorType: 'staff', actorId: 130 }));
  });
  it.each([null, { id: 7, email: 'student@example.test' }, { id: 130, email: 'support@example.test' }])('denies unauthorized caller %j before reading or storing the order', async user => {
    vi.mocked(createWorkerContext).mockResolvedValue({ user } as any);vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    expect((await request()).status).toBe(user ? 403 : 401);
    expect(db.getOrderById).not.toHaveBeenCalled();expect(storagePutR2).not.toHaveBeenCalled();
  });
  it('retains owner isolation on the customer endpoint', async () => {
    vi.mocked(createWorkerContext).mockResolvedValue({ user: { id: 8 } } as any);
    expect((await request('payment-proof')).status).toBe(403);
    expect(storagePutR2).not.toHaveBeenCalled();
  });
  it('rejects fake image bytes and closed orders', async () => {
    expect((await request('admin-order-proof', new TextEncoder().encode('fake.jpg'))).status).toBe(415);
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, status: 'completed' } as any);
    expect((await request()).status).toBe(409);expect(storagePutR2).not.toHaveBeenCalled();
  });
});
