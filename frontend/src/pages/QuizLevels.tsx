import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Lock, CheckCircle, Circle, Trophy, Clock } from "lucide-react";
import { apiFetch } from "@/lib/apiBase";

interface LevelProgress {
  level: number;
  title: string;
  description: string;
  passingScore: number;
  isUnlocked: boolean;
  isPassed: boolean;
  bestScore: number;
  lastAttemptAt: string | null;
}

export default function QuizLevels() {
  const [progress, setProgress] = useState<LevelProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await apiFetch("/api/quiz/progress");
      if (!response.ok) {
        throw new Error("Failed to fetch progress");
      }
      const data = await response.json();
      setProgress(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getLevelStatus = (level: LevelProgress) => {
    if (level.isPassed) {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-500" />,
        badge: "مكتمل",
        badgeColor: "bg-green-100 text-green-800",
        canAccess: true
      };
    } else if (level.isUnlocked) {
      return {
        icon: <Circle className="w-6 h-6 text-blue-500" />,
        badge: "متاح",
        badgeColor: "bg-blue-100 text-blue-800",
        canAccess: true
      };
    } else {
      return {
        icon: <Lock className="w-6 h-6 text-gray-400" />,
        badge: "مقفل",
        badgeColor: "bg-gray-100 text-gray-600",
        canAccess: false
      };
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 text-center">{error}</p>
          <button
            onClick={fetchProgress}
            className="mt-4 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const completedLevels = progress.filter(p => p.isPassed).length;
  const totalLevels = progress.length;
  const overallProgress = (completedLevels / totalLevels) * 100;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">اختبارات الدورة التعليمية</h1>
          <p className="text-blue-100">أكمل جميع المستويات لإتقان التداول</p>
          
          {/* Overall Progress */}
          <div className="mt-6 bg-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">التقدم الإجمالي</span>
              <span className="text-sm font-bold">{completedLevels} / {totalLevels}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white rounded-full h-3 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Levels Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {progress.map((level) => {
            const status = getLevelStatus(level);
            
            return (
              <div
                key={level.level}
                className={`bg-white rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg ${
                  !status.canAccess ? "opacity-60" : ""
                }`}
              >
                {/* Level Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {status.icon}
                      <span className="text-2xl font-bold">المستوى {level.level}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.badgeColor}`}>
                      {status.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold">{level.title}</h3>
                </div>

                {/* Level Body */}
                <div className="p-4">
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {level.description}
                  </p>

                  {/* Stats */}
                  <div className="space-y-2 mb-4">
                    {level.bestScore > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          أفضل نتيجة
                        </span>
                        <span className={`font-bold ${level.isPassed ? "text-green-600" : "text-orange-600"}`}>
                          {level.bestScore}%
                        </span>
                      </div>
                    )}
                    
                    {level.lastAttemptAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          آخر محاولة
                        </span>
                        <span className="text-gray-800">
                          {new Date(level.lastAttemptAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">درجة النجاح</span>
                      <span className="text-gray-800 font-medium">{level.passingScore}%</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  {status.canAccess ? (
                    <Link href={`/quiz/${level.level}`}>
                      <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        {level.isPassed ? "إعادة الاختبار" : level.bestScore > 0 ? "المحاولة مجددًا" : "ابدأ الاختبار"}
                      </button>
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      أكمل المستوى السابق أولاً
                    </button>
                  )}

                  {/* View History */}
                  {level.bestScore > 0 && (
                    <Link href={`/quiz/${level.level}/history`}>
                      <button className="w-full mt-2 text-blue-600 text-sm py-2 hover:bg-blue-50 rounded-lg transition-colors">
                        عرض سجل المحاولات
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Message */}
        {completedLevels === totalLevels && (
          <div className="mt-8 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-6 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">مبروك! 🎉</h2>
            <p className="text-green-100">
              لقد أكملت جميع المستويات بنجاح! أنت الآن متداول محترف!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
