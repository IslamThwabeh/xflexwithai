import { type ReactNode, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Eye,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type SafeAdminPreviewProps = {
  isRtl: boolean;
  audience: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  anchorId?: string;
  focusOnMount?: boolean;
};

/**
 * A presentational boundary for synthetic admin previews.
 *
 * Preview content is supplied locally by the page: this component never loads a
 * student record, submits a mutation, or triggers a notification.
 */
export function SafeAdminPreview({
  isRtl,
  audience,
  title,
  description,
  children,
  className = "",
  anchorId,
  focusOnMount = false,
}: SafeAdminPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusOnMount || typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      const preview = previewRef.current;
      if (!preview) return;
      preview.focus({ preventScroll: true });
      preview.scrollIntoView({ behavior: "auto", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusOnMount]);

  const copy = isRtl
    ? {
        preview: "معاينة الإدارة فقط",
        sample: "بيانات تجريبية",
        readOnly: "للقراءة فقط",
        notice:
          "هذه معاينة آمنة ببيانات افتراضية. لن يتم حفظ أي إجراء أو إرسال أي إشعار أو تغيير حساب طالب أو موظف.",
        viewingAs: "طريقة العرض",
      }
    : {
        preview: "Admin preview only",
        sample: "Sample data",
        readOnly: "Read only",
        notice:
          "This is a safe preview with synthetic data. No action is saved, no notification is sent, and no student or staff account is changed.",
        viewingAs: "Viewing as",
      };

  const headingId = anchorId ? `${anchorId}-title` : undefined;

  return (
    <div
      ref={previewRef}
      id={anchorId}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="scroll-mt-20 outline-none"
    >
      <Card
        className={`overflow-hidden border-indigo-200 bg-white shadow-sm ${className}`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="border-b border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-sky-50 px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-sm">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-indigo-950">{copy.preview}</p>
                  <Badge
                    variant="outline"
                    className="border-indigo-200 bg-white text-indigo-700"
                  >
                    <FlaskConical className="me-1 h-3 w-3" />
                    {copy.sample}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-600"
                  >
                    <LockKeyhole className="me-1 h-3 w-3" />
                    {copy.readOnly}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-indigo-800">
                  {copy.notice}
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-indigo-200 bg-white/90 px-3 py-2 text-sm shadow-sm">
              <span className="text-xs text-slate-500">{copy.viewingAs}</span>
              <p className="font-semibold text-slate-950">{audience}</p>
            </div>
          </div>
        </div>
        <CardHeader className="pb-3">
          <h2 id={headingId} className="text-xl font-bold text-slate-950">
            {title}
          </h2>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

type SetupItem = {
  label: string;
  complete?: boolean;
  detail?: string;
  action?: ReactNode;
};

type AdminFeatureSetupCardProps = {
  isRtl: boolean;
  title: string;
  description: string;
  items: SetupItem[];
  action?: ReactNode;
};

export function AdminFeatureSetupCard({
  isRtl,
  title,
  description,
  items,
  action,
}: AdminFeatureSetupCardProps) {
  const statusLabel = isRtl ? "الإعداد مطلوب" : "Setup required";

  return (
    <Card
      className="border-amber-200 bg-amber-50/70 shadow-sm"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-3 border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100">
              {statusLabel}
            </Badge>
            <h2 className="text-xl font-bold text-amber-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {description}
            </p>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <div
              key={item.label}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3"
            >
              {item.complete ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.label}
                </p>
                {item.detail && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.detail}
                  </p>
                )}
                {item.action && (
                  <div className="mt-2">{item.action}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
