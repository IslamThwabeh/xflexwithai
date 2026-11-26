import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import {
  CHECKOUT_FLOWS,
  isCheckoutIntentKey,
  type CheckoutFlow,
} from "../../shared/checkoutIntent";

export type CheckoutIntent = {
  userId: number;
  key: string;
  requestHash: string;
  flow: CheckoutFlow;
};
export class CheckoutIntentError extends Error {
  constructor(
    public readonly code: "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN",
    message: string
  ) {
    super(message);
  }
}

function validateIntent(intent: CheckoutIntent) {
  if (
    !Number.isSafeInteger(intent.userId) ||
    intent.userId <= 0 ||
    !isCheckoutIntentKey(intent.key) ||
    !/^[a-f0-9]{64}$/.test(intent.requestHash) ||
    !CHECKOUT_FLOWS.includes(intent.flow)
  ) {
    throw new CheckoutIntentError(
      "BAD_REQUEST",
      "Invalid checkout intent. Reload the checkout form."
    );
  }
}

export const CHECKOUT_INTENT_LOOKUP_SQL = `SELECT i.order_id,i.request_hash,i.flow,o.userId AS ownerId
  FROM checkout_intents i LEFT JOIN orders o ON o.id=i.order_id
  WHERE i.user_id=? AND i.intent_key=? LIMIT 1`;

export async function findCheckoutIntent(
  database: D1Database,
  intent: CheckoutIntent
) {
  validateIntent(intent);
  const row = await database
    .prepare(CHECKOUT_INTENT_LOOKUP_SQL)
    .bind(intent.userId, intent.key)
    .first<{
      order_id: number | null;
      request_hash: string;
      flow: string;
      ownerId: number | null;
    }>();
  if (!row) return null;
  if (row.request_hash !== intent.requestHash || row.flow !== intent.flow)
    throw new CheckoutIntentError(
      "CONFLICT",
      "This checkout key belongs to different purchase details. Review the form before starting another request."
    );
  if (!row.order_id)
    throw new CheckoutIntentError(
      "CONFLICT",
      "This request is not ready to resume. Retry or ask support to review it."
    );
  if (row.ownerId !== intent.userId)
    throw new CheckoutIntentError(
      "FORBIDDEN",
      "This checkout request is unavailable for the signed-in account."
    );
  return row.order_id;
}

/** Map an existing domain-eligible pending order without changing it. Multiple
 * immutable intents may refer to the same existing order, never another owner. */
export async function bindCheckoutIntentToOrder(
  database: D1Database,
  intent: CheckoutIntent,
  orderId: number
) {
  validateIntent(intent);
  await database
    .prepare(
      `INSERT INTO checkout_intents(user_id,intent_key,request_hash,flow,order_id,created_at)
    SELECT ?,?,?,?,id,? FROM orders WHERE id=? AND userId=?
    ON CONFLICT(user_id,intent_key) DO NOTHING`
    )
    .bind(
      intent.userId,
      intent.key,
      intent.requestHash,
      intent.flow,
      new Date().toISOString(),
      orderId,
      intent.userId
    )
    .run();
  const resolved = await findCheckoutIntent(database, intent);
  if (!resolved)
    throw new CheckoutIntentError(
      "FORBIDDEN",
      "The existing order cannot be attached to this checkout."
    );
  return resolved;
}

