import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  BookOpen, 
  GraduationCap, 
  Play, 
  CheckCircle2, 
  Lock, 
  ArrowLeft,
  ChevronRight 
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type EpisodeQuizAnswer = {
  questionId: number;
  optionId: string;
};

export default function CourseWatch() {
  const [, params] = useRoute("/course/:courseId");
  const courseId = params?.courseId ? parseInt(params.courseId) : null;

  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: course, isLoading: courseLoading } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: !!courseId }
  );

  const { data: episodes, isLoading: episodesLoading } = trpc.episodes.listByCourse.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId }
  );

  const { data: enrollment } = trpc.enrollments.getEnrollment.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && isAuthenticated }
  );

  const { data: courseEpisodeProgress = [] } = trpc.episodeProgress.getCourse.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId && isAuthenticated }
  );

  const markCompleteMutation = trpc.enrollments.markEpisodeComplete.useMutation({
    onSuccess: () => {
      toast.success("Episode marked as complete!");
      utils.enrollments.getEnrollment.invalidate();
      utils.enrollments.myEnrollments.invalidate();
      utils.episodeProgress.getCourse.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Unable to mark episode complete");
    },
  });

  const updateEpisodeProgressMutation = trpc.episodeProgress.updateProgress.useMutation();

  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    passingScore: number;
  } | null>(null);
  const lastSyncedSecondRef = useRef<number>(0);

  const isLoading = courseLoading || episodesLoading;

  const { data: episodeQuiz, isLoading: loadingEpisodeQuiz } = trpc.episodeQuiz.getForEpisode.useQuery(
    { courseId: courseId!, episodeId: selectedEpisode?.id ?? 0 },
    { enabled: !!courseId && !!selectedEpisode }
  );

  const submitEpisodeQuizMutation = trpc.episodeQuiz.submitForEpisode.useMutation({
    onSuccess: (result) => {
      setQuizResult({
        score: result.score,
        passed: result.passed,
        correctCount: result.correctCount,
        totalQuestions: result.totalQuestions,
        passingScore: result.passingScore,
      });

      if (result.passed) {
        toast.success(`Quiz passed (${result.score}%)`);
      } else {
        toast.error(`Quiz not passed (${result.score}%). Required: ${result.passingScore}%`);
      }

      utils.episodeQuiz.getForEpisode.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit quiz");
    },
  });

  // Auto-select first episode or last accessed
  useEffect(() => {
    if (episodes && episodes.length > 0 && !selectedEpisode) {
      const sortedEpisodes = [...episodes].sort((a, b) => a.order - b.order);
      setSelectedEpisode(sortedEpisodes[0]);
    }
  }, [episodes, selectedEpisode]);

  useEffect(() => {
    setQuizAnswers({});
    setQuizResult(null);
    lastSyncedSecondRef.current = 0;
  }, [selectedEpisode?.id]);

  const selectedEpisodeProgress = useMemo(() => {
    if (!selectedEpisode) return undefined;
    return courseEpisodeProgress.find((progress) => progress.episodeId === selectedEpisode.id);
  }, [courseEpisodeProgress, selectedEpisode]);

  const watchedSeconds = selectedEpisodeProgress?.watchedDuration || 0;
  const requiredWatchSeconds = selectedEpisode?.duration && selectedEpisode.duration > 0
    ? Math.max(60, Math.floor(selectedEpisode.duration * 60 * 0.7))
    : 60;
  const hasWatchRequirementMet = watchedSeconds >= requiredWatchSeconds;

  const quizRequired = !!episodeQuiz?.required;
  const quizPassed = !!episodeQuiz?.passed;
  const canMarkComplete = selectedEpisode?.order <= 1
    ? hasWatchRequirementMet
    : hasWatchRequirementMet && (!quizRequired || quizPassed);

  const handleVideoProgress = (currentTime: number) => {
    if (!selectedEpisode || !courseId) return;
    const second = Math.floor(currentTime || 0);
    if (second <= 0) return;

    if (second - lastSyncedSecondRef.current < 10) {
      return;
    }

    lastSyncedSecondRef.current = second;
    updateEpisodeProgressMutation.mutate({
      episodeId: selectedEpisode.id,
      courseId,
      watchedDuration: second,
      isCompleted: false,
    });
  };

  const handleEpisodeComplete = () => {
    if (!selectedEpisode || !courseId) return;
    markCompleteMutation.mutate({
      courseId,
      episodeId: selectedEpisode.id,
    });
  };

  const handleNextEpisode = () => {
    if (!episodes || !selectedEpisode) return;
    const sortedEpisodes = [...episodes].sort((a, b) => a.order - b.order);
    const currentIndex = sortedEpisodes.findIndex(e => e.id === selectedEpisode.id);
    if (currentIndex < sortedEpisodes.length - 1) {
      setSelectedEpisode(sortedEpisodes[currentIndex + 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleQuizAnswerSelect = (questionId: number, optionId: string) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmitEpisodeQuiz = () => {
    if (!selectedEpisode || !courseId || !episodeQuiz?.quiz) return;

    const unanswered = episodeQuiz.quiz.questions.filter(
      (question) => !quizAnswers[question.id]
    );
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} left)`);
      return;
    }

    const answers: EpisodeQuizAnswer[] = episodeQuiz.quiz.questions.map((question) => ({
      questionId: question.id,
      optionId: quizAnswers[question.id],
    }));

    submitEpisodeQuizMutation.mutate({
      courseId,
      episodeId: selectedEpisode.id,
      answers,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Course not found</h3>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-16 w-16 mx-auto text-blue-600 mb-4" />
            <CardTitle className="text-2xl">Sign in required</CardTitle>
            <CardDescription>
              Please sign in to access this course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full" size="lg">
                Sign In to Continue
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-16 w-16 mx-auto text-blue-600 mb-4" />
            <CardTitle className="text-2xl">Enrollment required</CardTitle>
            <CardDescription>
              You need to enroll in this course to access the content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">${course.price}</p>
              <p className="text-sm text-muted-foreground">One-time payment</p>
            </div>
            <Button className="w-full" size="lg">
              Enroll Now
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedEpisodes = episodes ? [...episodes].sort((a, b) => a.order - b.order) : [];
  const progress = enrollment.progressPercentage || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Progress: </span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Video Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <Card>
              <CardContent className="p-0">
                {selectedEpisode?.videoUrl ? (
                  <div className="aspect-video bg-black">
                    {selectedEpisode.videoUrl.includes('youtube.com') || selectedEpisode.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={selectedEpisode.videoUrl.replace('watch?v=', 'embed/')}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={selectedEpisode.videoUrl}
                        controls
                        className="w-full h-full"
                        onTimeUpdate={(event) => handleVideoProgress(event.currentTarget.currentTime)}
                        onEnded={(event) => {
                          if (!selectedEpisode || !courseId) return;
                          updateEpisodeProgressMutation.mutate({
                            episodeId: selectedEpisode.id,
                            courseId,
                            watchedDuration: Math.max(requiredWatchSeconds, Math.floor(event.currentTarget.duration || 0)),
                            isCompleted: false,
                          });
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Play className="h-24 w-24 text-white opacity-50" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Episode Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Episode {selectedEpisode?.order}</Badge>
                      {selectedEpisode?.isFree && (
                        <Badge className="bg-green-500">FREE</Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{selectedEpisode?.titleEn}</CardTitle>
                    <CardDescription className="mt-2">
                      {selectedEpisode?.descriptionEn}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button onClick={handleEpisodeComplete} disabled={markCompleteMutation.isPending || !canMarkComplete}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </Button>
                  <Button variant="outline" onClick={handleNextEpisode}>
                    Next Episode
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Watch progress: {Math.min(watchedSeconds, requiredWatchSeconds)}s / {requiredWatchSeconds}s required
                </p>
              </CardContent>
            </Card>

            {/* Episode Quiz */}
            {selectedEpisode && selectedEpisode.order > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Episode Quiz</CardTitle>
                  <CardDescription>
                    Pass at least 50% to unlock completion for this episode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingEpisodeQuiz ? (
                    <p className="text-sm text-muted-foreground">Loading quiz...</p>
                  ) : !episodeQuiz?.quiz ? (
                    <p className="text-sm text-muted-foreground">
                      Quiz is not configured for this episode yet.
                    </p>
                  ) : episodeQuiz.passed ? (
                    <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      Quiz passed. You can now mark this episode as complete.
                    </div>
                  ) : (
                    <>
                      {episodeQuiz.quiz.questions.map((question, questionIndex) => (
                        <div key={question.id} className="rounded border p-4">
                          <p className="font-medium mb-3">
                            {questionIndex + 1}. {question.questionText}
                          </p>
                          <div className="space-y-2">
                            {question.options.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => handleQuizAnswerSelect(question.id, option.optionId)}
                                className={`w-full text-left rounded border px-3 py-2 text-sm transition-colors ${
                                  quizAnswers[question.id] === option.optionId
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <span className="font-medium mr-2">{option.optionId.toUpperCase()}.</span>
                                {option.text}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <Button
                        onClick={handleSubmitEpisodeQuiz}
                        disabled={submitEpisodeQuizMutation.isPending}
                      >
                        Submit Quiz
                      </Button>

                      {quizResult && (
                        <div
                          className={`rounded border p-3 text-sm ${
                            quizResult.passed
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-orange-200 bg-orange-50 text-orange-700"
                          }`}
                        >
                          Score: {quizResult.score}% ({quizResult.correctCount}/{quizResult.totalQuestions})
                          {!quizResult.passed && ` - Required: ${quizResult.passingScore}%`}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Course Description */}
            <Card>
              <CardHeader>
                <CardTitle>About this course</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{course.descriptionEn}</p>
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Level: </span>
                    <span className="font-semibold capitalize">{course.level}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Episodes: </span>
                    <span className="font-semibold">{sortedEpisodes.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Episode List */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Progress</CardTitle>
                <CardDescription>
                  {enrollment.completedEpisodes} of {sortedEpisodes.length} episodes completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Episodes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sortedEpisodes.map((episode) => {
                    const isSelected = selectedEpisode?.id === episode.id;
                    const isCompleted = !!courseEpisodeProgress.find((progress) => progress.episodeId === episode.id)?.isCompleted;
                    
                    return (
                      <button
                        key={episode.id}
                        onClick={() => setSelectedEpisode(episode)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span className="text-sm font-semibold">{episode.order}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm line-clamp-2">{episode.titleEn}</h4>
                              {episode.isFree && (
                                <Badge variant="outline" className="text-xs">FREE</Badge>
                              )}
                            </div>
                            {episode.duration && (
                              <p className="text-xs text-muted-foreground">{episode.duration} min</p>
                            )}
                          </div>
                          {isSelected && (
                            <Play className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
