import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatAcademyDateTime } from "@shared/academyLocale";
import { ORDER_REVIEW_STATUS_LABELS } from "@shared/orderCancellation";

export default function OrderStatusHistory({ orderId }: { orderId: number }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ar = language === "ar";
  const [requested, setRequested] = useState(false);
  const [cursor, setCursor] = useState<number>();
  const [previous, setPrevious] = useState<Array<number | undefined>>([]);
  const query = trpc.orders.adminStatusHistory.useQuery(
    { orderId, viewerId: user?.id ?? 0, beforeId: cursor },
    {
      enabled: requested && !!user,
      retry: false,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const data =
    !query.error &&
    query.data?.orderId === orderId &&
    query.data?.viewerId === user?.id
      ? query.data
      : undefined;
  const status = (value: string) =>
    ORDER_REVIEW_STATUS_LABELS[value]?.[language] ??
    (ar ? "غير معروف" : "Unknown");
  return (
    <section className="mb-4 space-y-3 rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">
          {ar ? "سجل حالة الطلب" : "Order status history"}
        </h4>
        {!requested && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRequested(true)}
          >
            {ar ? "عرض سجل المتابعة" : "Load status history"}
          </Button>
        )}
      </div>
      {requested &&
        (query.isFetching ? (
          <p role="status">
            {ar ? "جارٍ تحميل السجل…" : "Loading status history…"}
          </p>
        ) : !data ? (
          <div role="alert">
            <p>
              {ar
                ? "تعذّر تحميل سجل موثوق."
                : "Verified status history could not be loaded."}
            </p>
            <Button variant="link" onClick={() => void query.refetch()}>
              {ar ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "الأحدث أولاً؛ حتى ١٠ تغييرات في العرض. الأوقات بتوقيت فلسطين."
                : "Newest first; up to 10 changes per page. Times are shown in Palestine time."}
            </p>
            {!data.entries.length ? (
              <p>
                {ar
                  ? "لا يوجد تغيير حالة مسجّل لهذا الطلب."
                  : "No recorded status change for this order."}
              </p>
            ) : (
              <ol className="space-y-3">
                {data.entries.map(entry => (
                  <li
                    key={entry.id}
                    className="space-y-1 rounded-md border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {status(entry.previousStatus)} {ar ? "←" : "→"}{" "}
                      {status(entry.newStatus)}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {formatAcademyDateTime(entry.createdAt, language)} ·{" "}
                      {entry.actorName ||
                        (entry.actorType === "admin"
                          ? ar
                            ? "إدارة"
                            : "Administrator"
                          : entry.actorType === "staff"
                            ? ar
                              ? "موظف"
                              : "Staff"
                            : ar
                              ? "النظام"
                              : "System")}{" "}
                      {entry.actorId > 0 && <bdi>#{entry.actorId}</bdi>}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {entry.reason ||
                        (ar
                          ? "لم يُسجّل سبب في هذا التغيير السابق."
                          : "No reason was recorded for this earlier change.")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-2">
              {!!previous.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCursor(previous.at(-1));
                    setPrevious(previous.slice(0, -1));
                  }}
                >
                  {ar ? "الأحدث" : "Newer"}
                </Button>
              )}
              {data.nextCursor !== null && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPrevious([...previous, cursor]);
                    setCursor(data.nextCursor!);
                  }}
                >
                  {ar ? "الأقدم" : "Older"}
                </Button>
              )}
            </div>
          </>
        ))}
    </section>
  );
}
