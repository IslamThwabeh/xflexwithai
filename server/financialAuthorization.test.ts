import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    isFinanceOwnerAdmin: vi.fn(),
    getUserById: vi.fn(),
    getUserRoles: vi.fn(),
    assignRole: vi.fn(),
    setFinanceRoleAssignment: vi.fn(),
    setUserRoles: vi.fn(),
    updateStaffPublicSupportName: vi.fn(),
    createStaffUser: vi.fn(),
    removeStaffStatus: vi.fn(),
    getAllRoleAssignments: vi.fn(),
  };
});

vi.mock('../backend/_core/orderEmails', async () => {
  const actual = await vi.importActual<typeof import('../backend/_core/orderEmails')>('../backend/_core/orderEmails');
  return { ...actual, sendStaffWelcomeEmail: vi.fn() };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';

const currentUser = {
  id: -1,
  email: 'admin@example.com',
  passwordHash: '',
  name: 'Admin',
  phone: null,
  emailVerified: false,
  createdAt: '',
  updatedAt: '',
  lastSignedIn: '',
  isStaff: false,
} as any;

function createCaller() {
  return appRouter.createCaller({
    req: { headers: {}, method: 'POST', path: '/api/trpc/test' },
    user: currentUser,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe('explicit financial authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 7, email: currentUser.email, name: 'Admin' } as any);
    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(false);
    vi.mocked(db.getUserById).mockResolvedValue({ id: 40, isStaff: true } as any);
    vi.mocked(db.getUserRoles).mockResolvedValue([] as any);
  });

  it('does not infer finance ownership from generic admin membership', async () => {
    await expect(createCaller().roles.assign({ userId: 40, role: 'finance_manager' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.isFinanceOwnerAdmin).toHaveBeenCalledWith(7);
    expect(db.setFinanceRoleAssignment).not.toHaveBeenCalled();
  });

  it('lets the explicit owner grant a staff finance role with the accountable actor', async () => {
    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(true);

    await expect(createCaller().roles.assign({ userId: 40, role: 'finance_manager' }))
      .resolves.toEqual({ success: true });

    expect(db.setFinanceRoleAssignment).toHaveBeenCalledWith({
      userId: 40,
      role: 'finance_manager',
      action: 'assigned',
      performedByAdminId: 7,
    });
  });

  it('preserves ordinary admin role management outside finance', async () => {
    await expect(createCaller().roles.assign({ userId: 40, role: 'support' }))
      .resolves.toEqual({ success: true });

    expect(db.isFinanceOwnerAdmin).not.toHaveBeenCalled();
    expect(db.assignRole).toHaveBeenCalledWith(40, 'support', 7);
  });

  it('blocks finance-role creation before creating the staff account', async () => {
    await expect(createCaller().roles.createStaff({
      name: 'Finance Employee',
      email: 'finance.employee@example.com',
      roles: ['finance_clerk'],
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.createStaffUser).not.toHaveBeenCalled();
  });

  it('lets a generic admin edit non-finance roles without silently removing existing finance access', async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([{ role: 'finance_viewer' }] as any);

    await expect(createCaller().roles.setRoles({
      userId: 40,
      roles: ['finance_viewer', 'support'],
    })).resolves.toEqual({ success: true });

    expect(db.isFinanceOwnerAdmin).not.toHaveBeenCalled();
    expect(db.setUserRoles).toHaveBeenCalledWith(40, ['support', 'finance_viewer'], 7);
    expect(db.setFinanceRoleAssignment).not.toHaveBeenCalled();

    await expect(createCaller().roles.setRoles({ userId: 40, roles: ['support'] }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires the owner and an audited actor when removing finance staff access', async () => {
    vi.mocked(db.getUserRoles).mockResolvedValue([{ role: 'support' }, { role: 'finance_clerk' }] as any);

    await expect(createCaller().roles.removeStaff({ userId: 40 }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.removeStaffStatus).not.toHaveBeenCalled();

    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(true);
    await expect(createCaller().roles.removeStaff({ userId: 40 }))
      .resolves.toEqual({ success: true });
    expect(db.removeStaffStatus).toHaveBeenCalledWith(40, 7);
  });

  it('exposes owner authority only as a server-derived UI hint', async () => {
    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(true);
    await expect(createCaller().roles.myFinanceAuthority())
      .resolves.toEqual({ isFinanceOwner: true });
  });
});
