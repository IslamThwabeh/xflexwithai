import { useEffect, useState } from "react";
import { Link } from "wouter";
import { 
  BarChart3, Users, CheckCircle, XCircle, TrendingUp, 
  AlertCircle, BookOpen, Award, Activity 
} from "lucide-react";

interface QuizStats {
  totalAttempts: number;
  totalUsers: number;
  averageScore: number;
  passRate: number;
  levelStats: {
    level: number;
    title: string;
    attempts: number;
    avgScore: number;
    passRate: number;
    completionRate: number;
  }[];
  difficultQuestions: {
    questionId: number;
    questionText: string;
    level: number;
    correctRate: number;
    totalAttempts: number;
  }[];
  recentActivity: {
    userId: number;
    username: string;
    level: number;
    score: number;
    passed: boolean;
    completedAt: string;
  }[];
}

export default function AdminQuizDashboard() {
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/quiz/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }
      const data = await response.json();
      setStats(data);
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
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 text-center">{error || "Failed to load data"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Quiz Management Dashboard</h1>
          <p className="text-gray-600">Monitor quiz performance and student progress</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/quiz/users">
            <button className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-left">
              <Users className="w-8 h-8 text-blue-600 mb-2" />
              <h3 className="font-semibold text-lg">User Progress</h3>
              <p className="text-sm text-gray-600">View all students</p>
            </button>
          </Link>

          <Link href="/admin/quiz/questions">
            <button className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-left">
              <BookOpen className="w-8 h-8 text-purple-600 mb-2" />
              <h3 className="font-semibold text-lg">Manage Questions</h3>
              <p className="text-sm text-gray-600">Edit quiz content</p>
            </button>
          </Link>

          <Link href="/admin/quiz/analytics">
            <button className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-left">
              <BarChart3 className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="font-semibold text-lg">Analytics</h3>
              <p className="text-sm text-gray-600">Detailed reports</p>
            </button>
          </Link>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Attempts</span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalAttempts}</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Active Users</span>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-purple-600">{stats.totalUsers}</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Average Score</span>
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-yellow-600">{stats.averageScore}%</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Pass Rate</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.passRate}%</div>
          </div>
        </div>

        {/* Level Performance */}
        <div className="bg-white rounded-lg shadow-md mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Performance by Level</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.levelStats.map((level) => (
                  <tr key={level.level} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium">Level {level.level}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-900">{level.title}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-600">{level.attempts}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        level.avgScore >= 70 ? "text-green-600" :
                        level.avgScore >= 50 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {level.avgScore}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        level.passRate >= 70 ? "text-green-600" :
                        level.passRate >= 50 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {level.passRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${level.completionRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{level.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Difficult Questions */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold">Difficult Questions</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">Questions with lowest correct rate</p>
            </div>
            <div className="p-6">
              {stats.difficultQuestions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {stats.difficultQuestions.map((q) => (
                    <div key={q.questionId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500">Level {q.level}</span>
                        <span className={`text-sm font-bold ${
                          q.correctRate >= 50 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {q.correctRate}% correct
                        </span>
                      </div>
                      <p className="text-gray-900 mb-2">{q.questionText}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{q.totalAttempts} attempts</span>
                        <Link href={`/admin/quiz/questions/${q.questionId}`}>
                          <button className="text-blue-600 hover:underline">Edit Question</button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Recent Activity</h2>
              <p className="text-sm text-gray-600 mt-1">Latest quiz attempts</p>
            </div>
            <div className="p-6">
              {stats.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {activity.passed ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{activity.username}</p>
                          <p className="text-sm text-gray-600">Level {activity.level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          activity.passed ? "text-green-600" : "text-red-600"
                        }`}>
                          {activity.score}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
