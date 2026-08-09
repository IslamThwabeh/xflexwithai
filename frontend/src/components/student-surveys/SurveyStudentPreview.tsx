import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Eye, Info, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";

export type PreviewSurveyQuestion = {
  id: number;
  questionText: string;
  questionType: string;
  isRequired: boolean;
  optionsJson?: string | null;
};

export type PreviewSurvey = {
  id?: number;
  title: string;
  description?: string | null;
  isRequired: boolean;
  maxPostponements: number;
  questions: PreviewSurveyQuestion[];
};

const sampleSurvey: PreviewSurvey = {
  title: "Student experience check-in",
  description: "A short example showing exactly how an assigned survey appears to a student.",
  isRequired: true,
  maxPostponements: 2,
  questions: [
    { id: -1, questionText: "How clear was this week's learning material?", questionType: "rating", isRequired: true },
    {
      id: -2,
      questionText: "Which area would you like more support with?",
      questionType: "single_choice",
      isRequired: true,
      optionsJson: JSON.stringify(["Course content", "Trading practice", "Platform navigation"]),
    },
    { id: -3, questionText: "What could we improve for you?", questionType: "long_text", isRequired: false },
  ],
};

const sampleSurveyAr: PreviewSurvey = {
  title: "متابعة تجربة الطالب",
  description: "مثال قصير يوضح تماماً كيف يظهر الاستبيان المعيّن للطالب.",
  isRequired: true,
  maxPostponements: 2,
  questions: [
    { id: -1, questionText: "ما مدى وضوح المادة التعليمية لهذا الأسبوع؟", questionType: "rating", isRequired: true },
    {
      id: -2,
      questionText: "في أي مجال ترغب بالحصول على دعم إضافي؟",
      questionType: "single_choice",
      isRequired: true,
      optionsJson: JSON.stringify(["محتوى الدورة", "التطبيق العملي", "استخدام المنصة"]),
    },
    { id: -3, questionText: "ما الذي يمكننا تحسينه من أجلك؟", questionType: "long_text", isRequired: false },
  ],
};

export function SurveyStudentPreview({ survey, isRtl }: { survey?: PreviewSurvey | null; isRtl: boolean }) {
  const previewSurvey = survey ?? (isRtl ? sampleSurveyAr : sampleSurvey);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [simulatedSubmitted, setSimulatedSubmitted] = useState(false);
  const copy = isRtl ? {
    previewOnly: "معاينة فقط — لا يتم حفظ أي إجابة أو إرسال إشعار أو تغيير وصول أي طالب.",
    sample: "بيانات توضيحية",
    real: "معاينة الاستبيان المحدد",
    studentView: "ما يراه الطالب",
    due: "موعد تجريبي: خلال 24 ساعة",
    required: "مطلوب",
    optional: "اختياري",
    placeholder: "اكتب إجابتك هنا...",
    postpone: `تأجيل (حتى ${previewSurvey.maxPostponements} مرات)`,
    submit: "تجربة زر الإرسال",
    submitted: "تمت محاكاة الإرسال محلياً. لم تُحفظ أي بيانات.",
    reset: "إعادة المعاينة",
    controls: "يمكنك تجربة الحقول بأمان؛ جميع التغييرات تبقى داخل هذه المعاينة فقط.",
  } : {
    previewOnly: "Preview only — no answer is saved, no notification is sent, and no student's access changes.",
    sample: "Illustrative sample",
    real: "Selected survey preview",
    studentView: "What the student sees",
    due: "Example due date: within 24 hours",
    required: "Required",
    optional: "Optional",
    placeholder: "Type an answer here…",
    postpone: `Postpone (up to ${previewSurvey.maxPostponements} times)`,
    submit: "Simulate submit",
    submitted: "Submission simulated locally. No data was saved.",
    reset: "Reset preview",
    controls: "You can safely try the fields; all changes stay inside this preview.",
  };

  const requiredAnswered = useMemo(() => previewSurvey.questions.every((question) => {
    if (!question.isRequired) return true;
    const value = answers[question.id];
    return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
  }), [answers, previewSurvey.questions]);

  return (
    <div className="space-y-4" data-testid="student-survey-no-write-preview">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div>
          <p className="font-semibold">{copy.previewOnly}</p>
          <p className="mt-1 text-xs leading-5 text-sky-800">{copy.controls}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 p-2 shadow-sm">
        <div className="overflow-hidden rounded-[22px] bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Eye className="h-4 w-4 text-emerald-700" />
              {copy.studentView}
            </div>
            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
              {survey ? copy.real : copy.sample}
            </Badge>
          </div>

          <div className="space-y-6 p-5 md:p-7">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-950">{previewSurvey.title}</h2>
                {previewSurvey.isRequired && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{copy.required}</Badge>
                )}
              </div>
              {previewSurvey.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{previewSurvey.description}</p>
              )}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Info className="h-4 w-4 text-slate-500" />
                {copy.due}
              </div>
            </header>

            {simulatedSubmitted ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" />
                <p className="mt-3 font-semibold text-emerald-950">{copy.submitted}</p>
                <Button
                  variant="outline"
                  className="mt-4 border-emerald-300 bg-white"
                  onClick={() => {
                    setAnswers({});
                    setSimulatedSubmitted(false);
                  }}
                >
                  {copy.reset}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {previewSurvey.questions.map((question, index) => (
                    <PreviewQuestion
                      key={question.id}
                      index={index}
                      question={question}
                      value={answers[question.id]}
                      isRtl={isRtl}
                      requiredLabel={copy.required}
                      optionalLabel={copy.optional}
                      placeholder={copy.placeholder}
                      onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
                    />
                  ))}
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <Button variant="outline" disabled>{copy.postpone}</Button>
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-800"
                    disabled={!requiredAnswered}
                    onClick={() => setSimulatedSubmitted(true)}
                  >
                    {copy.submit}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewQuestion({
  question,
  index,
  value,
  isRtl,
  requiredLabel,
  optionalLabel,
  placeholder,
  onChange,
}: {
  question: PreviewSurveyQuestion;
  index: number;
  value?: string | string[];
  isRtl: boolean;
  requiredLabel: string;
  optionalLabel: string;
  placeholder: string;
  onChange: (value: string | string[]) => void;
}) {
  const options = parseOptions(question.optionsJson);
  const stringValue = typeof value === "string" ? value : "";
  const arrayValue = Array.isArray(value) ? value : [];

  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">
        {index + 1}. {question.questionText}
      </legend>
      <p className="mb-3 text-xs text-slate-500">{question.isRequired ? requiredLabel : optionalLabel}</p>

      {question.questionType === "long_text" ? (
        <Textarea rows={4} value={stringValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : question.questionType === "single_choice" ? (
        <div className="grid gap-2">
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <input type="radio" name={`preview-${question.id}`} checked={stringValue === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      ) : question.questionType === "multiple_choice" ? (
        <div className="grid gap-2">
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={arrayValue.includes(option)}
                onChange={(event) => onChange(event.target.checked
                  ? [...arrayValue, option]
                  : arrayValue.filter((item) => item !== option))}
              />
              {option}
            </label>
          ))}
        </div>
      ) : question.questionType === "rating" ? (
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(String(rating))}
              className={`rounded-xl border py-3 text-sm font-bold transition ${
                stringValue === String(rating)
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
              }`}
              aria-label={isRtl ? `تقييم ${rating}` : `Rating ${rating}`}
            >
              {rating}
            </button>
          ))}
        </div>
      ) : (
        <Input value={stringValue} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </fieldset>
  );
}

function parseOptions(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : [];
  } catch {
    return [];
  }
}
