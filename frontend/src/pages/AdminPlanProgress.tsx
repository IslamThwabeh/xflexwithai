import { GraduationCap, Download, ChevronDown, ChevronUp, CheckCircle2, Clock, Lock, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { useState } from 'react';

// Phase definitions matching the plan page
const PHASES = [
  { num: 1, nameAr: 'أساسيات التداول', nameEn: 'Trading Basics', days: '1–2' },
  { num: 2, nameAr: 'التحليل الأساسي', nameEn: 'Fundamental Analysis', days: '3–5' },
  { num: 3, nameAr: 'إدارة المخاطر', nameEn: 'Risk Management', days: '6–8' },
  { num: 4, nameAr: 'جلسة المراجعة', nameEn: 'Review Session', days: '8' },
  { num: 5, nameAr: 'خطة التداول', nameEn: 'Trading Plan', days: '9' },
  { num: 6, nameAr: 'الحساب الحقيقي', nameEn: 'Live Account', days: '10' },
];

const PHASE_TASKS: Record<number, { id: string; labelAr: string; labelEn: string }[]> = {
  1: [
    { id: 'p1_open_demo', labelAr: 'فتح حساب تجريبي', labelEn: 'Open demo account' },
    { id: 'p1_first_trade', labelAr: 'تنفيذ أول صفقة', labelEn: 'Execute first trade' },
    { id: 'p1_upload_account', labelAr: 'رفع صورة الحساب', labelEn: 'Upload account screenshot' },
    { id: 'p1_upload_trade', labelAr: 'رفع صورة الصفقة', labelEn: 'Upload trade screenshot' },
  ],
  2: [
    { id: 'p2_follow_news', labelAr: 'متابعة الأخبار الاقتصادية', labelEn: 'Follow economic news' },
    { id: 'p2_execute_trades', labelAr: 'تنفيذ صفقات تجريبية', labelEn: 'Execute demo trades' },
    { id: 'p2_record_results', labelAr: 'تسجيل نتائج الصفقات', labelEn: 'Record trade results' },
  ],
  3: [
    { id: 'p3_video_capital', labelAr: 'فيديو إدارة رأس المال', labelEn: 'Capital management video' },
    { id: 'p3_video_risk', labelAr: 'فيديو إدارة المخاطر', labelEn: 'Risk management video' },
    { id: 'p3_video_recs', labelAr: 'فيديو إدارة التوصيات', labelEn: 'Recommendations video' },
    { id: 'p3_video_psychology', labelAr: 'فيديو الأخطاء النفسية', labelEn: 'Psychology errors video' },
    { id: 'p3_video_discipline', labelAr: 'فيديو الانضباط', labelEn: 'Discipline video' },
    { id: 'p3_continue_trading', labelAr: 'الاستمرار بالتداول', labelEn: 'Continue trading' },
    { id: 'p3_risk_ratio', labelAr: 'الالتزام بنسبة مخاطرة', labelEn: 'Risk ratio adherence' },
    { id: 'p3_record_trades', labelAr: 'تسجيل الصفقات', labelEn: 'Record trades' },
  ],
  4: [
    { id: 'p4_book_session', labelAr: 'حجز الجلسة', labelEn: 'Book session' },
    { id: 'p4_attend', labelAr: 'حضور اللقاء', labelEn: 'Attend session' },
    { id: 'p4_prepare_questions', labelAr: 'تجهيز الأسئلة', labelEn: 'Prepare questions' },
  ],
  5: [
    { id: 'p5_write_plan', labelAr: 'كتابة الخطة', labelEn: 'Write plan' },
    { id: 'p5_send_plan', labelAr: 'إرسالها للدعم', labelEn: 'Send to support' },
    { id: 'p5_plan_approved', labelAr: 'اعتماد الخطة', labelEn: 'Plan approved' },
  ],
  6: [
    { id: 'p6_open_real', labelAr: 'فتح حساب حقيقي', labelEn: 'Open live account' },
    { id: 'p6_verify_account', labelAr: 'توثيق الحساب', labelEn: 'Verify account' },
    { id: 'p6_review_risk', labelAr: 'مراجعة خطة المخاطر', labelEn: 'Review risk plan' },
    { id: 'p6_confirm_ready', labelAr: 'تأكيد الجاهزية', labelEn: 'Confirm readiness' },
  ],
};

const ALL_TASK_IDS = Object.values(PHASE_TASKS).flat().map(t => t.id);

export default function AdminPlanProgress() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data: students, isLoading } = trpc.plan.listAll.useQuery();
  const approveMutation = trpc.plan.approvePhase.useMutation({
    onSuccess: () => utils.plan.listAll.invalidate(),
  });
  const revokeMutation = trpc.plan.revokePhase.useMutation({
    onSuccess: () => utils.plan.listAll.invalidate(),
  });
  const notesMutation = trpc.plan.updateNotes.useMutation({
    onSuccess: () => utils.plan.listAll.invalidate(),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notesInput, setNotesInput] = useState<Record<number, string>>({});
  // Two-tap confirmation: key = "studentId-phase", value = "approve" | "revoke"
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const getProgress = (student: any) => {
    const progress = JSON.parse(student.progress || '{}');
    const completed = ALL_TASK_IDS.filter(t => progress[t]).length;
    return Math.round((completed / ALL_TASK_IDS.length) * 100);
  };

  const getPhaseTaskCount = (student: any, phaseNum: number) => {
    const progress = JSON.parse(student.progress || '{}');
    const tasks = PHASE_TASKS[phaseNum] || [];
    const done = tasks.filter(t => progress[t.id]).length;
    return { done, total: tasks.length };
  };

  const exportCSV = () => {
    if (!students?.length) return;
    const header = 'Name,Email,Phone,Current Phase,Progress %,Phase 1,Phase 2,Phase 3,Phase 4,Phase 5,Phase 6,Created,Updated';
    const rows = students.map((s: any) => {
      const approvals = JSON.parse(s.phaseApprovals || '{}');
      const pct = getProgress(s);
      return `"${s.fullName}","${s.email}","${s.phone || ''}",${s.currentPhase},${pct}%,${approvals['1'] ? 'Approved' : 'Pending'},${approvals['2'] ? 'Approved' : 'Pending'},${approvals['3'] ? 'Approved' : 'Pending'},${approvals['4'] ? 'Approved' : 'Pending'},${approvals['5'] ? 'Approved' : 'Pending'},${approvals['6'] ? 'Approved' : 'Pending'},"${s.createdAt}","${s.updatedAt}"`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plan-progress.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApprovePhase = (studentId: number, phase: number) => {
    const key = `${studentId}-${phase}-approve`;
    if (confirmAction !== key) {
      setConfirmAction(key);
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmAction(prev => prev === key ? null : prev), 3000);
      return;
    }
    setConfirmAction(null);
    approveMutation.mutate({ studentId, phase });
  };

  const handleRevokePhase = (studentId: number, phase: number) => {
    const key = `${studentId}-${phase}-revoke`;
    if (confirmAction !== key) {
      setConfirmAction(key);
      setTimeout(() => setConfirmAction(prev => prev === key ? null : prev), 3000);
      return;
    }
    setConfirmAction(null);
    revokeMutation.mutate({ studentId, phase });
  };

  const handleSaveNotes = (studentId: number) => {
    const notes = notesInput[studentId] ?? '';
    notesMutation.mutate({ studentId, notes });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-emerald-500" />
            <div>
              <h1 className="text-2xl font-bold">{isRtl ? 'متابعة الخطة التعليمية' : 'Plan Progress'}</h1>
              <p className="text-sm text-muted-foreground">
                {isRtl ? 'برنامج الـ 10 أيام التأسيسي' : '10-Day Foundation Program'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {students?.length ?? 0} {isRtl ? 'طالب' : 'students'}
            </Badge>
            {students && students.length > 0 && (
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <Download className="h-4 w-4" />
                {isRtl ? 'تصدير CSV' : 'Export CSV'}
              </button>
            )}
          </div>
        </div>

        {/* Student Cards */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            {isRtl ? 'جارٍ التحميل...' : 'Loading...'}
          </div>
        ) : !students?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            {isRtl ? 'لا توجد بيانات بعد' : 'No data yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((student: any) => {
              const pct = getProgress(student);
              const approvals = JSON.parse(student.phaseApprovals || '{}');
              const answers = JSON.parse(student.answers || '{}');
              const isExpanded = expandedId === student.id;

              return (
                <div key={student.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition"
                    onClick={() => setExpandedId(isExpanded ? null : student.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base truncate">{student.fullName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{student.email}</span>
                        {student.phone && (
                          <a
                            href={`https://wa.me/${student.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            📱 {student.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
                        <Badge variant={student.currentPhase > 6 ? 'default' : 'secondary'} className="text-xs">
                          {student.currentPhase > 6
                            ? (isRtl ? 'مكتمل ✅' : 'Complete ✅')
                            : (isRtl ? `المرحلة ${student.currentPhase}` : `Phase ${student.currentPhase}`)}
                        </Badge>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t p-4 space-y-4 bg-muted/10">
                      {/* Phase grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {PHASES.map(phase => {
                          const { done, total } = getPhaseTaskCount(student, phase.num);
                          const isApproved = !!approvals[String(phase.num)];
                          const isCurrent = phase.num === student.currentPhase;

                          return (
                            <div key={phase.num} className={`rounded-lg border p-3 ${isApproved ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : isCurrent ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : ''}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isApproved ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : isCurrent ? (
                                    <Clock className="h-4 w-4 text-amber-500" />
                                  ) : (
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span className="font-bold text-sm">
                                    {isRtl ? phase.nameAr : phase.nameEn}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">{done}/{total}</span>
                              </div>

                              {/* Task checkboxes (read-only for admin) */}
                              <div className="space-y-1 mb-2">
                                {(PHASE_TASKS[phase.num] || []).map(task => {
                                  const progress = JSON.parse(student.progress || '{}');
                                  return (
                                    <div key={task.id} className="flex items-center gap-2 text-xs">
                                      <input type="checkbox" checked={!!progress[task.id]} disabled className="h-3.5 w-3.5 accent-emerald-500" />
                                      <span className={progress[task.id] ? 'line-through text-muted-foreground' : ''}>
                                        {isRtl ? task.labelAr : task.labelEn}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Approve/Revoke button */}
                              <div className="flex gap-2 mt-1">
                                {isApproved ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRevokePhase(student.id, phase.num); }}
                                    disabled={revokeMutation.isPending}
                                    className={`text-sm px-3 py-2 rounded-lg font-medium transition min-h-[40px] ${
                                      confirmAction === `${student.id}-${phase.num}-revoke`
                                        ? 'bg-red-600 text-white animate-pulse'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                    }`}
                                  >
                                    {revokeMutation.isPending ? '...' :
                                      confirmAction === `${student.id}-${phase.num}-revoke`
                                        ? (isRtl ? 'اضغط مرة أخرى للتأكيد' : 'Tap again to confirm')
                                        : (isRtl ? 'إلغاء الموافقة' : 'Revoke')}
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleApprovePhase(student.id, phase.num); }}
                                    disabled={approveMutation.isPending}
                                    className={`text-sm px-3 py-2 rounded-lg font-medium transition min-h-[40px] ${
                                      confirmAction === `${student.id}-${phase.num}-approve`
                                        ? 'bg-emerald-600 text-white animate-pulse'
                                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    }`}
                                  >
                                    {approveMutation.isPending ? '...' :
                                      confirmAction === `${student.id}-${phase.num}-approve`
                                        ? (isRtl ? 'اضغط مرة أخرى للتأكيد' : 'Tap again to confirm')
                                        : (isRtl ? 'موافقة ✅' : 'Approve ✅')}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Student answers */}
                      {Object.keys(answers).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-bold text-sm flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            {isRtl ? 'إجابات الطالب' : 'Student Answers'}
                          </h4>
                          {Object.entries(answers).map(([key, value]: [string, any]) => (
                            <div key={key} className="rounded-lg border p-3 bg-card">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">
                                {key.replace('phase', isRtl ? 'المرحلة ' : 'Phase ')}
                              </div>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Admin notes */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm">{isRtl ? 'ملاحظات الإدارة' : 'Admin Notes'}</h4>
                        <textarea
                          className="w-full min-h-[80px] p-3 text-sm border rounded-lg resize-y bg-background"
                          placeholder={isRtl ? 'أضف ملاحظات...' : 'Add notes...'}
                          value={notesInput[student.id] ?? student.adminNotes ?? ''}
                          onChange={e => setNotesInput(prev => ({ ...prev, [student.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handleSaveNotes(student.id)}
                          disabled={notesMutation.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition font-medium disabled:opacity-50"
                        >
                          {notesMutation.isPending ? '...' : (isRtl ? 'حفظ الملاحظات' : 'Save Notes')}
                        </button>
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                        <span>{isRtl ? 'تاريخ التسجيل:' : 'Created:'} {new Date(student.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        <span>{isRtl ? 'آخر تحديث:' : 'Updated:'} {new Date(student.updatedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
