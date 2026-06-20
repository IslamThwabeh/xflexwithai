import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CalendarDays, Clock3, Download, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  support: "Support",
  clients: "Client records",
  recommendations: "Recommendations",
  lexai: "LexAI",
  plans: "Plans",
  keys_orders: "Keys & orders",
  authentication: "Authentication",
  other: "Other",
};

const EXCEPTION_LABELS: Record<string, string> = {
  no_login: "No login during a scheduled workday",
  late_start: "Started after the scheduled time",
  early_finish: "Last session ended before the scheduled finish",
  long_gap: "Long gap between sessions",
  repeated_timeout: "Repeated inactivity timeouts",
  outside_schedule: "Activity outside scheduled hours",
  ip_change: "Network changed during the day",
  device_change: "Device/browser changed during the day",
};

const WARNING_LABELS: Record<string, string> = {
  actions_without_session: "Actions were found without a matching tracked session.",
  stale_open_session: "A stale open session requires reconciliation.",
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const formatDateTime = (value: unknown) => {
  if (!value) return "—";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const getLocalDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const getDateBounds = (localDate: string) => {
  const from = new Date(`${localDate}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
};

export default function EmployeeDailyAudit({ staffUserId }: { staffUserId: number }) {
  const [localDate, setLocalDate] = useState(getLocalDate);
  const [revealNetwork, setRevealNetwork] = useState(false);
  const [actionPage, setActionPage] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const bounds = useMemo(() => getDateBounds(localDate), [localDate]);
  const pageSize = 10;

  const reportQuery = trpc.monitoring.dailyReport.useQuery({
    staffUserId,
    localDate,
    timezone,
    ...bounds,
    revealNetwork,
  });
  const scheduleQuery = trpc.monitoring.schedule.useQuery({ staffUserId });
  const updateSchedule = trpc.monitoring.updateSchedule.useMutation({
    onSuccess: async () => {
      toast.success("Work schedule saved.");
      await Promise.all([scheduleQuery.refetch(), reportQuery.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });
  const [scheduleDraft, setScheduleDraft] = useState<any>(null);

  const report = reportQuery.data as any;
  const schedule = scheduleDraft ?? scheduleQuery.data;
  const actions = (report?.actions ?? []) as any[];
  const sessions = (report?.sessions ?? []) as any[];
  const pagedActions = actions.slice(actionPage * pageSize, (actionPage + 1) * pageSize);
  const pagedSessions = sessions.slice(sessionPage * pageSize, (sessionPage + 1) * pageSize);

  const patchSchedule = (patch: Record<string, unknown>) => {
    setScheduleDraft({ ...(scheduleQuery.data ?? {}), ...(scheduleDraft ?? {}), ...patch });
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Employee", report.staff.name || report.staff.email],
      ["Date", report.localDate],
      ["Admin timezone", report.timezone],
      ["First login", formatDateTime(report.summary.firstLoginAt)],
      ["Last activity", formatDateTime(report.summary.lastActivityAt)],
      ["Final logout", formatDateTime(report.summary.finalLogoutAt)],
      ["Active time", formatDuration(report.summary.activeSeconds)],
      ["Sessions", report.summary.sessionCount],
      ["Timeouts", report.summary.timeoutCount],
      ["Actions", report.summary.actionCount],
      [],
      ["Timestamp", "Action", "Category", "Resource", "Outcome"],
      ...actions.map((action) => [
        new Date(action.createdAt).toISOString(),
        action.actionType,
        CATEGORY_LABELS[action.actionType.split(".")[0]] ?? action.resourceType ?? "Other",
        action.resourceId == null ? action.resourceType ?? "" : `${action.resourceType}:${action.resourceId}`,
        action.details?.outcome ?? "success",
      ]),
    ];
    const csv = rows.map((row) =>
      row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","),
    ).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `employee-activity-${report.staff.id}-${localDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            Daily employee audit
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Calendar-day evidence in {timezone}. Times are sent to the server as exact UTC boundaries.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={localDate}
            onChange={(event) => {
              setLocalDate(event.target.value);
              setActionPage(0);
              setSessionPage(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={revealNetwork}
              onChange={(event) => setRevealNetwork(event.target.checked)}
            />
            Reveal full network data
          </label>
          <Button variant="outline" onClick={exportCsv} disabled={!report}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Building daily audit…</div>
      ) : reportQuery.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {reportQuery.error.message}
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <AuditMetric label="First login" value={formatDateTime(report.summary.firstLoginAt)} />
            <AuditMetric label="Last activity" value={formatDateTime(report.summary.lastActivityAt)} />
            <AuditMetric label="Final logout" value={formatDateTime(report.summary.finalLogoutAt)} />
            <AuditMetric label="Active time" value={formatDuration(report.summary.activeSeconds)} />
            <AuditMetric label="Actions" value={report.summary.actionCount} />
            <AuditMetric label="Records handled" value={report.summary.recordsHandled} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-medium text-slate-900">Hourly timeline</h3>
                <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
                  {report.timeline.map((slot: any) => {
                    const intensity = Math.min(100, Math.max(slot.activeSeconds / 36, slot.actionCount * 12));
                    return (
                      <div key={String(slot.start)} className="space-y-1 text-center">
                        <div className="flex h-20 items-end rounded-md bg-slate-100 p-1" title={`${slot.actionCount} actions, ${formatDuration(slot.activeSeconds)}`}>
                          <div className="w-full rounded bg-emerald-500" style={{ height: `${Math.max(3, intensity)}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(slot.start))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-medium text-slate-900">Work categories</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(report.categories).length ? Object.entries(report.categories).map(([category, count]) => (
                    <div key={category} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-xs text-slate-500">{CATEGORY_LABELS[category] ?? category}</div>
                      <div className="text-lg font-semibold text-slate-900">{String(count)}</div>
                    </div>
                  )) : <p className="col-span-full text-sm text-slate-500">No categorized actions.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="flex items-center gap-2 font-medium text-slate-900">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Neutral exceptions
                </h3>
                <div className="mt-3 space-y-2">
                  {report.exceptions.length ? report.exceptions.map((item: any) => (
                    <div key={item.code} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {EXCEPTION_LABELS[item.code] ?? item.code}
                      {item.value != null ? ` (${item.value}${item.code === "repeated_timeout" ? "" : " min"})` : ""}
                    </div>
                  )) : (
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      No objective exception detected.
                    </div>
                  )}
                  {report.dataWarnings.map((warning: string) => (
                    <div key={warning} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {WARNING_LABELS[warning] ?? warning}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="flex items-center gap-2 font-medium text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Work schedule
                </h3>
                {schedule ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-xs text-slate-500">
                      Schedule timezone
                      <input value={schedule.timezone} onChange={(event) => patchSchedule({ timezone: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-500">Start<input type="time" value={schedule.startTime} onChange={(event) => patchSchedule({ startTime: event.target.value })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm text-slate-900" /></label>
                      <label className="text-xs text-slate-500">End<input type="time" value={schedule.endTime} onChange={(event) => patchSchedule({ endTime: event.target.value })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm text-slate-900" /></label>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                      <label className="text-xs text-slate-500">
                        Grace period (minutes)
                        <input type="number" min={0} max={120} value={schedule.graceMinutes ?? 15} onChange={(event) => patchSchedule({ graceMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm text-slate-900" />
                      </label>
                      <label className="flex items-center gap-2 pb-2 text-xs text-slate-600">
                        <input type="checkbox" checked={Boolean(schedule.enabled)} onChange={(event) => patchSchedule({ enabled: event.target.checked })} />
                        Enabled
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                        const selected = schedule.workDays.includes(index);
                        return <button key={day} type="button" onClick={() => patchSchedule({ workDays: selected ? schedule.workDays.filter((value: number) => value !== index) : [...schedule.workDays, index].sort() })} className={`rounded px-2 py-1 text-xs ${selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{day}</button>;
                      })}
                    </div>
                    <Button
                      size="sm"
                      disabled={updateSchedule.isPending}
                      onClick={() => updateSchedule.mutate({
                        staffUserId,
                        timezone: schedule.timezone,
                        workDays: schedule.workDays,
                        startTime: schedule.startTime,
                        endTime: schedule.endTime,
                        graceMinutes: Number(schedule.graceMinutes ?? 15),
                        enabled: Boolean(schedule.enabled),
                      })}
                    >
                      <Save className="h-4 w-4" />
                      Save schedule
                    </Button>
                  </div>
                ) : <p className="mt-3 text-sm text-slate-500">Loading schedule…</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <AuditList
              title={`Sessions (${sessions.length})`}
              rows={pagedSessions}
              page={sessionPage}
              hasNext={(sessionPage + 1) * pageSize < sessions.length}
              onPage={setSessionPage}
              render={(session: any) => (
                <>
                  <div className="flex justify-between gap-3"><strong>{formatDateTime(session.loginAt)}</strong><span>{session.endReason ?? session.status}</span></div>
                  <div className="mt-1 text-xs text-slate-500">{formatDuration(session.activeSecondsInRange)} · {session.device} · {session.ipAddress ?? "No IP"}</div>
                </>
              )}
            />
            <AuditList
              title={`Actions (${actions.length})`}
              rows={pagedActions}
              page={actionPage}
              hasNext={(actionPage + 1) * pageSize < actions.length}
              onPage={setActionPage}
              render={(action: any) => (
                <>
                  <div className="flex justify-between gap-3"><strong>{action.actionType}</strong><span>{formatDateTime(action.createdAt)}</span></div>
                  <div className="mt-1 text-xs text-slate-500">{action.resourceType ?? "activity"}{action.resourceId != null ? ` #${action.resourceId}` : ""} · {action.details?.outcome ?? "success"}</div>
                </>
              )}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function AuditMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-900">{value}</div></div>;
}

function AuditList({
  title,
  rows,
  page,
  hasNext,
  onPage,
  render,
}: {
  title: string;
  rows: any[];
  page: number;
  hasNext: boolean;
  onPage: (page: number) => void;
  render: (row: any) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map((row) => <div key={row.id} className="rounded-lg border border-slate-100 p-3 text-sm">{render(row)}</div>) : <p className="text-sm text-slate-500">No records.</p>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="text-xs text-slate-500">Page {page + 1}</span>
        <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
