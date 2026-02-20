import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, Trophy, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/apiBase";

interface QuizQuestion {
  id: number;
  questionText: string;
  orderNum: number;
  options: {
    id: number;
    optionId: string;
    text: string;
  }[];
}

interface Quiz {
  id: number;
  level: number;
  title: string;
  description: string;
  passingScore: number;
  questions: QuizQuestion[];
}

interface QuizResult {
  attemptId: number;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  detailedResults: {
    questionId: number;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
  }[];
}

export default function TakeQuiz() {
  const [, params] = useRoute("/quiz/:level");
  const [, setLocation] = useLocation();
  const level = parseInt(params?.level || "1");

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    fetchQuiz();
  }, [level]);

  const fetchQuiz = async () => {
    try {
      const response = await apiFetch(`/api/quiz/level/${level}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("هذا المستوى مقفل. أكمل المستوى السابق أولاً");
        }
        throw new Error("فشل في تحميل الاختبار");
      }
      const data = await response.json();
      setQuiz(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (quiz && currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    // Check if all questions are answered
    const unanswered = quiz.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      alert(`يرجى الإجابة على جميع الأسئلة. لم تجب على ${unanswered.length} سؤال`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          answers: Object.entries(answers).map(([questionId, optionId]) => ({
            questionId: parseInt(questionId),
            optionId
          }))
        })
      });

      if (!response.ok) {
        throw new Error("فشل في إرسال الإجابات");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentQuestion(0);
    setResult(null);
  };

  const handleBackToLevels = () => {
    setLocation("/quiz");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل الاختبار...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 text-center mb-4">{error}</p>
          <button
            onClick={handleBackToLevels}
            className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
          >
            العودة إلى المستويات
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  // Show results if quiz is submitted
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 py-8" dir="rtl">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Results Header */}
          <div className={`rounded-lg p-8 text-center mb-6 ${
            result.passed 
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
              : "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          }`}>
            {result.passed ? (
              <CheckCircle className="w-20 h-20 mx-auto mb-4" />
            ) : (
              <XCircle className="w-20 h-20 mx-auto mb-4" />
            )}
            
            <h1 className="text-3xl font-bold mb-2">
              {result.passed ? "مبروك! نجحت في الاختبار 🎉" : "للأسف، لم تنجح هذه المرة"}
            </h1>
            
            <div className="text-5xl font-bold my-6">
              {result.score}%
            </div>
            
            <p className="text-lg opacity-90">
              أجبت بشكل صحيح على {result.correctCount} من {result.totalQuestions} سؤال
            </p>
            
            {!result.passed && (
              <p className="mt-4 text-sm opacity-80">
                تحتاج إلى {result.passingScore}% للنجاح. حاول مرة أخرى!
              </p>
            )}
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">تفاصيل الإجابات</h2>
            
            <div className="space-y-4">
              {quiz.questions.map((question, index) => {
                const questionResult = result.detailedResults.find(r => r.questionId === question.id);
                const isCorrect = questionResult?.isCorrect;
                
                return (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 ${
                      isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                      )}
                      
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          السؤال {index + 1}: {question.questionText}
                        </p>
                        
                        <div className="space-y-1 text-sm">
                          {question.options.map(option => {
                            const isSelected = questionResult?.selectedOptionId === option.optionId;
                            const isCorrectOption = questionResult?.correctOptionId === option.optionId;
                            
                            return (
                              <div
                                key={option.id}
                                className={`p-2 rounded ${
                                  isCorrectOption
                                    ? "bg-green-100 text-green-800 font-medium"
                                    : isSelected
                                    ? "bg-red-100 text-red-800"
                                    : "text-gray-600"
                                }`}
                              >
                                {option.optionId}) {option.text}
                                {isCorrectOption && " ✓ (الإجابة الصحيحة)"}
                                {isSelected && !isCorrectOption && " ✗ (إجابتك)"}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleRetry}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              إعادة المحاولة
            </button>
            
            <button
              onClick={handleBackToLevels}
              className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700"
            >
              العودة إلى المستويات
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz questions
  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const allAnswered = quiz.questions.every(q => answers[q.id]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold">المستوى {quiz.level}: {quiz.title}</h1>
              <p className="text-sm text-gray-600">
                السؤال {currentQuestion + 1} من {quiz.questions.length}
              </p>
            </div>
            <button
              onClick={handleBackToLevels}
              className="text-gray-600 hover:text-gray-800"
            >
              إلغاء
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6">{question.questionText}</h2>
          
          <div className="space-y-3">
            {question.options.map(option => (
              <button
                key={option.id}
                onClick={() => handleAnswerSelect(question.id, option.optionId)}
                className={`w-full text-right p-4 rounded-lg border-2 transition-all ${
                  answers[question.id] === option.optionId
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{option.optionId})</span> {option.text}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-5 h-5" />
            السابق
          </button>

          {currentQuestion === quiz.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="flex items-center gap-2 px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  إنهاء الاختبار
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              التالي
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Answer Status */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {quiz.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(index)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                answers[q.id]
                  ? "bg-blue-600 text-white"
                  : index === currentQuestion
                  ? "bg-blue-100 text-blue-600 border-2 border-blue-600"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
