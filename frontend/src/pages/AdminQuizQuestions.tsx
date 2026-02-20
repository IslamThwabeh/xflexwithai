import { useEffect, useState } from "react";
import { Link } from "wouter";
import { 
  BookOpen, Edit2, Save, X, ChevronDown, ChevronUp, 
  AlertCircle, CheckCircle, Plus, Trash2 
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface Option {
  id: number;
  optionText: string;
  isCorrect: boolean;
}

interface Question {
  id: number;
  quizId: number;
  level: number;
  questionText: string;
  options: Option[];
  correctRate?: number;
  totalAttempts?: number;
}

interface Quiz {
  id: number;
  level: number;
  title: string;
  questions: Question[];
}

export default function AdminQuizQuestions() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<number | null>(1);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await fetch("/api/admin/quiz/questions");
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      const data = await response.json();
      setQuizzes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (question: Question) => {
    setEditingQuestion(question.id);
    setEditForm(JSON.parse(JSON.stringify(question))); // Deep copy
  };

  const cancelEdit = () => {
    setEditingQuestion(null);
    setEditForm(null);
  };

  const updateQuestionText = (text: string) => {
    if (editForm) {
      setEditForm({ ...editForm, questionText: text });
    }
  };

  const updateOptionText = (optionId: number, text: string) => {
    if (editForm) {
      setEditForm({
        ...editForm,
        options: editForm.options.map((opt) =>
          opt.id === optionId ? { ...opt, optionText: text } : opt
        ),
      });
    }
  };

  const toggleCorrectOption = (optionId: number) => {
    if (editForm) {
      setEditForm({
        ...editForm,
        options: editForm.options.map((opt) =>
          opt.id === optionId
            ? { ...opt, isCorrect: !opt.isCorrect }
            : opt
        ),
      });
    }
  };

  const saveQuestion = async () => {
    if (!editForm) return;

    // Validation
    if (!editForm.questionText.trim()) {
      alert("Question text cannot be empty");
      return;
    }

    const hasEmptyOption = editForm.options.some((opt) => !opt.optionText.trim());
    if (hasEmptyOption) {
      alert("All options must have text");
      return;
    }

    const correctCount = editForm.options.filter((opt) => opt.isCorrect).length;
    if (correctCount === 0) {
      alert("At least one option must be marked as correct");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/quiz/questions/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: editForm.questionText,
          options: editForm.options.map((opt) => ({
            id: opt.id,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save question");
      }

      // Refresh data
      await fetchQuestions();
      setEditingQuestion(null);
      setEditForm(null);
      alert("Question updated successfully");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleLevel = (level: number) => {
    setExpandedLevel(expandedLevel === level ? null : level);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="bg-gray-50 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading questions...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-gray-50 flex items-center justify-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <p className="text-red-800 text-center">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Question Management</h1>
              <p className="text-gray-600">Edit quiz questions and answers</p>
            </div>
            <Link href="/admin/quiz">
              <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                Back to Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Editing Guidelines:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Each question must have at least one correct answer</li>
              <li>All option fields must be filled</li>
              <li>Changes are saved immediately to the database</li>
              <li>Question performance stats help identify problematic questions</li>
            </ul>
          </div>
        </div>

        {/* Quiz Levels */}
        <div className="space-y-4">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Level Header */}
              <button
                onClick={() => toggleLevel(quiz.level)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <h2 className="text-xl font-bold">Level {quiz.level}</h2>
                    <p className="text-gray-600">{quiz.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {quiz.questions.length} questions
                  </span>
                  {expandedLevel === quiz.level ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Questions List */}
              {expandedLevel === quiz.level && (
                <div className="border-t divide-y">
                  {quiz.questions.map((question, qIdx) => (
                    <div key={question.id} className="p-6">
                      {editingQuestion === question.id && editForm ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Question Text
                            </label>
                            <textarea
                              value={editForm.questionText}
                              onChange={(e) => updateQuestionText(e.target.value)}
                              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Answer Options (check correct answers)
                            </label>
                            <div className="space-y-3">
                              {editForm.options.map((option, optIdx) => (
                                <div key={option.id} className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    checked={option.isCorrect}
                                    onChange={() => toggleCorrectOption(option.id)}
                                    className="mt-3 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                  />
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      value={option.optionText}
                                      onChange={(e) =>
                                        updateOptionText(option.id, e.target.value)
                                      }
                                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder={`Option ${optIdx + 1}`}
                                    />
                                  </div>
                                  {option.isCorrect && (
                                    <CheckCircle className="w-5 h-5 text-green-500 mt-2" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-4">
                            <button
                              onClick={saveQuestion}
                              disabled={saving}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              {saving ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-500">
                                  Question {qIdx + 1}
                                </span>
                                {question.correctRate !== undefined && (
                                  <span
                                    className={`text-xs px-2 py-1 rounded ${
                                      question.correctRate >= 70
                                        ? "bg-green-100 text-green-800"
                                        : question.correctRate >= 50
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {question.correctRate}% correct rate
                                  </span>
                                )}
                              </div>
                              <p className="text-lg font-medium text-gray-900 mb-4">
                                {question.questionText}
                              </p>
                              <div className="space-y-2">
                                {question.options.map((option) => (
                                  <div
                                    key={option.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg ${
                                      option.isCorrect
                                        ? "bg-green-50 border border-green-200"
                                        : "bg-gray-50"
                                    }`}
                                  >
                                    {option.isCorrect && (
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                    )}
                                    <span className="text-gray-900">{option.optionText}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => startEdit(question)}
                              className="ml-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                          </div>

                          {question.totalAttempts !== undefined && question.totalAttempts > 0 && (
                            <div className="text-sm text-gray-600 mt-2">
                              Attempted {question.totalAttempts} times
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
