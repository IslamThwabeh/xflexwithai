import { describe, expect, it } from 'vitest';
import { filterOrdersForSearch, getFocusedOrderId, getOrderNoteAttachments } from '../frontend/src/lib/orderManagement';

describe('order management search and deep links', () => {
  const older = { id: 135, userName: 'عميلة تجريبية', userEmail: 'learner@example.test' };
  const orders = [...Array.from({ length: 15 }, (_, i) => ({ id: 150 - i, userName: 'Another customer', userEmail: `test${i}@example.test` })), older];

  it('finds a historical order outside the first page by its exact order number', () => {
    expect(filterOrdersForSearch(orders, '#135')).toEqual([older]);
    expect(filterOrdersForSearch(orders, '135')).toEqual([older]);
    expect(filterOrdersForSearch(orders, '35')).toEqual([]);
  });
  it('searches Arabic names and case-insensitive email addresses', () => {
    expect(filterOrdersForSearch(orders, 'تجريبية')).toEqual([older]);
    expect(filterOrdersForSearch(orders, '  LEARNER@EXAMPLE.TEST ')).toEqual([older]);
    expect(filterOrdersForSearch(orders, '')).toBe(orders);
  });
  it('accepts only a positive integer order focus', () => {
    expect(getFocusedOrderId('?orderId=135')).toBe(135);
    for (const query of ['', '?orderId=-1', '?orderId=1.2', '?orderId=0', '?orderId=invalid']) expect(getFocusedOrderId(query)).toBeNull();
  });
  it('keeps owner-note attachments separate from actual payment proof', () => {
    const url = 'https://videos.xflexacademy.com/order-notes/135/owner-report-example.png';
    expect(getOrderNoteAttachments(`Owner statement: ${url}\n${url}`)).toEqual([url]);
    expect(getOrderNoteAttachments('https://videos.xflexacademy.com/payment-proofs/135/receipt.png')).toEqual([]);
    expect(getOrderNoteAttachments('https://videos.xflexacademy.com/order-notes/135/report.html')).toEqual([]);
    expect(getOrderNoteAttachments('https://unrelated.example/order-notes/135/report.png')).toEqual([]);
  });
});
