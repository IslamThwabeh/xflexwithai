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
  ChevronRight 
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ClientLayout from "@/components/ClientLayout";
import { useLanguage } from "@/contexts/LanguageContext";

type EpisodeQuizAnswer = {
  questionId: number;
  optionId: string;
};

export default function CourseWatch() {
  const [, params] = useRoute("/course/:courseId");
  const courseId = params?.courseId ? parseInt(params.courseId) : null;

  const { user, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();

  const { data: course, isLoading: courseLoading } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: !!courseId }
  );

  const { data: episodes, isLoading: episodesLoading } = trpc.episodes.listByCourse.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId }
  );
  const sortedEpisodes = useMemo(() => (episodes ? [...episodes].sort((a, b) => a.order - b.order) : []), [episodes]);

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
      toast.success(t('course.toastCompleted'));
      utils.enrollments.getEnrollment.invalidate();
      utils.enrollments.myEnrollments.invalidate();
      utils.episodeProgress.getCourse.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('course.toastCompleteFail'));
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
        toast.success(`${t('course.score')}: ${result.score}%`);
      } else {
        toast.error(`${t('course.score')}: ${result.score}% — ${t('course.requiredScore')}: ${result.passingScore}%`);
      }

      utils.episodeQuiz.getForEpisode.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('course.toastCompleteFail'));
    },
  });

  // Auto-select first episode or last accessed
  useEffect(() => {
    if (sortedEpisodes.length > 0 && !selectedEpisode) {
      setSelectedEpisode(sortedEpisodes[0]);
    }
  }, [sortedEpisodes, selectedEpisode]);

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
  const completedEpisodeIds = useMemo(
    () => new Set(courseEpisodeProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)),
    [courseEpisodeProgress]
  );

  const isEpisodeUnlocked = (episode: any) => {
    if (!episode) return false;
    if (episode.order <= 1) return true;
    const previousEpisode = sortedEpisodes.find((item) => item.order === episode.order - 1);
    if (!previousEpisode) return false;
    return completedEpisodeIds.has(previousEpisode.id);
  };

  const currentEpisodeIndex = selectedEpisode
    ? sortedEpisodes.findIndex((episode) => episode.id === selectedEpisode.id)
    : -1;
  const nextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < sortedEpisodes.length - 1
    ? sortedEpisodes[currentEpisodeIndex + 1]
    : null;
  const canGoToNextEpisode = !!nextEpisode && isEpisodeUnlocked(nextEpisode);
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
    if (!selectedEpisode || !nextEpisode) return;
    if (!isEpisodeUnlocked(nextEpisode)) {
      toast.error(t('course.toastUnlockPrev'));
      return;
    }

    setSelectedEpisode(nextEpisode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      toast.error(`${t('course.toastAnswerAll')} (${unanswered.length})`);
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
          <p className="text-muted-foreground">{t('course.loading')}</p>
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
            <h3 className="text-lg font-semibold mb-2">{t('course.notFound')}</h3>
            <Link href="/">
              <Button>{t('course.backHome')}</Button>
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
            <CardTitle className="text-2xl">{t('course.signInRequired')}</CardTitle>
            <CardDescription>
              {t('course.signInToAccess')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full" size="lg">
                {t('course.signInBtn')}
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
            <CardTitle className="text-2xl">{t('course.enrollRequired')}</CardTitle>
            <CardDescription>
              {t('course.enrollDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">${course.price}</p>
              <p className="text-sm text-muted-foreground">{t('course.oneTimePayment')}</p>
            </div>
            <Button className="w-full" size="lg">
              {t('course.enrollNow')}
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full">
                {t('course.backHome')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = enrollment.progressPercentage || 0;

  return (
    <ClientLayout
      subHeader={
        <div className="border-t bg-white/60 px-4 py-2">
          <div className="container mx-auto flex items-center justify-between text-sm">
            <span className="font-medium truncate">{language === 'ar' ? (course.titleAr || course.titleEn) : (course.titleEn || course.titleAr)}</span>
            <span className="text-muted-foreground">{t('course.progress')}: <span className="font-semibold text-foreground">{progress}%</span></span>
          </div>
        </div>
      }
    >
    <div className="min-h-[calc(100vh-100px)] bg-gray-50">
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
                      <Badge variant="outline">{t('course.episode')} {selectedEpisode?.order}</Badge>
                      {selectedEpisode?.isFree && (
                        <Badge className="bg-green-500">{t('course.free')}</Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{language === 'ar' ? (selectedEpisode?.titleAr || selectedEpisode?.titleEn) : (selectedEpisode?.titleEn || selectedEpisode?.titleAr)}</CardTitle>
                    <CardDescription className="mt-2">
                      {language === 'ar' ? (selectedEpisode?.descriptionAr || selectedEpisode?.descriptionEn) : (selectedEpisode?.descriptionEn || selectedEpisode?.descriptionAr)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button onClick={handleEpisodeComplete} disabled={markCompleteMutation.isPending || !canMarkComplete}>
                    <CheckCircle2 className="h-4 w-4 me-2" />
                    {t('course.markComplete')}
                  </Button>
                  <Button variant="outline" onClick={handleNextEpisode} disabled={!canGoToNextEpisode}>
                    {t('course.nextEpisode')}
                    <ChevronRight className="h-4 w-4 ms-2" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t('course.watchProgress')}: {Math.min(watchedSeconds, requiredWatchSeconds)}s / {requiredWatchSeconds}s {t('course.required')}
                </p>
              </CardContent>
            </Card>

            {/* Episode Quiz */}
            {selectedEpisode && selectedEpisode.order > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('course.episodeQuiz')}</CardTitle>
                  <CardDescription>
                    {t('course.quizDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingEpisodeQuiz ? (
                    <p className="text-sm text-muted-foreground">{t('course.loadingQuiz')}</p>
                  ) : !episodeQuiz?.quiz ? (
                    <p className="text-sm text-muted-foreground">
                      {t('course.noQuiz')}
                    </p>
                  ) : episodeQuiz.passed ? (
                    <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      {t('course.quizPassed')}
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
                        {t('course.submitQuiz')}
                      </Button>

                      {quizResult && (
                        <div
                          className={`rounded border p-3 text-sm ${
                            quizResult.passed
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-orange-200 bg-orange-50 text-orange-700"
                          }`}
                        >
                          {t('course.score')}: {quizResult.score}% ({quizResult.correctCount}/{quizResult.totalQuestions})
                          {!quizResult.passed && ` - ${t('course.requiredScore')}: ${quizResult.passingScore}%`}
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
                <CardTitle>{t('course.aboutCourse')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{language === 'ar' ? (course.descriptionAr || course.descriptionEn) : (course.descriptionEn || course.descriptionAr)}</p>
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('course.level')}: </span>
                    <span className="font-semibold capitalize">{course.level}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('course.episodes')}: </span>
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
                <CardTitle>{t('course.courseProgress')}</CardTitle>
                <CardDescription>
                  {enrollment.completedEpisodes} {t('course.ofEpisodes')} {sortedEpisodes.length} {t('course.episodesCompleted')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">{progress}% {t('course.percentComplete')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('course.episodes')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sortedEpisodes.map((episode) => {
                    const isSelected = selectedEpisode?.id === episode.id;
                    const isCompleted = !!courseEpisodeProgress.find((progress) => progress.episodeId === episode.id)?.isCompleted;
                    const isUnlocked = isEpisodeUnlocked(episode);
                    
                    return (
                      <button
                        key={episode.id}
                        onClick={() => {
                          if (!isUnlocked) {
                            toast.error(t('course.toastUnlockPrev'));
                            return;
                          }
                          setSelectedEpisode(episode);
                        }}
                        disabled={!isUnlocked}
                        className={`w-full text-left p-4 transition-colors ${
                          isUnlocked ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed bg-gray-50'
                        } ${
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
                              <h4 className="font-medium text-sm line-clamp-2">{language === 'ar' ? (episode.titleAr || episode.titleEn) : (episode.titleEn || episode.titleAr)}</h4>
                              {episode.isFree && (
                                <Badge variant="outline" className="text-xs">{t('course.free')}</Badge>
                              )}
                            </div>
                            {episode.duration && (
                              <p className="text-xs text-muted-foreground">{episode.duration} {t('course.min')}</p>
                            )}
                          </div>
                          {isSelected && (
                            <Play className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                          {!isUnlocked && (
                            <Lock className="h-4 w-4 text-gray-400 flex-shrink-0" />
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
    </ClientLayout>
  );
}
