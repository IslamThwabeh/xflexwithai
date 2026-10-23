export type SearchableOrder = {
  id: number;
  userName?: string | null;
  userEmail?: string | null;
  giftEmail?: string | null;
};

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase();

export function getFocusedOrderId(search: string): number | null {
  const value = new URLSearchParams(search).get('orderId');
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function filterOrdersForSearch<T extends SearchableOrder>(orders: T[], search: string): T[] {
  const query = normalize(search);
  if (!query) return orders;
  if (/^#?\d+$/.test(query)) {
    const id = Number(query.replace(/^#/, ''));
    return orders.filter(order => order.id === id);
  }
  return orders.filter(order => [order.userName, order.userEmail, order.giftEmail]
    .some(value => value && normalize(value).includes(query)));
}

/** Owner declarations are separate from the payment-proof upload path. */
export function getOrderNoteAttachments(notes?: string | null): string[] {
  const matches = notes?.match(/https:\/\/videos\.xflexacademy\.com\/order-notes\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)].filter(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'videos.xflexacademy.com'
        && /^\/order-notes\/\d+\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(url.pathname)
        && !url.search && !url.hash;
    } catch { return false; }
  });
}