const orderColumns = [
  "userId",
  "status",
  "subtotal",
  "discountAmount",
  "vatRate",
  "vatAmount",
  "totalAmount",
  "currency",
  "paymentMethod",
  "paymentReference",
  "paymentProofUrl",
  "isGift",
  "giftEmail",
  "giftMessage",
  "notes",
  "isUpgrade",
  "upgradeFromPackageId",
  "transactionPurpose",
  "termsAcceptedAt",
  "termsAcceptedVersion",
  "termsAcceptedIpAddress",
  "termsAcceptedUserAgent",
  "createdAt",
  "updatedAt",
] as const;
const itemColumns = {
  itemType: "itemType",
  packageId: "packageId",
  courseId: "courseId",
  priceAtPurchase: "priceAtPurchase",
  currency: "currency",
  transactionPurpose: "transactionPurpose",
};
const renewalColumns = {
  userId: "user_id",
  packageId: "package_id",
  entitlementDays: "entitlement_days",
  amountIlsMinor: "amount_ils_minor",
  recommendationsCurrentEndAt: "recommendations_current_end_at",
  lexaiCurrentEndAt: "lexai_current_end_at",
  recommendationsProjectedEndAt: "recommendations_projected_end_at",
  lexaiProjectedEndAt: "lexai_projected_end_at",
  createdAt: "created_at",
};
const copierColumns = {
  userId: "user_id",
  status: "status",
  serviceKey: "service_key",
  amountIlsMinor: "amount_ils_minor",
  accessDays: "access_days",
  createdByType: "created_by_type",
  createdById: "created_by_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
};
const pricingColumns = {
  formatVersion: "format_version",
  grossSubtotalMinor: "gross_subtotal_minor",
  grossDiscountMinor: "gross_discount_minor",
  createdAt: "created_at",
};
type CouponSnapshot = {
  id: number;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  minOrderAmount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  packageId: number | null;
};
export type CheckoutOrderPlan = {
  intent: CheckoutIntent;
  order: Record<string, unknown>;
  item: Record<string, unknown>;
  renewal?: Record<string, unknown>;
  copier?: Record<string, unknown>;
  pricing?: {
    formatVersion: 2;
    grossSubtotalMinor: number;
    grossDiscountMinor: number;
    createdAt: string;
  };
  coupon?: CouponSnapshot;
};
type SqlValue = string | number | null;
function valuesFor(
  data: Record<string, unknown>,
  columns: Record<string, string>
) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== undefined
  );
  const names: string[] = [],
    values: SqlValue[] = [];
  for (const [name, value] of entries) {
    if (!Object.hasOwn(columns, name))
      throw new CheckoutIntentError(
        "BAD_REQUEST",
        "Unsupported checkout field."
      );
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    )
      throw new CheckoutIntentError("BAD_REQUEST", "Invalid checkout value.");
    if (typeof value === "number" && !Number.isFinite(value))
      throw new CheckoutIntentError("BAD_REQUEST", "Invalid checkout amount.");
    names.push(`"${columns[name]}"`);
    values.push(
      typeof value === "boolean" ? Number(value) : (value as SqlValue)
    );
  }
  return { names, values };
}
function childInsert(
  database: D1Database,
  intent: CheckoutIntent,
  table: string,
  orderColumn: string,
  data: Record<string, unknown>,
  columns: Record<string, string>
) {
  const { names, values } = valuesFor(data, columns);
  return database
    .prepare(
      `INSERT INTO ${table}("${orderColumn}",${names.join(",")})
    SELECT i.order_id,${names.map(() => "?").join(",")} FROM checkout_intents i
    WHERE i.user_id=? AND i.intent_key=? AND changes()>0`
    )
    .bind(...values, intent.userId, intent.key);
}

/** One D1 transaction owns intent, order, item and required detail. No cash,
 * key, entitlement, provider or notification work is performed here. */
