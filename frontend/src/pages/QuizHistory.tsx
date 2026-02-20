import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowRight, CheckCircle, XCircle, Calendar, Trophy } from "lucide-react";
import { apiFetch } from "@/lib/apiBase";

interface QuizAttempt {
  id: number;
  score: number;
  passed: boolean;
  completedAt: string;
}

export default function QuizHistory() {
  const [, params] = useRoute("/quiz/:level/history");
  const level = parseInt(params?.level || "1");

  const [history, setHistory] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHistory();
  }, [level]);

  const fetchHistory = async () => {
    try {
      const response = await apiFetch(`/api/quiz/history/${level}`);
      if (!response.ok) {
        throw new Error("فشل في تحميل السجل");
      }
      const data = await response.json();
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 text-center mb-4">{error}</p>
          <Link href="/quiz">
            <button className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
              العودة إلى المستويات
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const bestScore = Math.max(...history.map(h => h.score), 0);
  const passedAttempts = history.filter(h => h.passed).length;
  const avgScore = history.length > 0
    ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8" dir="rtl">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/quiz">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4">
              <ArrowRight className="w-5 h-5" />
              العودة إلى المستويات
            </button>
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">سجل المحاولات - المستوى {level}</h1>
          <p className="text-gray-600">جميع محاولاتك في هذا المستوى</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <span className="text-gray-600">أفضل نتيجة</span>
            </div>
            <div className="text-3xl font-bold text-yellow-600">{bestScore}%</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <span className="text-gray-600">محاولات ناجحة</span>
            </div>
            <div className="text-3xl font-bold text-green-600">
              {passedAttempts} / {history.length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-blue-500" />
              <span className="text-gray-600">المعدل</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{avgScore}%</div>
          </div>
        </div>

        {/* Attempts List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">جميع المحاولات ({history.length})</h2>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="mb-4">لم تقم بأي محاولة بعد</p>
              <Link href={`/quiz/${level}`}>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                  ابدأ الاختبار
                </button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {history.map((attempt, index) => (
                <div key={attempt.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {attempt.passed ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-500" />
                      )}
                      
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold">
                            المحاولة #{history.length - index}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            attempt.passed
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {attempt.passed ? "نجح" : "لم ينجح"}
                          </span>
                          {attempt.score === bestScore && (
                            <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                              أفضل نتيجة
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(attempt.completedAt).toLocaleString('ar-SA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className={`text-3xl font-bold ${
                        attempt.passed ? "text-green-600" : "text-red-600"
                      }`}>
                        {attempt.score}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <Link href={`/quiz/${level}`}>
            <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700">
              محاولة جديدة
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
