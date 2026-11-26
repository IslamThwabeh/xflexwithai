import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatAcademyDateTime } from "@shared/academyLocale";
import { orderReviewDate } from "@shared/orderReview";

export default function OrderRelatedHistory({ orderId }: { orderId: number }) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [requested, setRequested] = useState(false);
  const query = trpc.orders.adminRelatedCompleted.useQuery(
    { orderId },
    {
      enabled: requested,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  return (
    <section className="mb-4 space-y-2 rounded-lg border bg-white p-3">
      <h4 className="font-semibold">
        {ar
          ? "طلبات مكتملة لنفس المشتري"
          : "Completed orders from the same purchaser"}
      </h4>
      <p className="text-xs text-slate-600">
        {ar
          ? "للمقارنة فقط؛ تطابق المشتري لا يثبت تكرار الطلب أو الدفع. قارن الباقة والمستلم والإيصال."
          : "Comparison only: the same purchaser does not prove a duplicate order or payment. Compare the package, recipient and receipt."}
      </p>
      {!requested ? (
        <Button variant="outline" size="sm" onClick={() => setRequested(true)}>
          {ar ? "عرض الطلبات المرتبطة" : "Load related orders"}
        </Button>
      ) : query.isPending ? (
        <p role="status">{ar ? "جارٍ تحميل الطلبات…" : "Loading orders…"}</p>
      ) : query.isError ? (
        <div role="alert">
          {ar
            ? "تعذّر تحميل الطلبات المرتبطة."
            : "Related orders could not be loaded."}
          <Button variant="link" onClick={() => void query.refetch()}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      ) : (
        <>
          {query.data?.orders.length === 0 && (
            <p>
              {ar
                ? "لا توجد طلبات مكتملة أخرى لهذا المشتري."
                : "No other completed orders for this purchaser."}
            </p>
          )}
          <ul className="space-y-2">
            {query.data?.orders.map(order => (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 break-words border-b pb-2 text-sm last:border-0 [overflow-wrap:anywhere]"
              >
                <Link
                  href={`/admin/orders?orderId=${order.id}`}
                  className="font-semibold text-emerald-700 underline"
                >
                  #{order.id}
                </Link>
                <span>
                  {order.packages
                    .map(item =>
                      ar
                        ? item.nameAr || item.nameEn
                        : item.nameEn || item.nameAr
                    )
                    .join("، ") ||
                    (order.transactionPurpose === "copier_subscription"
                      ? ar
                        ? "الناسخ"
                        : "Copier"
                      : ar
                        ? "الباقة غير متاحة"
                        : "Package unavailable")}
                </span>
                <span>
                  {order.isGift
                    ? `${ar ? "هدية إلى" : "Gift to"}: ${order.giftEmail || (ar ? "غير متاح" : "Unavailable")}`
                    : ar
                      ? "للمشتري"
                      : "For purchaser"}
                </span>
                <span className="text-xs text-slate-600">
                  {orderReviewDate(order.completedAt || order.createdAt)
                    ? formatAcademyDateTime(
                        orderReviewDate(order.completedAt || order.createdAt)!,
                        language
                      )
                    : "—"}{" "}
                  · {ar ? "فلسطين" : "Palestine"}
                </span>
              </li>
            ))}
          </ul>
          {query.data?.hasMore && (
            <p className="text-xs text-amber-800">
              {ar
                ? "تظهر آخر 20 نتيجة فقط؛ توجد طلبات مكتملة أقدم أيضاً."
                : "Showing the latest 20 results; older completed orders also exist."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
