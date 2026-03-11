import { useState } from 'react';
import {
  Briefcase, Plus, Edit2, Save, X, Eye, EyeOff, Users,
  FileText, Download, ChevronDown, ChevronUp, Search,
  CheckCircle, Clock, XCircle, Star, MessageSquare, Sparkles, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { toast } from 'sonner';

const STATUS_MAP: Record<string, { label: string; labelAr: string; color: string; icon: any }> = {
  new: { label: 'New', labelAr: 'جديد', color: 'bg-blue-100 text-blue-700', icon: Clock },
  reviewed: { label: 'Reviewed', labelAr: 'تمت المراجعة', color: 'bg-yellow-100 text-yellow-700', icon: Eye },
  shortlisted: { label: 'Shortlisted', labelAr: 'مرشح', color: 'bg-green-100 text-green-700', icon: Star },
  rejected: { label: 'Rejected', labelAr: 'مرفوض', color: 'bg-red-100 text-red-700', icon: XCircle },
};

type Tab = 'applications' | 'jobs' | 'questions';

export default function AdminJobs() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [activeTab, setActiveTab] = useState<Tab>('applications');

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{isRtl ? 'إدارة الوظائف والطلبات' : 'Jobs & Applications'}</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
          {[
            { key: 'applications' as Tab, label: isRtl ? 'الطلبات' : 'Applications', icon: Users },
            { key: 'jobs' as Tab, label: isRtl ? 'الوظائف' : 'Jobs', icon: Briefcase },
            { key: 'questions' as Tab, label: isRtl ? 'الأسئلة' : 'Questions', icon: MessageSquare },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'applications' && <ApplicationsTab isRtl={isRtl} />}
        {activeTab === 'jobs' && <JobsTab isRtl={isRtl} />}
        {activeTab === 'questions' && <QuestionsTab isRtl={isRtl} />}
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// Applications Tab
// ============================================================================

function ApplicationsTab({ isRtl }: { isRtl: boolean }) {
  const utils = trpc.useUtils();
  const { data: jobs } = trpc.jobs.adminList.useQuery();
  const { data: stats } = trpc.jobs.stats.useQuery();
  const [filterJobId, setFilterJobId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const { data: applications, isLoading } = trpc.jobs.listApplications.useQuery(
    { jobId: filterJobId, status: filterStatus } as any
  );
  const updateStatusMut = trpc.jobs.updateStatus.useMutation({
    onSuccess: () => {
      utils.jobs.listApplications.invalidate();
      utils.jobs.stats.invalidate();
      toast.success(isRtl ? 'تم تحديث الحالة' : 'Status updated');
    },
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { key: 'total', label: isRtl ? 'الإجمالي' : 'Total', value: stats.total, color: 'text-gray-700 bg-gray-50' },
            { key: 'new', label: isRtl ? 'جديد' : 'New', value: stats.new, color: 'text-blue-700 bg-blue-50' },
            { key: 'reviewed', label: isRtl ? 'تمت المراجعة' : 'Reviewed', value: stats.reviewed, color: 'text-yellow-700 bg-yellow-50' },
            { key: 'shortlisted', label: isRtl ? 'مرشح' : 'Shortlisted', value: stats.shortlisted, color: 'text-green-700 bg-green-50' },
            { key: 'rejected', label: isRtl ? 'مرفوض' : 'Rejected', value: stats.rejected, color: 'text-red-700 bg-red-50' },
          ].map(s => (
            <div key={s.key} className={`rounded-xl p-3 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          value={filterJobId ?? ''}
          onChange={(e) => setFilterJobId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">{isRtl ? 'كل الوظائف' : 'All Jobs'}</option>
          {jobs?.map(j => <option key={j.id} value={j.id}>{j.titleAr}</option>)}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-white"
          value={filterStatus ?? ''}
          onChange={(e) => setFilterStatus(e.target.value || undefined)}
        >
          <option value="">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{isRtl ? v.labelAr : v.label}</option>
          ))}
        </select>
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : !applications || applications.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2" />
          <p>{isRtl ? 'لا توجد طلبات' : 'No applications yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              isRtl={isRtl}
              expanded={expandedId === app.id}
              onToggle={() => setExpandedId(expandedId === app.id ? null : app.id)}
              onStatusChange={(status) => updateStatusMut.mutate({ id: app.id, status: status as any })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  isRtl,
  expanded,
  onToggle,
  onStatusChange,
}: {
  app: any;
  isRtl: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
}) {
  const { data: detail } = trpc.jobs.getApplication.useQuery(
    { id: app.id },
    { enabled: expanded }
  );
  const aiScreenMut = trpc.jobs.aiScreen.useMutation();
  const [aiResult, setAiResult] = useState<string | null>(null);
  const statusInfo = STATUS_MAP[app.status] || STATUS_MAP.new;
  const StatusIcon = statusInfo.icon;

  const handleAiScreen = async () => {
    setAiResult(null);
    const res = await aiScreenMut.mutateAsync({ id: app.id });
    setAiResult(res.recommendation);
  };

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{app.applicantName}</div>
            <div className="text-xs text-gray-500 truncate">{app.email} · {app.jobTitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className={`${statusInfo.color} gap-1 text-xs`}>
            <StatusIcon className="w-3 h-3" />
            {isRtl ? statusInfo.labelAr : statusInfo.label}
          </Badge>
          <span className="text-xs text-gray-400">{new Date(app.submittedAt).toLocaleDateString('ar')}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && detail && (
        <div className="border-t p-4 bg-gray-50/50 space-y-4">
          {/* Applicant Info */}
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">{isRtl ? 'الهاتف:' : 'Phone:'}</span> <span className="font-medium" dir="ltr">{detail.phone}</span></div>
            <div><span className="text-gray-500">{isRtl ? 'الدولة:' : 'Country:'}</span> <span className="font-medium">{detail.country || '—'}</span></div>
            <div>
              <span className="text-gray-500">{isRtl ? 'السيرة الذاتية:' : 'CV:'}</span>{' '}
              {detail.cvFileUrl ? (
                <a href={detail.cvFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline gap-1 inline-flex items-center">
                  <Download className="w-3 h-3" /> {isRtl ? 'تحميل' : 'Download'}
                </a>
              ) : (
                <span className="text-gray-400">{isRtl ? 'لم يتم رفع CV' : 'No CV uploaded'}</span>
              )}
            </div>
          </div>

          {/* Answers */}
          {detail.answers && detail.answers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-700">{isRtl ? 'الإجابات:' : 'Answers:'}</h3>
              {detail.answers.map((a: any, idx: number) => (
                <div key={a.id} className="bg-white rounded-lg p-3 border">
                  <div className="text-xs font-medium text-gray-500 mb-1">{idx + 1}. {a.questionText}</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{a.answer}</div>
                </div>
              ))}
            </div>
          )}

          {/* AI Screening */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {isRtl ? 'تقييم الذكاء الاصطناعي' : 'AI Screening'}
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
                onClick={handleAiScreen}
                disabled={aiScreenMut.isPending}
              >
                {aiScreenMut.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isRtl ? 'جاري التقييم...' : 'Evaluating...'}</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />{isRtl ? 'تقييم بالذكاء الاصطناعي' : 'AI Evaluate'}</>
                )}
              </Button>
            </div>
            {aiScreenMut.isError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {isRtl ? 'فشل التقييم. تأكد من إعداد مفتاح OpenAI.' : 'Evaluation failed. Make sure OpenAI key is set.'}
              </div>
            )}
            {aiResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4" dir="rtl">
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: aiResult.replace(/### /g, '<strong>').replace(/\n(?=\S)/g, '</strong>\n').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}
                />
              </div>
            )}
          </div>

          {/* Status Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm text-gray-500 self-center">{isRtl ? 'تغيير الحالة:' : 'Change status:'}</span>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <Button
                key={key}
                size="sm"
                variant={app.status === key ? 'default' : 'outline'}
                className={`text-xs gap-1 ${app.status === key ? '' : ''}`}
                onClick={() => onStatusChange(key)}
                disabled={app.status === key}
              >
                <val.icon className="w-3 h-3" />
                {isRtl ? val.labelAr : val.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Jobs Tab
// ============================================================================

function JobsTab({ isRtl }: { isRtl: boolean }) {
  const utils = trpc.useUtils();
  const { data: jobs, isLoading } = trpc.jobs.adminList.useQuery();
  const createMut = trpc.jobs.create.useMutation({
    onSuccess: () => { utils.jobs.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تمت الإضافة' : 'Job created'); },
  });
  const updateMut = trpc.jobs.update.useMutation({
    onSuccess: () => { utils.jobs.adminList.invalidate(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Job updated'); },
  });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({ titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', sortOrder: 0 });
  };
  const startEdit = (j: any) => { setIsNew(false); setEditing({ ...j }); };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) await createMut.mutateAsync(editing);
    else await updateMut.mutateAsync(editing);
  };

  const toggleActive = async (j: any) => {
    await updateMut.mutateAsync({ id: j.id, isActive: !j.isActive });
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={startNew} className="gap-1.5">
          <Plus className="w-4 h-4" />{isRtl ? 'وظيفة جديدة' : 'New Job'}
        </Button>
      </div>

      {editing && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">{isNew ? (isRtl ? 'وظيفة جديدة' : 'New Job') : (isRtl ? 'تعديل الوظيفة' : 'Edit Job')}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
              <Input value={editing.titleAr} onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title (English)</label>
              <Input value={editing.titleEn} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                value={editing.descriptionAr}
                onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })}
                dir="rtl"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm min-h-[80px]"
                value={editing.descriptionEn || ''}
                onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'ترتيب العرض' : 'Sort Order'}</label>
              <Input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="w-4 h-4" />{isRtl ? 'حفظ' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
              <X className="w-4 h-4" />{isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <div className="space-y-3">
          {jobs?.map(j => (
            <div key={j.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{j.titleAr}</div>
                <div className="text-xs text-gray-500">{j.titleEn}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={j.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                  {j.isActive ? (isRtl ? 'مفعّل' : 'Active') : (isRtl ? 'معطّل' : 'Disabled')}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => startEdit(j)} className="gap-1">
                  <Edit2 className="w-3 h-3" />{isRtl ? 'تعديل' : 'Edit'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(j)} className="gap-1">
                  {j.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {j.isActive ? (isRtl ? 'تعطيل' : 'Disable') : (isRtl ? 'تفعيل' : 'Enable')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Questions Tab
// ============================================================================

function QuestionsTab({ isRtl }: { isRtl: boolean }) {
  const utils = trpc.useUtils();
  const { data: jobs } = trpc.jobs.adminList.useQuery();
  const { data: questions, isLoading } = trpc.jobs.listQuestions.useQuery();
  const createMut = trpc.jobs.createQuestion.useMutation({
    onSuccess: () => { utils.jobs.listQuestions.invalidate(); setEditing(null); toast.success(isRtl ? 'تمت الإضافة' : 'Question added'); },
  });
  const updateMut = trpc.jobs.updateQuestion.useMutation({
    onSuccess: () => { utils.jobs.listQuestions.invalidate(); setEditing(null); toast.success(isRtl ? 'تم التحديث' : 'Updated'); },
  });
  const deleteMut = trpc.jobs.deleteQuestion.useMutation({
    onSuccess: () => { utils.jobs.listQuestions.invalidate(); toast.success(isRtl ? 'تم الحذف' : 'Deleted'); },
  });

  const [editing, setEditing] = useState<any>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({ jobId: null, questionAr: '', questionEn: '', sortOrder: 0 });
  };
  const startEdit = (q: any) => { setIsNew(false); setEditing({ ...q }); };

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) await createMut.mutateAsync(editing);
    else await updateMut.mutateAsync(editing);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRtl ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    await deleteMut.mutateAsync({ id });
  };

  const jobMap = new Map(jobs?.map(j => [j.id, j]) || []);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={startNew} className="gap-1.5">
          <Plus className="w-4 h-4" />{isRtl ? 'سؤال جديد' : 'New Question'}
        </Button>
      </div>

      {editing && (
        <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">{isNew ? (isRtl ? 'سؤال جديد' : 'New Question') : (isRtl ? 'تعديل السؤال' : 'Edit Question')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الوظيفة' : 'Job'}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                value={editing.jobId ?? ''}
                onChange={(e) => setEditing({ ...editing, jobId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{isRtl ? 'سؤال عام (لجميع الوظائف)' : 'General (all jobs)'}</option>
                {jobs?.map(j => <option key={j.id} value={j.id}>{j.titleAr}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'السؤال (عربي)' : 'Question (Arabic)'}</label>
              <Input value={editing.questionAr} onChange={(e) => setEditing({ ...editing, questionAr: e.target.value })} dir="rtl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question (English)</label>
              <Input value={editing.questionEn || ''} onChange={(e) => setEditing({ ...editing, questionEn: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isRtl ? 'الترتيب' : 'Sort Order'}</label>
              <Input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="w-4 h-4" />{isRtl ? 'حفظ' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="gap-1.5">
              <X className="w-4 h-4" />{isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <div className="space-y-2">
          {questions?.map(q => (
            <div key={q.id} className="bg-white border rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate" dir="rtl">{q.questionAr}</div>
                <div className="text-xs text-gray-400">
                  {q.jobId ? (jobMap.get(q.jobId)?.titleAr || `Job #${q.jobId}`) : (isRtl ? 'سؤال عام' : 'General')}
                  {' · '}{isRtl ? 'ترتيب' : 'Order'}: {q.sortOrder}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => startEdit(q)} className="gap-1 text-xs">
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(q.id)} className="gap-1 text-xs text-red-500 hover:text-red-700">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
