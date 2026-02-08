import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search, User, Trophy, Lock, Unlock, RefreshCw, Eye } from "lucide-react";

interface UserProgress {
  userId: number;
  username: string;
  email: string;
  totalAttempts: number;
  completedLevels: number;
  bestScores: { [level: number]: number };
  unlockedLevels: number[];
  lastActivity: string;
}

export default function AdminQuizUsers() {
  const [users, setUsers] = useState<UserProgress[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resetting, setResetting] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/quiz/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data);
      setFilteredUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetUserProgress = async (userId: number) => {
    if (!confirm("Are you sure you want to reset this user's quiz progress? This cannot be undone.")) {
      return;
    }

    setResetting(userId);
    try {
      const response = await fetch("/api/admin/quiz/reset-user-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset progress");
      }

      // Refresh data
      await fetchUsers();
      alert("User progress reset successfully");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setResetting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-800 text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">User Progress Monitoring</h1>
              <p className="text-gray-600">Track student quiz performance</p>
            </div>
            <Link href="/admin/quiz">
              <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                Back to Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by username or email..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 mb-2">Total Users</div>
            <div className="text-3xl font-bold text-blue-600">{users.length}</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 mb-2">Active Users</div>
            <div className="text-3xl font-bold text-green-600">
              {users.filter((u) => u.totalAttempts > 0).length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-600 mb-2">Completed All Levels</div>
            <div className="text-3xl font-bold text-purple-600">
              {users.filter((u) => u.completedLevels === 8).length}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">All Users ({filteredUsers.length})</h2>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {searchTerm ? "No users found matching your search" : "No users yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unlocked</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best Scores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900">{user.totalAttempts}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium">{user.completedLevels} / 8</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Unlock className="w-4 h-4 text-green-500" />
                          <span>{user.unlockedLevels.length} / 8</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(user.bestScores).map(([level, score]) => (
                            <span
                              key={level}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                score >= 70
                                  ? "bg-green-100 text-green-800"
                                  : score >= 50
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              L{level}: {score}%
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.lastActivity
                          ? new Date(user.lastActivity).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/quiz/user/${user.userId}`}>
                            <button
                              className="text-blue-600 hover:text-blue-800"
                              title="View Details"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </Link>
                          <button
                            onClick={() => resetUserProgress(user.userId)}
                            disabled={resetting === user.userId}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            title="Reset Progress"
                          >
                            {resetting === user.userId ? (
                              <div className="animate-spin">
                                <RefreshCw className="w-5 h-5" />
                              </div>
                            ) : (
                              <RefreshCw className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
