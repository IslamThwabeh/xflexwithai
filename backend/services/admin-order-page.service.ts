import type { D1Database } from "@cloudflare/workers-types";
import {
  OUTSTANDING_ORDER_STATUSES,
  type OrderReviewFilter,
} from "../../shared/orderReview";
export type OrderPageFilter = {
  status?: OrderReviewFilter;
  search: string;
  page: number;
  pageSize: number;
};
export type AdminOrderRow = Awaited<
  ReturnType<typeof import("../db").getAllOrders>
>[number];
export async function readAdminOrderPage(
  client: D1Database,
  input: OrderPageFilter
) {
  const clauses = [
      `NOT EXISTS (SELECT 1 FROM order_retirements r WHERE r.order_id=o.id)`,
    ],
    bindings: (string | number)[] = [];
  if (input.status === "outstanding") {
    clauses.push("o.status IN (?,?)");
    bindings.push(...OUTSTANDING_ORDER_STATUSES);
  } else if (input.status) {
    clauses.push("o.status=?");
    bindings.push(input.status);
  }
  const search = input.search.normalize("NFKC").trim();
  if (/^#?\d+$/.test(search)) {
    const id = Number(search.replace("#", ""));
    clauses.push("o.id=?");
    bindings.push(Number.isSafeInteger(id) ? id : -1);
  } else if (search) {
    clauses.push(
      "(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR o.giftEmail LIKE ? ESCAPE '\\')"
    );
    const term = "%" + search.replace(/[\\%_]/g, c => "\\" + c) + "%";
    bindings.push(term, term, term);
  }
  const from =
    "FROM orders o " +
    (search && !/^#?\d+$/.test(search)
      ? "LEFT JOIN users u ON u.id=o.userId "
      : "") +
    "WHERE " +
    clauses.join(" AND ");
  const count = await client
    .prepare("SELECT COUNT(*) AS total " + from)
    .bind(...bindings)
    .first<{ total: number }>();
  if (!count || !Number.isSafeInteger(count.total))
    throw Error("Order count unavailable");
  const pageSize = Math.min(50, Math.max(1, input.pageSize)),
    page = Math.max(
      1,
      Math.min(input.page, Math.max(1, Math.ceil(count.total / pageSize)))
    );
  const fields = [
    "id",
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
    "completedAt",
  ];
  const rows = await client
    .prepare(
      "WITH page AS (SELECT o.id " +
        from +
        " ORDER BY o.id DESC LIMIT ? OFFSET ?) SELECT " +
        fields.map(field => "o." + field).join(",") +
        ",u.email AS userEmail,u.name AS userName,u.phone AS userPhone " +
        "FROM page JOIN orders o ON o.id=page.id LEFT JOIN users u ON u.id=o.userId ORDER BY o.id DESC"
    )
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all<AdminOrderRow>();
  if (!rows.success) throw Error("Order page unavailable");
  return {
    items: rows.results,
    total: count.total,
    page,
    pageSize,
    generatedAt: new Date().toISOString(),
  };
}