export async function createOrderForCheckoutIntent(
  database: D1Database,
  plan: CheckoutOrderPlan
) {
  validateIntent(plan.intent);
  const order = { ...plan.order },
    intent = plan.intent;
  const subtotal = Number(order.subtotal),
    discount = Number(order.discountAmount ?? 0),
    vat = Number(order.vatAmount),
    total = Number(order.totalAmount);
  if (
    order.userId !== intent.userId ||
    order.status !== "pending" ||
    ![subtotal, discount, vat, total].every(Number.isSafeInteger) ||
    Math.min(subtotal, discount, vat, total) < 0 ||
    subtotal - discount + vat !== total
  )
    throw new CheckoutIntentError(
      "BAD_REQUEST",
      "The checkout invoice does not reconcile. Review its price before submitting."
    );
  if (
    (intent.flow === "renewal") !== !!plan.renewal ||
    (intent.flow === "copier") !== !!plan.copier
  )
    throw new CheckoutIntentError(
      "BAD_REQUEST",
      "Required checkout service details are missing."
    );
  const expectedPurpose =
    intent.flow === "package"
      ? order.isUpgrade
        ? "upgrade"
        : "new_sale"
      : intent.flow === "copier"
        ? "copier_subscription"
        : intent.flow;
  if (
    order.transactionPurpose !== expectedPurpose ||
    plan.item.transactionPurpose !== expectedPurpose ||
    plan.item.currency !== order.currency ||
    plan.item.itemType !== (intent.flow === "copier" ? "service" : "package") ||
    (intent.flow !== "copier" &&
      (!Number.isSafeInteger(plan.item.packageId) ||
        Number(plan.item.packageId) <= 0)) ||
    plan.item.priceAtPurchase !== (plan.pricing?.grossSubtotalMinor ?? total) ||
    (plan.coupon && intent.flow !== "package") ||
    (plan.renewal &&
      (plan.renewal.userId !== intent.userId ||
        plan.renewal.amountIlsMinor !== total)) ||
    (plan.copier &&
      (plan.copier.userId !== intent.userId ||
        plan.copier.amountIlsMinor !== total))
  )
    throw new CheckoutIntentError(
      "BAD_REQUEST",
      "Checkout items or service details do not match this request."
    );
  const existing = await findCheckoutIntent(database, intent);
  if (existing) return { orderId: existing, created: false };
  const now = new Date().toISOString();
  const coupon = plan.coupon;
  const grossSubtotal = plan.pricing?.grossSubtotalMinor ?? total;
  const couponGuard = coupon
    ? `EXISTS(SELECT 1 FROM coupons WHERE id=? AND is_active=1
    AND discount_type=? AND discount_value=? AND max_uses IS ? AND min_order_amount IS ?
    AND valid_from IS ? AND valid_until IS ? AND package_id IS ?
    AND (max_uses IS NULL OR max_uses=0 OR used_count<max_uses)
    AND (min_order_amount IS NULL OR min_order_amount<=?)
    AND (NULLIF(valid_from,'') IS NULL OR julianday(valid_from)<=julianday(?))
    AND (NULLIF(valid_until,'') IS NULL OR julianday(valid_until)>=julianday(?))
    AND (COALESCE(package_id,0)=0 OR package_id=?))`
    : "1";
  const couponParams: SqlValue[] = coupon
    ? [
        coupon.id,
        coupon.discountType,
        coupon.discountValue,
        coupon.maxUses,
        coupon.minOrderAmount,
        coupon.validFrom,
        coupon.validUntil,
        coupon.packageId,
        grossSubtotal,
        now,
        now,
        Number(plan.item.packageId ?? 0),
      ]
    : [];
  const orderData = valuesFor(
    order,
    Object.fromEntries(orderColumns.map(name => [name, name]))
  );
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO checkout_intents(user_id,intent_key,request_hash,flow,order_id,created_at)
      VALUES(?,?,CASE WHEN ${couponGuard} THEN ? ELSE NULL END,?,NULL,?) ON CONFLICT(user_id,intent_key) DO NOTHING`
      )
      .bind(
        intent.userId,
        intent.key,
        ...couponParams,
        intent.requestHash,
        intent.flow,
        now
      ),
    database
      .prepare(
        `INSERT INTO orders(${orderData.names.join(",")}) SELECT ${orderData.names.map(() => "?").join(",")} WHERE changes()>0 RETURNING id`
      )
      .bind(...orderData.values),
    database
      .prepare(
        `UPDATE checkout_intents SET order_id=last_insert_rowid()
      WHERE user_id=? AND intent_key=? AND order_id IS NULL AND changes()>0`
      )
      .bind(intent.userId, intent.key),
    childInsert(
      database,
      intent,
      "orderItems",
      "orderId",
      plan.item,
      itemColumns
    ),
  ];
  if (plan.renewal)
    statements.push(
      childInsert(
        database,
        intent,
        "order_renewal_details",
        "order_id",
        plan.renewal,
        renewalColumns
      )
    );
  if (plan.copier)
    statements.push(
      childInsert(
        database,
        intent,
        "trade_copier_subscriptions",
        "order_id",
        plan.copier,
        copierColumns
      )
    );
  if (plan.pricing)
    statements.push(
      childInsert(
        database,
        intent,
        "order_pricing_snapshots",
        "order_id",
        plan.pricing,
        pricingColumns
      )
    );
  if (coupon)
    statements.push(
      database
        .prepare(
          "UPDATE coupons SET used_count=used_count+1 WHERE id=? AND changes()>0"
        )
        .bind(coupon.id)
    );
  try {
    const results = await database.batch(statements);
    const orderId = await findCheckoutIntent(database, intent);
    if (!orderId)
      throw new CheckoutIntentError(
        "CONFLICT",
        "The checkout was not saved. Retry the same request."
      );
    return { orderId, created: !!results[1].results?.length };
  } catch (error) {
    // A competing request may have won after our initial lookup, even if a
    // now-exhausted coupon rejected this losing transaction's claim.
    const resolved = await findCheckoutIntent(database, intent);
    if (resolved) return { orderId: resolved, created: false };
    if (
      coupon &&
      /checkout_intents.request_hash|NOT NULL constraint failed: checkout_intents.request_hash/.test(
        error instanceof Error ? error.message : ""
      )
    )
      throw new CheckoutIntentError(
        "CONFLICT",
        "Coupon availability changed. Review the coupon and retry checkout."
      );
    throw error;
  }
}
