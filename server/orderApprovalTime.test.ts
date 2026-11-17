import { describe, expect, it } from 'vitest';
import { formatApprovalDateTime, parseApprovalDateTime } from '../frontend/src/lib/orderApprovalTime';

describe('approval date input in Palestine time', () => {
  it('displays and parses winter time without borrowing the device timezone', () => {
    expect(formatApprovalDateTime(new Date('2026-11-17T15:34:00Z'))).toBe('2026-11-17T17:34');
    expect(parseApprovalDateTime('2026-11-17T17:34').toISOString()).toBe('2026-11-17T15:34:00.000Z');
  });
  it('uses Palestine seasonal rules for summer and crosses UTC dates correctly', () => {
    expect(parseApprovalDateTime('2026-08-17T00:30').toISOString()).toBe('2026-08-16T21:30:00.000Z');
    expect(formatApprovalDateTime(new Date('2026-08-16T21:30:00Z'))).toBe('2026-08-17T00:30');
  });
  it.each(['', 'invalid', '2026-02-30T17:00', '2026-11-17T24:00', '2026-11-17T00:99'])('rejects invalid time %s instead of adjusting a cash date', value => {
    expect(Number.isNaN(parseApprovalDateTime(value).getTime())).toBe(true);
  });
});
