import type { ReactNode } from "react";
import { Info, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ActivityHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-sm">{children}</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="max-w-[calc(100vw-2rem)] text-sm"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function Branch({
  label,
  count,
  description,
  isRtl,
  children,
  highlight = false,
}: {
  label: string;
  count: number;
  description: string;
  isRtl: boolean;
  children?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li>
      <div
        className={`flex min-h-11 items-center gap-1 rounded-md px-2 ${highlight ? "bg-emerald-50 font-semibold text-emerald-900" : ""}`}
      >
        <span className="flex-1 text-sm">{label}</span>
        <span className="text-base font-semibold tabular-nums">
          {count.toLocaleString(isRtl ? "ar" : "en")}
        </span>
        <ActivityHelp label={`${isRtl ? "شرح" : "About"}: ${label}`}>
          {description}
        </ActivityHelp>
      </div>
      {children && (
        <ul className="ms-3 space-y-1 border-s border-border ps-3 sm:ms-5 sm:ps-4">
          {children}
        </ul>
      )}
    </li>
  );
}

export default function StudentActivityBreakdown({
  activeClients,
  isRtl,
}: {
  activeClients: number;
  isRtl: boolean;
}) {
  // Fetch only while expanded. No polling, repairs, email payloads or customer details.
  const { data, isLoading, isError, refetch, isFetching } =
    trpc.reports.recommendationAudience.useQuery(undefined, {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    });
  const row = (
    key: string,
    en: string,
    ar: string,
    count: number,
    descriptionEn: string,
    descriptionAr: string,
    children?: ReactNode,
    highlight = false
  ) => (
    <Branch
      key={key}
      label={isRtl ? ar : en}
      count={count}
      description={isRtl ? descriptionAr : descriptionEn}
      isRtl={isRtl}
      highlight={highlight}
    >
      {children}
    </Branch>
  );
  const extraExclusions = data
    ? [
        row(
          "staff",
          "Excluded: staff / analyst",
          "مستبعد: موظف / محلل",
          data.staffExcluded,
          "Staff and recommendation analysts are excluded from client alerts.",
          "الموظفون ومحللو التوصيات مستبعدون من تنبيهات العملاء."
        ),
        ...(data.accountUnavailable
          ? [
              row(
                "missing-account",
                "Excluded: account unavailable",
                "مستبعد: الحساب غير متاح",
                data.accountUnavailable,
                "The subscription has no matching client account.",
                "الاشتراك غير مرتبط بحساب عميل موجود."
              ),
            ]
          : []),
        ...(data.accountDisabled
          ? [
              row(
                "blocked",
                "Excluded: account blocked",
                "مستبعد: الحساب محظور",
                data.accountDisabled,
                "These accounts are blocked from signing in.",
                "هذه الحسابات محظورة من تسجيل الدخول."
              ),
            ]
          : []),
        ...(data.missingEmail
          ? [
              row(
                "email",
                "Excluded: missing email",
                "مستبعد: البريد غير موجود",
                data.missingEmail,
                "An email address is required for recommendation notifications.",
                "يلزم بريد إلكتروني لإشعارات التوصيات."
              ),
            ]
          : []),
        ...(data.notificationsDisabled
          ? [
              row(
                "disabled",
                "Excluded: notifications disabled",
                "مستبعد: الإشعارات معطلة",
                data.notificationsDisabled,
                "Recommendation notifications were disabled for these clients by staff.",
                "عطّل الفريق إشعارات التوصيات لهؤلاء العملاء."
              ),
            ]
          : []),
        ...(data.optedOut
          ? [
              row(
                "opted-out",
                "Excluded: opted out",
                "مستبعد: إلغاء الاشتراك بالإشعارات",
                data.optedOut,
                "These clients turned off recommendation notifications.",
                "أوقف هؤلاء العملاء إشعارات التوصيات."
              ),
            ]
          : []),
        ...(data.malformedPrefs
          ? [
              row(
                "preferences",
                "Excluded: invalid preferences",
                "مستبعد: إعدادات غير صالحة",
                data.malformedPrefs,
                "Notification preferences cannot be read, so these records are excluded.",
                "تعذر قراءة إعدادات الإشعارات، لذا استُبعدت هذه السجلات."
              ),
            ]
          : []),
        ...(data.duplicateRecords
          ? [
              row(
                "duplicates",
                "Duplicate eligible records",
                "سجلات مؤهلة مكررة",
                data.duplicateRecords,
                "A client with multiple eligible subscriptions is counted once in the notification audience.",
                "يُحتسب العميل ذو الاشتراكات المؤهلة المتعددة مرة واحدة فقط ضمن جمهور الإشعارات."
              ),
            ]
          : []),
        row(
          "eligible",
          "Eligible clients to notify",
          "عملاء مؤهلون للإخطار",
          data.eligibleCount,
          "Unique clients who qualify for a new recommendation alert now. This is not a delivered or read count. Follow-up alerts can have a smaller audience when a thread is muted.",
          "عملاء فريدون مؤهلون لتنبيه توصية جديدة الآن. هذا ليس عدد الرسائل المسلّمة أو المقروءة. قد يقل جمهور تنبيهات المتابعة عند كتم صفقة معينة.",
          undefined,
          true
        ),
      ]
    : [];

  return (
    <section
      id="student-activity-breakdown"
      aria-labelledby="student-activity-title"
      className="rounded-lg border bg-card p-3 text-card-foreground sm:p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="student-activity-title" className="text-sm font-semibold">
          {isRtl ? "تفاصيل نشاط العملاء" : "Client activity breakdown"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`me-1 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRtl ? "تحديث" : "Refresh"}
        </Button>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
        {isRtl
          ? "عدد العملاء ذوي الباقات يختلف عن عدد سجلات التوصيات. قد يمتلك العميل عدة اشتراكات، ومدة التوصيات مستقلة عن الباقة. الأعداد تشمل جميع العملاء ولا تتغير بفلاتر القائمة. اضغط رمز المعلومات لعرض الشرح."
          : "Package clients and recommendation records are different counts. A client can have multiple subscriptions, and recommendation access has its own expiry. These totals cover all clients and do not change with list filters. Hover over or tap an info icon for details."}
      </p>
      <ul className="space-y-2">
        {row(
          "packages",
          "Clients with packages marked active",
          "عملاء لديهم باقات مسجلة كنشطة",
          activeClients,
          "Non-staff clients with at least one package marked active. This uses the saved package flag; it does not check recommendation expiry or mean the client is online.",
          "عملاء من غير الموظفين لديهم باقة واحدة على الأقل مسجلة كنشطة. يعتمد العدد على حالة الباقة المحفوظة، ولا يتحقق من انتهاء التوصيات ولا يعني أن العميل متصل الآن."
        )}
        {isLoading && (
          <li role="status" className="p-2 text-sm text-muted-foreground">
            {isRtl
              ? "جار تحميل جمهور التوصيات…"
              : "Loading recommendation audience…"}
          </li>
        )}
        {isError && (
          <li role="alert" className="p-2 text-sm text-destructive">
            {isRtl
              ? "تعذر تحميل تفاصيل التوصيات. اضغط تحديث للمحاولة مجدداً."
              : "Could not load the recommendation breakdown. Select Refresh to retry."}
          </li>
        )}
        {data &&
          !isError &&
          row(
            "recommendations",
            "Recommendation records marked active",
            "سجلات التوصيات المسجلة كنشطة",
            data.totalSubs,
            "All recommendation subscription records whose saved active flag is on, including records that have expired, are paused, or are awaiting activation. These are not a subset of the package-client count above.",
            "جميع سجلات اشتراكات التوصيات التي لا تزال مسجلة كنشطة، بما فيها المنتهية والمجمدة وبانتظار التفعيل. هذه السجلات ليست جزءاً من عدد عملاء الباقات أعلاه.",
            <>
              {row(
                "expired",
                "Excluded: expired",
                "مستبعد: منتهي الصلاحية",
                data.expired,
                "Unpaused, activated records whose recommendation end date has passed.",
                "سجلات مفعلة وغير مجمدة انتهت مدة التوصيات فيها."
              )}
              {row(
                "paused",
                "Excluded: paused",
                "مستبعد: مجمد",
                data.paused,
                "Paused records are excluded first, regardless of their activation or expiry dates.",
                "تُستبعد السجلات المجمدة أولاً بغض النظر عن تواريخ التفعيل والانتهاء."
              )}
              {row(
                "pending",
                "Excluded: awaiting activation",
                "مستبعد: بانتظار التفعيل",
                data.pending,
                "Unpaused records that are still awaiting activation.",
                "سجلات غير مجمدة ما زالت بانتظار التفعيل."
              )}
              {row(
                "current",
                "Current, unpaused recommendation records",
                "سجلات توصيات سارية وغير مجمدة",
                data.activeSubs,
                "Records remaining after excluding paused, pending and expired subscriptions. Account and notification checks below determine the final audience.",
                "السجلات المتبقية بعد استبعاد المجمد وبانتظار التفعيل والمنتهي. تحدد فحوص الحساب والإشعارات أدناه الجمهور النهائي.",
                extraExclusions
              )}
            </>
          )}
      </ul>
      {data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {isRtl ? "آخر تحقق" : "Last checked"}:{" "}
          {new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Amman",
          }).format(new Date(data.checkedAt))}{" "}
          · {isRtl ? "بتوقيت عمّان" : "Amman time"}
        </p>
      )}
    </section>
  );
}
