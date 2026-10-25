import { Badge } from "@/components/ui/badge";

export type ServiceStatusSnapshot = {
  isActive: boolean;
  isPaused: boolean;
  isPendingActivation: boolean;
  endDate: string | null;
  maxActivationDate?: string | null;
  pausedAt?: string | null;
  pausedReason?: string | null;
  pausedRemainingDays?: number | null;
  frozenUntil?: string | null;
};

/** A subscription record can be both pending and frozen. Show both blockers. */
export function TimedServiceStatus({
  subscription,
  isRtl,
  loginBlocked = false,
  compact = false,
}: {
  subscription?: ServiceStatusSnapshot | null;
  isRtl: boolean;
  loginBlocked?: boolean;
  compact?: boolean;
}) {
  const s = subscription;
  const expired = !!s?.endDate && new Date(s.endDate).getTime() < Date.now();
  const usable =
    !!s?.isActive &&
    !s.isPaused &&
    !s.isPendingActivation &&
    !expired &&
    !loginBlocked;
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : isRtl
        ? "غير محدد"
        : "Not set";

  return (
    <div className="min-w-0 space-y-2 text-sm" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap gap-1.5">
        <Badge
          className={
            usable
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-700"
          }
        >
          {usable
            ? isRtl
              ? "متاح الآن"
              : "Available now"
            : isRtl
              ? "غير متاح الآن"
              : "Unavailable now"}
        </Badge>
        {s?.isPaused && (
          <Badge className="bg-amber-100 text-amber-800">
            {isRtl ? "مجمّد يدوياً" : "Manually frozen"}
          </Badge>
        )}
        {s?.isPendingActivation && (
          <Badge className="bg-teal-100 text-teal-800">
            {isRtl ? "بانتظار التفعيل" : "Awaiting activation"}
          </Badge>
        )}
        {s && !s.isActive && (
          <Badge variant="outline">{isRtl ? "غير نشط" : "Inactive"}</Badge>
        )}
        {s && !s.isPendingActivation && !s.isPaused && expired && (
          <Badge variant="outline">{isRtl ? "منتهي" : "Expired"}</Badge>
        )}
      </div>
      {!s ? (
        <p className="text-xs text-muted-foreground">
          {isRtl
            ? "لا يوجد اشتراك لهذه الخدمة."
            : "No subscription for this service."}
        </p>
      ) : (
        <>
          {loginBlocked && (
            <p className="text-xs text-rose-700">
              {isRtl
                ? "الدخول إلى الحساب مقيّد أيضاً. فك تجميد الخدمة لا يعيد صلاحية الدخول."
                : "Account sign-in is also restricted. Unfreezing a service does not restore sign-in."}
            </p>
          )}
          {!s.isPendingActivation && s.isActive && (
            <p className="text-xs text-muted-foreground">
              {s.isPaused
                ? `${isRtl ? "رصيد الخدمة المحفوظ: " : "Saved service days: "}${s.pausedRemainingDays ?? 0}`
                : s.endDate && Number.isFinite(new Date(s.endDate).getTime())
                  ? `${isRtl ? "أيام الخدمة المتبقية: " : "Remaining service days: "}${Math.max(0, Math.ceil((new Date(s.endDate).getTime() - Date.now()) / 86_400_000))}`
                  : null}
            </p>
          )}
          {s.isPaused && (
            <div className="space-y-1 text-xs text-amber-900">
              <p>
                {isRtl
                  ? "الخطوة التالية: اطلب من المسؤول أو مدير الاشتراكات فك تجميد هذه الخدمة."
                  : "Next step: ask an admin or subscription manager to unfreeze this service."}
              </p>
              <p>
                {isRtl ? "سبب التجميد: " : "Freeze reason: "}
                {s.pausedReason ||
                  (isRtl ? "لم يُسجّل سبب" : "No reason recorded")}
              </p>
              {!compact && s.pausedAt && (
                <p>
                  {isRtl ? "تاريخ التجميد: " : "Frozen on: "}
                  {date(s.pausedAt)}
                </p>
              )}
              {!compact && (
                <p>
                  {s.frozenUntil
                    ? `${isRtl ? "فك التجميد المجدول: " : "Scheduled unfreeze: "}${date(s.frozenUntil)}`
                    : isRtl
                      ? "لا يوجد موعد تلقائي لفك التجميد."
                      : "No automatic unfreeze date."}
                </p>
              )}
            </div>
          )}
          {s.isPendingActivation ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                {s.isPaused
                  ? isRtl
                    ? "فك التجميد يزيل الإيقاف اليدوي فقط؛ تبقى الخدمة بانتظار التفعيل."
                    : "Unfreezing removes the manual hold only; this service will still await activation."
                  : isRtl
                    ? "الخدمة لم تبدأ بعد. أكمل متطلبات التفعيل أو انتظر موعد التفعيل التلقائي."
                    : "This service has not started. Complete activation requirements or wait for automatic activation."}
              </p>
              <p>
                {isRtl
                  ? "موعد التفعيل التلقائي: "
                  : "Automatic activation deadline: "}
                {date(s.maxActivationDate)}
              </p>
              {!compact && (
                <p>
                  {isRtl
                    ? "عند الموعد، تسمح السياسة الحالية بالتفعيل حتى مع بقاء متطلبات غير مكتملة. التفعيل لا يزيل التجميد اليدوي."
                    : "At the deadline, current policy allows activation with incomplete requirements. Activation does not remove a manual freeze."}
                </p>
              )}
              {!compact && (
                <p>
                  {isRtl
                    ? "مدة الخدمة تبدأ عند التفعيل."
                    : "Service time starts on activation."}
                </p>
              )}
            </div>
          ) : s.isPaused ? null : expired ? (
            <p className="text-xs text-muted-foreground">
              {isRtl
                ? "انتهت الخدمة. راجع التجديد مع مدير الاشتراكات."
                : "Service expired. Review renewal with the subscription manager."}
            </p>
          ) : (
            s.isActive && (
              <p className="text-xs text-muted-foreground">
                {isRtl ? "انتهاء الخدمة: " : "Service expires: "}
                {date(s.endDate)}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
