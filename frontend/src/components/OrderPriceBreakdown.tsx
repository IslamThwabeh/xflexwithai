import { useLanguage } from "@/contexts/LanguageContext";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";

type DisplayPricing = {
  displaySubtotalIls: number;
  displayDiscountIls?: number;
  displayVatIls: number;
  displayTotalIls: number;
  displayPricingDifferenceIls?: number;
  vatRate: number;
  pricingFormatVersion?: number;
  displaySavingsIls?: number;
  displayPricingSnapshotInvalid?: boolean;
  status?: string;
};

export default function OrderPriceBreakdown({
  order,
  audience = "customer",
}: {
  order: DisplayPricing;
  audience?: "admin" | "customer";
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const fmt = (value: number) => formatAdminCurrencyFromIls(value, language);
  const discount = order.displayDiscountIls ?? 0;
  const difference = order.displayPricingDifferenceIls ?? 0;
  const netInvoice = order.pricingFormatVersion === 2;
  const closed = ["paid", "completed", "cancelled", "refunded"].includes(
    order.status ?? ""
  );
  const rows: Array<[string, number]> = [
    [
      netInvoice
        ? ar
          ? "المبلغ قبل الخصم والضريبة"
          : "Subtotal before discount and VAT"
        : ar
          ? "المبلغ الفرعي"
          : "Subtotal",
      order.displaySubtotalIls,
    ],
    ...(discount !== 0
      ? [
          [
            netInvoice
              ? ar
                ? "الخصم قبل الضريبة"
                : "Discount before VAT"
              : ar
                ? "الخصم"
                : "Discount",
            -discount,
          ] as [string, number],
        ]
      : []),
    [
      `${ar ? "ضريبة القيمة المضافة" : "VAT"} (${order.vatRate}%)`,
      order.displayVatIls,
    ],
  ];
  return (
    <section
      aria-label={ar ? "تفاصيل سعر الطلب" : "Order price breakdown"}
      className="min-w-0 space-y-3"
    >
      <dl className="space-y-2 text-sm">
        {rows.map(([label, amount]) => (
          <div
            key={label}
            className="flex flex-wrap justify-between gap-x-4 gap-y-1"
          >
            <dt className="text-slate-600">{label}</dt>
            <dd>
              <bdi>{fmt(amount)}</bdi>
            </dd>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t pt-2 text-base font-bold">
          <dt>{ar ? "الإجمالي" : "Total"}</dt>
          <dd>
            <bdi>{fmt(order.displayTotalIls)}</bdi>
          </dd>
        </div>
      </dl>
      {netInvoice &&
        Number.isFinite(order.displaySavingsIls) &&
        order.displaySavingsIls! > 0 && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {ar
              ? "إجمالي التوفير شامل الضريبة: "
              : "Total savings including VAT: "}
            <bdi>{fmt(order.displaySavingsIls!)}</bdi>
          </p>
        )}
      {order.displayPricingSnapshotInvalid &&
        (!Number.isFinite(difference) || Math.abs(difference) < 0.005) && (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {audience === "admin"
              ? ar
                ? "راجع السعر والخصم المحفوظين قبل تأكيد الدفع."
                : "Verify the original pricing and discount before confirming payment."
              : closed
                ? ar
                  ? "تفاصيل الفاتورة المحفوظة تحتاج إلى مراجعة. تواصل مع الدعم لتوضيح الفاتورة."
                  : "The saved invoice details need review. Contact support for invoice clarification."
                : ar
                  ? "سياق الفاتورة المحفوظ يحتاج إلى مراجعة. تواصل مع الدعم قبل الدفع."
                  : "The saved invoice context needs review. Contact support before paying."}
          </p>
        )}
      {Number.isFinite(difference) && Math.abs(difference) >= 0.005 && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950"
        >
          {audience === "admin" ? (
            <>
              {ar
                ? "مكونات السعر المحفوظة لا تطابق الإجمالي؛ الفارق: "
                : "The saved price components do not match the total. Difference: "}
              <bdi>{fmt(difference)}</bdi>
              {ar
                ? ". راجع أصل الطلب قبل اعتماد الدفع. لم يتم تغيير الإجمالي أو أي دفعة."
                : ". Review the source order before confirming payment. The total and recorded payments are unchanged."}
            </>
          ) : closed ? (
            ar ? (
              "تفاصيل الفاتورة المحفوظة تحتاج إلى مراجعة. الإجمالي المعروض لم يتغير. تواصل مع الدعم لتوضيح الفاتورة."
            ) : (
              "The saved invoice breakdown needs review. The displayed total is unchanged. Contact support for invoice clarification."
            )
          ) : ar ? (
            "تفاصيل السعر المحفوظة تحتاج إلى مراجعة. تواصل مع الدعم قبل الدفع للتأكد من تفاصيل طلبك."
          ) : (
            "The saved price breakdown needs review. Contact support before paying to confirm your order details."
          )}
        </p>
      )}
    </section>
  );
}
