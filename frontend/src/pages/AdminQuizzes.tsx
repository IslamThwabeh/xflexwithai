import { useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  CheckCircle2,
  Circle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

type QuizOption = {
  id: number;
  questionId: number;
  optionId: string;
  optionText: string;
  isCorrect: boolean;
  createdAt: string;
};

type QuizQuestion = {
  id: number;
  quizId: number;
  questionText: string;
  orderNum: number;
  createdAt: string;
  updatedAt: string;
  options: QuizOption[];
};

type QuizDetail = {
  id: number;
  level: number;
  title: string;
  description: string | null;
  passingScore: number;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestion[];
};

export default function AdminQuizzes() {
  const { language, t } = useLanguage();
  const isAr = language === "ar";
  const utils = trpc.useUtils();

  // Queries
  const { data: quizzes, isLoading } = trpc.adminQuiz.list.useQuery();

  // Mutations
  const createQuiz = trpc.adminQuiz.create.useMutation({
    onSuccess: () => {
      utils.adminQuiz.list.invalidate();
      toast.success(isAr ? "تم إنشاء الاختبار" : "Quiz created");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateQuiz = trpc.adminQuiz.update.useMutation({
    onSuccess: () => {
      utils.adminQuiz.list.invalidate();
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تم تحديث الاختبار" : "Quiz updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteQuiz = trpc.adminQuiz.delete.useMutation({
    onSuccess: () => {
      utils.adminQuiz.list.invalidate();
      setExpandedQuizId(null);
      toast.success(isAr ? "تم حذف الاختبار" : "Quiz deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const createQuestion = trpc.adminQuiz.createQuestion.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تمت إضافة السؤال" : "Question added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateQuestion = trpc.adminQuiz.updateQuestion.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تم تحديث السؤال" : "Question updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteQuestion = trpc.adminQuiz.deleteQuestion.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تم حذف السؤال" : "Question deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const createOption = trpc.adminQuiz.createOption.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تمت إضافة الخيار" : "Option added");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateOption = trpc.adminQuiz.updateOption.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteOption = trpc.adminQuiz.deleteOption.useMutation({
    onSuccess: () => {
      utils.adminQuiz.getById.invalidate();
      toast.success(isAr ? "تم حذف الخيار" : "Option deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [expandedQuizId, setExpandedQuizId] = useState<number | null>(null);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [newQuiz, setNewQuiz] = useState({ level: 1, title: "", description: "", passingScore: 50 });
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editQuizData, setEditQuizData] = useState({ title: "", description: "", passingScore: 50, level: 1 });
  const [addingQuestionForQuiz, setAddingQuestionForQuiz] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({ questionText: "", orderNum: 1 });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editQuestionData, setEditQuestionData] = useState({ questionText: "", orderNum: 1 });
  const [addingOptionForQuestion, setAddingOptionForQuestion] = useState<number | null>(null);
  const [newOption, setNewOption] = useState({ optionId: "A", optionText: "", isCorrect: false });

  // Expanded quiz detail
  const { data: quizDetail } = trpc.adminQuiz.getById.useQuery(
    { id: expandedQuizId! },
    { enabled: !!expandedQuizId }
  );

  const { data: quizStats } = trpc.adminQuiz.stats.useQuery(
    { id: expandedQuizId! },
    { enabled: !!expandedQuizId }
  );

  const handleCreateQuiz = async () => {
    await createQuiz.mutateAsync(newQuiz);
    setCreatingQuiz(false);
    setNewQuiz({ level: 1, title: "", description: "", passingScore: 50 });
  };

  const handleUpdateQuiz = async (id: number) => {
    await updateQuiz.mutateAsync({ id, ...editQuizData });
    setEditingQuizId(null);
  };

  const handleDeleteQuiz = async (id: number) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذا الاختبار وجميع أسئلته؟" : "Delete this quiz and all its questions?")) return;
    await deleteQuiz.mutateAsync({ id });
  };

  const handleCreateQuestion = async (quizId: number) => {
    await createQuestion.mutateAsync({ quizId, ...newQuestion });
    setAddingQuestionForQuiz(null);
    setNewQuestion({ questionText: "", orderNum: 1 });
  };

  const handleUpdateQuestion = async (id: number) => {
    await updateQuestion.mutateAsync({ id, ...editQuestionData });
    setEditingQuestionId(null);
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذا السؤال؟" : "Delete this question and its options?")) return;
    await deleteQuestion.mutateAsync({ id });
  };

  const handleCreateOption = async (questionId: number) => {
    await createOption.mutateAsync({ questionId, ...newOption });
    setAddingOptionForQuestion(null);
    setNewOption({ optionId: "A", optionText: "", isCorrect: false });
  };

  const handleDeleteOption = async (id: number) => {
    if (!confirm(isAr ? "حذف هذا الخيار؟" : "Delete this option?")) return;
    await deleteOption.mutateAsync({ id });
  };

  const toggleCorrectOption = async (option: QuizOption) => {
    await updateOption.mutateAsync({ id: option.id, isCorrect: !option.isCorrect });
  };

  const nextOptionId = (options: QuizOption[]) => {
    const used = options.map((o) => o.optionId);
    for (const letter of "ABCDEFGH") {
      if (!used.includes(letter)) return letter;
    }
    return String.fromCharCode(65 + options.length);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold">{t("admin.quizzes.title")}</h1>
          </div>
          <Button onClick={() => setCreatingQuiz(true)} className="gap-1.5" disabled={creatingQuiz}>
            <Plus className="w-4 h-4" />
            {t("admin.quizzes.newQuiz")}
          </Button>
        </div>

        {/* Create New Quiz Form */}
        {creatingQuiz && (
          <div className="bg-white dark:bg-gray-900 border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">{t("admin.quizzes.newQuiz")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("admin.quizzes.level")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={newQuiz.level}
                  onChange={(e) => setNewQuiz({ ...newQuiz, level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>{t("admin.quizzes.passingScore")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newQuiz.passingScore}
                  onChange={(e) => setNewQuiz({ ...newQuiz, passingScore: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t("admin.quizzes.quizTitle")}</Label>
                <Input
                  value={newQuiz.title}
                  onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                  placeholder={isAr ? "عنوان الاختبار" : "Quiz title"}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t("admin.quizzes.description")}</Label>
                <Textarea
                  value={newQuiz.description}
                  onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                  placeholder={isAr ? "وصف الاختبار (اختياري)" : "Quiz description (optional)"}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleCreateQuiz} disabled={!newQuiz.title || createQuiz.isPending}>
                <Save className="w-4 h-4 me-1" />
                {isAr ? "حفظ" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setCreatingQuiz(false)}>
                <X className="w-4 h-4 me-1" />
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500">
            {isAr ? "جاري التحميل..." : "Loading..."}
          </div>
        )}

        {/* Quiz List */}
        {!isLoading && quizzes && quizzes.length === 0 && (
          <div className="text-center py-12 text-gray-500 border rounded-xl">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{isAr ? "لا توجد اختبارات بعد" : "No quizzes yet"}</p>
          </div>
        )}

        <div className="space-y-4">
          {quizzes?.map((quiz) => {
            const isExpanded = expandedQuizId === quiz.id;
            const isEditingThis = editingQuizId === quiz.id;

            return (
              <div key={quiz.id} className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                {/* Quiz Header */}
                <div className="p-4 flex items-center gap-3">
                  <button
                    className="flex-1 flex items-center gap-3 text-start"
                    onClick={() => setExpandedQuizId(isExpanded ? null : quiz.id)}
                  >
                    <Badge variant="outline" className="text-base font-bold min-w-[40px] justify-center">
                      {quiz.level}
                    </Badge>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{quiz.description}</p>
                      )}
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {isAr ? `نسبة النجاح: ${quiz.passingScore}%` : `Pass: ${quiz.passingScore}%`}
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingQuizId(quiz.id);
                        setEditQuizData({
                          title: quiz.title,
                          description: quiz.description || "",
                          passingScore: quiz.passingScore,
                          level: quiz.level,
                        });
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteQuiz(quiz.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Edit Quiz Inline */}
                {isEditingThis && (
                  <div className="px-4 pb-4 border-t pt-4 bg-gray-50 dark:bg-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>{t("admin.quizzes.level")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={editQuizData.level}
                          onChange={(e) => setEditQuizData({ ...editQuizData, level: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label>{t("admin.quizzes.passingScore")}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={editQuizData.passingScore}
                          onChange={(e) =>
                            setEditQuizData({ ...editQuizData, passingScore: parseInt(e.target.value) || 50 })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>{t("admin.quizzes.quizTitle")}</Label>
                        <Input
                          value={editQuizData.title}
                          onChange={(e) => setEditQuizData({ ...editQuizData, title: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>{t("admin.quizzes.description")}</Label>
                        <Textarea
                          value={editQuizData.description}
                          onChange={(e) => setEditQuizData({ ...editQuizData, description: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => handleUpdateQuiz(quiz.id)} disabled={updateQuiz.isPending}>
                        <Save className="w-4 h-4 me-1" />
                        {isAr ? "حفظ" : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingQuizId(null)}>
                        <X className="w-4 h-4 me-1" />
                        {isAr ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expanded: Questions + Stats */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Stats */}
                    {quizStats && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          <span className="text-muted-foreground">{isAr ? "المحاولات:" : "Attempts:"}</span>
                          <span className="font-semibold">{quizStats.totalAttempts}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{isAr ? "نسبة النجاح:" : "Pass Rate:"}</span>{" "}
                          <span className="font-semibold">{quizStats.passRate}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{isAr ? "متوسط الدرجة:" : "Avg Score:"}</span>{" "}
                          <span className="font-semibold">{quizStats.avgScore}%</span>
                        </div>
                      </div>
                    )}

                    {/* Questions */}
                    <div className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-base">
                          {isAr ? "الأسئلة" : "Questions"}
                          {quizDetail?.questions && (
                            <span className="text-muted-foreground ms-2 text-sm">
                              ({quizDetail.questions.length})
                            </span>
                          )}
                        </h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAddingQuestionForQuiz(quiz.id);
                            setNewQuestion({
                              questionText: "",
                              orderNum: (quizDetail?.questions?.length || 0) + 1,
                            });
                          }}
                        >
                          <Plus className="w-4 h-4 me-1" />
                          {isAr ? "سؤال جديد" : "New Question"}
                        </Button>
                      </div>

                      {/* Add Question Form */}
                      {addingQuestionForQuiz === quiz.id && (
                        <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
                            <div>
                              <Label>{isAr ? "نص السؤال" : "Question Text"}</Label>
                              <Textarea
                                value={newQuestion.questionText}
                                onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                                placeholder={isAr ? "أدخل السؤال هنا..." : "Enter question text..."}
                              />
                            </div>
                            <div>
                              <Label>{isAr ? "الترتيب" : "Order"}</Label>
                              <Input
                                type="number"
                                min={1}
                                value={newQuestion.orderNum}
                                onChange={(e) =>
                                  setNewQuestion({ ...newQuestion, orderNum: parseInt(e.target.value) || 1 })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => handleCreateQuestion(quiz.id)}
                              disabled={!newQuestion.questionText || createQuestion.isPending}
                            >
                              <Save className="w-4 h-4 me-1" />
                              {isAr ? "إضافة" : "Add"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setAddingQuestionForQuiz(null)}>
                              <X className="w-4 h-4 me-1" />
                              {isAr ? "إلغاء" : "Cancel"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Question List */}
                      {quizDetail?.questions?.length === 0 && (
                        <p className="text-center text-muted-foreground py-6 text-sm">
                          {isAr ? "لا توجد أسئلة بعد. أضف أول سؤال!" : "No questions yet. Add the first question!"}
                        </p>
                      )}

                      {quizDetail?.questions?.map((question, qIdx) => {
                        const isEditingQ = editingQuestionId === question.id;
                        const isAddingOpt = addingOptionForQuestion === question.id;

                        return (
                          <div
                            key={question.id}
                            className="border rounded-lg bg-white dark:bg-gray-900 overflow-hidden"
                          >
                            {/* Question Header */}
                            <div className="p-3 flex items-start gap-3">
                              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                                <GripVertical className="w-4 h-4" />
                                <span className="font-mono text-sm font-bold">{question.orderNum}</span>
                              </div>
                              <div className="flex-1">
                                {isEditingQ ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editQuestionData.questionText}
                                      onChange={(e) =>
                                        setEditQuestionData({
                                          ...editQuestionData,
                                          questionText: e.target.value,
                                        })
                                      }
                                    />
                                    <div className="flex items-center gap-2">
                                      <Label className="text-sm">{isAr ? "الترتيب:" : "Order:"}</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="w-20"
                                        value={editQuestionData.orderNum}
                                        onChange={(e) =>
                                          setEditQuestionData({
                                            ...editQuestionData,
                                            orderNum: parseInt(e.target.value) || 1,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateQuestion(question.id)}
                                        disabled={updateQuestion.isPending}
                                      >
                                        <Save className="w-3 h-3 me-1" />
                                        {isAr ? "حفظ" : "Save"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingQuestionId(null)}
                                      >
                                        <X className="w-3 h-3 me-1" />
                                        {isAr ? "إلغاء" : "Cancel"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="font-medium">{question.questionText}</p>
                                )}
                              </div>
                              {!isEditingQ && (
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingQuestionId(question.id);
                                      setEditQuestionData({
                                        questionText: question.questionText,
                                        orderNum: question.orderNum,
                                      });
                                    }}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteQuestion(question.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Options */}
                            <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-t">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {isAr ? "الخيارات" : "Options"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setAddingOptionForQuestion(question.id);
                                    setNewOption({
                                      optionId: nextOptionId(question.options),
                                      optionText: "",
                                      isCorrect: false,
                                    });
                                  }}
                                >
                                  <Plus className="w-3 h-3 me-1" />
                                  {isAr ? "خيار" : "Option"}
                                </Button>
                              </div>

                              {question.options.length === 0 && (
                                <p className="text-center text-xs text-muted-foreground py-2">
                                  {isAr ? "لا توجد خيارات" : "No options yet"}
                                </p>
                              )}

                              <div className="space-y-1.5">
                                {question.options.map((opt) => (
                                  <div
                                    key={opt.id}
                                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                                      opt.isCorrect
                                        ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                                        : "bg-white dark:bg-gray-900 border"
                                    }`}
                                  >
                                    <button
                                      className="shrink-0"
                                      title={isAr ? "تبديل الإجابة الصحيحة" : "Toggle correct answer"}
                                      onClick={() => toggleCorrectOption(opt)}
                                    >
                                      {opt.isCorrect ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-gray-400" />
                                      )}
                                    </button>
                                    <Badge
                                      variant="outline"
                                      className="font-mono font-bold text-xs min-w-[24px] justify-center"
                                    >
                                      {opt.optionId}
                                    </Badge>
                                    <span className="flex-1">{opt.optionText}</span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-red-500 hover:text-red-600"
                                      onClick={() => handleDeleteOption(opt.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              {/* Add Option Form */}
                              {isAddingOpt && (
                                <div className="mt-2 border rounded-md p-3 bg-white dark:bg-gray-900">
                                  <div className="flex gap-2 items-end">
                                    <div className="w-16">
                                      <Label className="text-xs">{isAr ? "الحرف" : "ID"}</Label>
                                      <Input
                                        value={newOption.optionId}
                                        maxLength={1}
                                        className="text-center font-mono font-bold"
                                        onChange={(e) =>
                                          setNewOption({
                                            ...newOption,
                                            optionId: e.target.value.toUpperCase(),
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <Label className="text-xs">{isAr ? "نص الخيار" : "Option Text"}</Label>
                                      <Input
                                        value={newOption.optionText}
                                        onChange={(e) => setNewOption({ ...newOption, optionText: e.target.value })}
                                        placeholder={isAr ? "أدخل الخيار..." : "Enter option text..."}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 pb-0.5">
                                      <Switch
                                        checked={newOption.isCorrect}
                                        onCheckedChange={(v) => setNewOption({ ...newOption, isCorrect: v })}
                                      />
                                      <span className="text-xs whitespace-nowrap">
                                        {isAr ? "صحيح" : "Correct"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleCreateOption(question.id)}
                                      disabled={!newOption.optionText || !newOption.optionId || createOption.isPending}
                                    >
                                      <Plus className="w-3 h-3 me-1" />
                                      {isAr ? "إضافة" : "Add"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setAddingOptionForQuestion(null)}
                                    >
                                      <X className="w-3 h-3 me-1" />
                                      {isAr ? "إلغاء" : "Cancel"}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
