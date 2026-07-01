import { useAuth } from "@/_core/hooks/useAuth";
import { useEngagementTracker } from "@/_core/hooks/useEngagementTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_TITLE, getLoginUrl } from "@/const";
import { formatPendingActivationDate, getPendingActivationDaysLeft, getPendingActivationWindow } from "@/lib/pendingActivation";
import { trpc } from "@/lib/trpc";
import { 
  BookOpen, 
  GraduationCap, 
  Play, 
  CheckCircle2, 
  Lock, 
  ChevronRight,
  Zap,
  AlertCircle,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  const { track } = useEngagementTracker();

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
    onSuccess: (data) => {
      track({
        eventType: "lesson_complete",
        entityType: "course",
        entityId: courseId ?? undefined,
        metadata: {
          courseId,
          episodeId: selectedEpisode?.id,
          reachedHalfway: !!data?.reachedHalfway,
        },
      });
      toast.success(t('course.toastCompleted'));
      utils.enrollments.getEnrollment.invalidate();
      utils.enrollments.myEnrollments.invalidate();
      utils.episodeProgress.getCourse.invalidate();
      // Show activation dialog if student just reached 50% and has pending subscriptions
      if (data?.reachedHalfway) {
        utils.subscriptions.activationStatus.invalidate();
        // Small delay so the invalidation resolves first
        setTimeout(() => setShowActivationDialog(true), 400);
      }
    },
    onError: (error) => {
      toast.error(error.message || t('course.toastCompleteFail'));
    },
  });

  const activateNowMutation = trpc.subscriptions.activateNow.useMutation({
    onSuccess: () => {
      toast.success(t('activation.activated'));
      setShowActivationDialog(false);
      utils.subscriptions.activationStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { data: activationStatus } = trpc.subscriptions.activationStatus.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

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
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [confirmNextEpisode, setConfirmNextEpisode] = useState<any | null>(null);
  const [confirmQuizBypass, setConfirmQuizBypass] = useState(false);
  const lastSyncedSecondRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoCompletedEpisodeIdsRef = useRef<Set<number>>(new Set());
  const [liveWatchedSeconds, setLiveWatchedSeconds] = useState(0);

  const isLoading = courseLoading || episodesLoading;

  const { data: episodeQuiz, isLoading: loadingEpisodeQuiz, error: episodeQuizError } = trpc.episodeQuiz.getForEpisode.useQuery(
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

      track({
        eventType: "quiz_attempt",
        entityType: "episode_quiz",
        entityId: selectedEpisode?.id,
        metadata: {
          courseId,
          episodeId: selectedEpisode?.id,
          passed: result.passed,
          score: result.score,
        },
      });

      utils.episodeQuiz.getForEpisode.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t('course.toastCompleteFail'));
    },
  });

  const bypassEpisodeQuizMutation = trpc.episodeQuiz.bypassForEpisode.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar'
        ? 'تم تخطي اختبار المستوى بناءً على تأكيدك. يمكنك المتابعة الآن.'
        : 'Level quiz bypass confirmed. You can continue now.');
      setConfirmQuizBypass(false);
      setQuizResult(null);
      utils.episodeQuiz.getForEpisode.invalidate();
      utils.userQuiz.progress.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || (language === 'ar'
        ? 'تعذر تخطي اختبار المستوى.'
        : 'Could not bypass this level quiz.'));
    },
  });

  // Auto-select first episode or last accessed
  useEffect(() => {
    if (sortedEpisodes.length > 0 && !selectedEpisode) {
      setSelectedEpisode(sortedEpisodes[0]);
    }
  }, [sortedEpisodes, selectedEpisode]);

  useEffect(() => {
    if (!isAuthenticated || !courseId || !course?.id) return;

    const courseTitle = language === "ar" ? course.titleAr : course.titleEn;

    track({
      eventType: "course_start",
      entityType: "course",
      entityId: courseId,
      metadata: {
        courseId,
        courseTitle,
      },
    });
  }, [course?.id, course?.titleAr, course?.titleEn, courseId, isAuthenticated, language, track]);

  useEffect(() => {
    setQuizAnswers({});
    setQuizResult(null);
    lastSyncedSecondRef.current = 0;
    setLiveWatchedSeconds(0);
  }, [selectedEpisode?.id]);

  const selectedEpisodeProgress = useMemo(() => {
    if (!selectedEpisode) return undefined;
    return courseEpisodeProgress.find((progress) => progress.episodeId === selectedEpisode.id);
  }, [courseEpisodeProgress, selectedEpisode]);

  const watchedSeconds = selectedEpisodeProgress?.watchedDuration || 0;
  useEffect(() => {
    setLiveWatchedSeconds((current) => Math.max(current, watchedSeconds));
  }, [watchedSeconds]);

  const effectiveWatchedSeconds = Math.max(watchedSeconds, liveWatchedSeconds);
  const completedEpisodeIds = useMemo(
    () => new Set(courseEpisodeProgress.filter((progress) => progress.isCompleted).map((progress) => progress.episodeId)),
    [courseEpisodeProgress]
  );
  const getRequiredWatchSeconds = (episode: any) => (
    episode?.duration && episode.duration > 0
      ? Math.max(30, Math.floor(episode.duration * 0.1))
      : 30
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
  const requiredWatchSeconds = getRequiredWatchSeconds(selectedEpisode);
  const requiredWatchMinutes = Math.max(1, Math.ceil(requiredWatchSeconds / 60));
  const hasWatchRequirementMet = effectiveWatchedSeconds >= requiredWatchSeconds;
  const isArabic = language === 'ar';
  const { studyPeriodDays, entitlementDays } = getPendingActivationWindow(activationStatus);
  const activationDeadline = formatPendingActivationDate(activationStatus?.maxActivationDate, isArabic);
  const activationDaysLeft = getPendingActivationDaysLeft(activationStatus?.maxActivationDate);

  const episodeAccessBlocked = !!episodeQuiz?.blocked;
  const quizLoadFailed = !!episodeQuizError;
  const quizRequired = !!episodeQuiz?.required;
  const quizPassed = !!episodeQuiz?.passed;
  const quizBypassed = !!episodeQuiz?.bypassed;
  const quizCleared = !!episodeQuiz?.cleared || quizPassed || quizBypassed;
  const quizLockedByWatch = !!episodeQuiz?.lockedByWatch;
  const showLevelQuizCard = !!selectedEpisode
    && !loadingEpisodeQuiz
    && (!!episodeQuiz?.levelInfo?.isLevelEnd || episodeAccessBlocked || quizLoadFailed);
  const previousEpisodeBlock = episodeQuiz?.previousEpisode;
  const previousRequirement = episodeQuiz?.previousRequirement;
  const blockedPreviousEpisode = previousEpisodeBlock
    ? sortedEpisodes.find((episode) => episode.id === previousEpisodeBlock.id)
    : null;
  const getEpisodeTitle = useCallback((episode: any) => (
    language === 'ar'
      ? (episode?.titleAr || episode?.titleEn || '')
      : (episode?.titleEn || episode?.titleAr || '')
  ), [language]);
  const blockedPreviousTitle = getEpisodeTitle(blockedPreviousEpisode || previousEpisodeBlock);
  const blockedMessage = episodeAccessBlocked
    ? previousRequirement?.quizRequired && !previousRequirement?.quizPassed
      ? (language === 'ar'
        ? `أكمل اختبار الحلقة السابقة أولاً${blockedPreviousTitle ? `: ${blockedPreviousTitle}` : ''}${previousRequirement.quizTitle ? ` - ${previousRequirement.quizTitle}` : ''}.`
        : `Complete the previous episode quiz first${blockedPreviousTitle ? `: ${blockedPreviousTitle}` : ''}${previousRequirement.quizTitle ? ` - ${previousRequirement.quizTitle}` : ''}.`)
      : (language === 'ar'
        ? `شاهد المزيد من الحلقة السابقة أولاً${blockedPreviousTitle ? `: ${blockedPreviousTitle}` : ''}.`
        : `Watch more of the previous episode first${blockedPreviousTitle ? `: ${blockedPreviousTitle}` : ''}.`)
    : null;
  const canMarkComplete = selectedEpisode?.order <= 1
    ? hasWatchRequirementMet
    : hasWatchRequirementMet && !loadingEpisodeQuiz && !episodeAccessBlocked && !quizLoadFailed && (!quizRequired || quizCleared);
  const canConfirmSelectedEpisodeWatch = !!selectedEpisode
    && !!nextEpisode
    && !selectedEpisodeProgress?.isCompleted
    && !loadingEpisodeQuiz
    && !episodeAccessBlocked
    && !quizLoadFailed
    && (!quizRequired || quizCleared);

  const quizSectionRef = useRef<HTMLDivElement>(null);

  const markSelectedEpisodeComplete = useCallback(async (studentConfirmedWatch = false) => {
    if (!selectedEpisode || !courseId) return false;
    await markCompleteMutation.mutateAsync({
      courseId,
      episodeId: selectedEpisode.id,
      watchedDuration: effectiveWatchedSeconds,
      studentConfirmedWatch,
    });
    return true;
  }, [selectedEpisode, courseId, effectiveWatchedSeconds, markCompleteMutation]);

  const handleEpisodeComplete = useCallback(() => {
    void markSelectedEpisodeComplete(false);
  }, [markSelectedEpisodeComplete]);

  useEffect(() => {
    if (!selectedEpisode || !courseId || selectedEpisodeProgress?.isCompleted) return;
    if (!canMarkComplete || autoCompletedEpisodeIdsRef.current.has(selectedEpisode.id)) return;

    autoCompletedEpisodeIdsRef.current.add(selectedEpisode.id);
    markCompleteMutation.mutate({
      courseId,
      episodeId: selectedEpisode.id,
      watchedDuration: effectiveWatchedSeconds,
    });
  }, [canMarkComplete, courseId, effectiveWatchedSeconds, markCompleteMutation, selectedEpisode, selectedEpisodeProgress?.isCompleted]);

  const handleMarkCompleteClick = useCallback(() => {
    if (canMarkComplete) {
      handleEpisodeComplete();
      return;
    }
    if (!hasWatchRequirementMet) {
      toast.info(
        t('course.toastWatchRequirement').replace('{minutes}', String(requiredWatchMinutes))
      );
      return;
    }
    if (quizRequired && !quizCleared) {
      toast.info(
        language === 'ar'
          ? 'يجب إتمام اختبار المستوى أو تأكيد التخطي أولاً'
          : 'Complete or confirm bypass for the level quiz first'
      );
      quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (episodeAccessBlocked) {
      toast.info(blockedMessage || t('course.toastUnlockPrev'));
      quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (quizLoadFailed) {
      toast.error(
        language === 'ar'
          ? 'تعذر تحميل حالة اختبار الحلقة. حدث الصفحة وحاول مرة أخرى.'
          : 'Could not load this episode quiz status. Refresh and try again.'
      );
    }
  }, [canMarkComplete, hasWatchRequirementMet, quizRequired, quizCleared, episodeAccessBlocked, blockedMessage, quizLoadFailed, language, handleEpisodeComplete, requiredWatchMinutes, t]);

  const syncEpisodeProgress = useCallback((currentTime?: number, force = false) => {
    if (!selectedEpisode || !courseId) return;
    const second = Math.floor(currentTime ?? videoRef.current?.currentTime ?? effectiveWatchedSeconds ?? 0);
    if (second <= 0) return;

    setLiveWatchedSeconds((current) => Math.max(current, second));

    if (!force && second - lastSyncedSecondRef.current < 5) {
      return;
    }

    lastSyncedSecondRef.current = Math.max(lastSyncedSecondRef.current, second);
    updateEpisodeProgressMutation.mutate({
      episodeId: selectedEpisode.id,
      courseId,
      watchedDuration: second,
      isCompleted: false,
    });
  }, [courseId, effectiveWatchedSeconds, selectedEpisode, updateEpisodeProgressMutation]);

  const handleVideoProgress = (currentTime: number) => {
    syncEpisodeProgress(currentTime);
  };

  const openEpisode = useCallback((episode: any) => {
    syncEpisodeProgress(undefined, true);
    setSelectedEpisode(episode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [syncEpisodeProgress]);

  const handleNextEpisode = async () => {
    if (!selectedEpisode || !nextEpisode) return;
    if (!isEpisodeUnlocked(nextEpisode)) {
      if (canMarkComplete) {
        const completed = await markSelectedEpisodeComplete(false);
        if (completed) openEpisode(nextEpisode);
        return;
      }

      if (canConfirmSelectedEpisodeWatch) {
        setConfirmNextEpisode(nextEpisode);
        return;
      }

      if (quizRequired && !quizCleared) {
        toast.info(
          language === 'ar'
            ? 'يجب إتمام اختبار المستوى أو تأكيد التخطي أولاً'
            : 'Complete or confirm bypass for the level quiz first'
        );
        quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (episodeAccessBlocked) {
        toast.info(blockedMessage || t('course.toastUnlockPrev'));
        quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (quizLoadFailed) {
        toast.error(
          language === 'ar'
            ? 'تعذر تحميل حالة اختبار الحلقة. حدث الصفحة وحاول مرة أخرى.'
            : 'Could not load this episode quiz status. Refresh and try again.'
        );
        return;
      }

      toast.error(t('course.toastUnlockPrev'));
      return;
    }

    openEpisode(nextEpisode);
  };

  const handleConfirmNextEpisode = async () => {
    if (!confirmNextEpisode) return;
    const targetEpisode = confirmNextEpisode;

    try {
      const completed = await markSelectedEpisodeComplete(true);
      if (!completed) return;
      setConfirmNextEpisode(null);
      await utils.episodeProgress.getCourse.invalidate();
      openEpisode(targetEpisode);
    } catch {
      // The mutation toast already explains the failure.
    }
  };

  const handleOpenBlockedPreviousEpisode = useCallback(() => {
    if (blockedPreviousEpisode) {
      openEpisode(blockedPreviousEpisode);
    }
  }, [blockedPreviousEpisode, openEpisode]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        syncEpisodeProgress(undefined, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncEpisodeProgress]);

  const handleQuizAnswerSelect = (questionId: number, optionId: string) => {
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmitEpisodeQuiz = () => {
    if (!selectedEpisode || !courseId || !episodeQuiz?.quiz?.questions?.length) return;

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

  const handleConfirmQuizBypass = () => {
    if (!selectedEpisode || !courseId) return;
    bypassEpisodeQuizMutation.mutate({
      courseId,
      episodeId: selectedEpisode.id,
      confirmed: true,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-16 w-16 mx-auto text-emerald-600 mb-4" />
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-16 w-16 mx-auto text-emerald-600 mb-4" />
            <CardTitle className="text-2xl">{t('course.enrollRequired')}</CardTitle>
            <CardDescription>
              {t('course.enrollDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">${course.price}</p>
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
                        ref={videoRef}
                        src={selectedEpisode.videoUrl}
                        controls
                        controlsList="nodownload"
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-full h-full"
                        onTimeUpdate={(event) => handleVideoProgress(event.currentTarget.currentTime)}
                        onPause={(event) => syncEpisodeProgress(event.currentTarget.currentTime, true)}
                        onEnded={(event) => {
                          const finalSecond = Math.floor(event.currentTarget.duration || event.currentTarget.currentTime || 0);
                          setLiveWatchedSeconds((current) => Math.max(current, finalSecond));
                          syncEpisodeProgress(Math.max(requiredWatchSeconds, finalSecond), true);
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
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
                  <Button
                    onClick={handleMarkCompleteClick}
                    disabled={markCompleteMutation.isPending}
                    aria-disabled={!canMarkComplete}
                    className={!canMarkComplete ? 'opacity-80' : undefined}
                  >
                    <CheckCircle2 className="h-4 w-4 me-2" />
                    {t('course.markComplete')}
                  </Button>
                  <Button variant="outline" onClick={handleNextEpisode} disabled={!nextEpisode || markCompleteMutation.isPending}>
                    {t('course.nextEpisode')}
                    <ChevronRight className="h-4 w-4 ms-2" />
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* Level Quiz */}
            {showLevelQuizCard && (
              <div ref={quizSectionRef}>
              <Card>
                <CardHeader>
                  <CardTitle>{t('course.levelQuiz')}</CardTitle>
                  <CardDescription>
                    {t('course.quizDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizLoadFailed ? (
                    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p>
                          {language === 'ar'
                            ? 'تعذر تحميل حالة اختبار هذه الحلقة. حدث الصفحة وحاول مرة أخرى، أو تواصل مع الدعم إذا استمرت المشكلة.'
                            : 'Could not load this episode quiz status. Refresh and try again, or contact support if it continues.'}
                        </p>
                      </div>
                    </div>
                  ) : episodeAccessBlocked ? (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="space-y-3">
                          <p>{blockedMessage || t('course.toastUnlockPrev')}</p>
                          {blockedPreviousEpisode && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleOpenBlockedPreviousEpisode}
                            >
                              {language === 'ar' ? 'العودة للحلقة السابقة' : 'Go to previous episode'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : quizLockedByWatch ? (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {language === 'ar'
                        ? 'سيظهر اختبار المستوى بعد استكمال مشاهدة الحلقة الحالية بالحد الأدنى المطلوب.'
                        : 'The level quiz will appear after you meet the minimum watch requirement for this episode.'}
                    </div>
                  ) : !episodeQuiz?.quiz ? (
                    <p className="text-sm text-muted-foreground">
                      {t('course.noQuiz')}
                    </p>
                  ) : episodeQuiz.passed ? (
                    <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      {t('course.quizPassed')}
                    </div>
                  ) : episodeQuiz.bypassed ? (
                    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {language === 'ar'
                        ? 'تم تخطي اختبار المستوى بناءً على تأكيدك. يمكنك المتابعة إلى المستوى التالي.'
                        : 'This level quiz was bypassed by your confirmation. You can continue to the next level.'}
                    </div>
                  ) : !episodeQuiz.quiz?.questions?.length ? (
                    <p className="text-sm text-muted-foreground">
                      {t('course.noQuiz')}
                    </p>
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
                                className={`w-full text-start rounded border px-3 py-2 text-sm transition-colors ${
                                  quizAnswers[question.id] === option.optionId
                                    ? "border-emerald-600 bg-emerald-50"
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
                        <div className="space-y-3">
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
                          {!quizResult.passed && (
                            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                              <p className="mb-3">
                                {language === 'ar'
                                  ? 'ننصحك بمراجعة حلقات هذا المستوى ثم إعادة الاختبار. إذا كنت متأكداً أنك تريد المتابعة، يمكنك تأكيد تخطي الاختبار.'
                                  : 'We recommend reviewing this level and retaking the quiz. If you are sure you want to continue, you can confirm bypass.'}
                              </p>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                >
                                  {language === 'ar' ? 'مراجعة حلقات المستوى' : 'Review level episodes'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => setConfirmQuizBypass(true)}
                                >
                                  {language === 'ar' ? 'أفهم وأريد المتابعة' : 'I understand and want to continue'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              </div>
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
                    const canConfirmImmediateNext = nextEpisode?.id === episode.id && canConfirmSelectedEpisodeWatch;
                    
                    return (
                      <button
                        key={episode.id}
                        onClick={() => {
                          if (!isUnlocked) {
                            if (canConfirmImmediateNext) {
                              setConfirmNextEpisode(episode);
                              return;
                            }
                            if (nextEpisode?.id === episode.id && quizRequired && !quizCleared) {
                              toast.info(
                                language === 'ar'
                                  ? 'أكمل اختبار المستوى أو أكد التخطي لفتح المستوى التالي'
                                  : 'Complete or confirm bypass for the level quiz to unlock the next level'
                              );
                              quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              return;
                            }
                            toast.error(t('course.toastUnlockPrev'));
                            return;
                          }
                          openEpisode(episode);
                        }}
                        disabled={!isUnlocked && !canConfirmImmediateNext}
                        className={`w-full text-start p-4 transition-colors ${
                          isUnlocked ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed bg-gray-50'
                        } ${
                          isSelected ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''
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
                              <p className="text-xs text-muted-foreground">{Math.floor(episode.duration / 60)} {t('course.min')}</p>
                            )}
                          </div>
                          {isSelected && (
                            <Play className="h-4 w-4 text-emerald-600 flex-shrink-0" />
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

    <Dialog open={!!confirmNextEpisode} onOpenChange={(open) => !open && setConfirmNextEpisode(null)}>
      <DialogContent className="sm:max-w-md" dir={isArabic ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {isArabic ? 'متابعة الحلقة التالية؟' : 'Continue to the next episode?'}
          </DialogTitle>
          <DialogDescription>
            {isArabic
              ? 'سجلاتنا لا تظهر أن الحلقة الحالية مكتملة. إذا كنت قد شاهدتها بالفعل، يمكننا تحديدها كمكتملة وفتح الحلقة التالية لك.'
              : 'Our records do not show the current episode as completed. If you already watched it, we can mark it complete and open the next episode.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={handleConfirmNextEpisode}
            disabled={markCompleteMutation.isPending}
          >
            {isArabic ? 'نعم، شاهدتها - افتح التالية' : 'Yes, I watched it - open next'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setConfirmNextEpisode(null)}
            disabled={markCompleteMutation.isPending}
          >
            {isArabic ? 'العودة للحلقة' : 'Go back to episode'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmQuizBypass} onOpenChange={setConfirmQuizBypass}>
      <DialogContent className="sm:max-w-md" dir={isArabic ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>
            {isArabic ? 'تأكيد تخطي اختبار المستوى؟' : 'Confirm level quiz bypass?'}
          </DialogTitle>
          <DialogDescription>
            {isArabic
              ? 'ننصحك بمراجعة حلقات المستوى وإعادة الاختبار. عند التأكيد سنفتح لك المستوى التالي، لكن لن يتم احتساب الاختبار كمجتاز.'
              : 'We recommend reviewing the level and retaking the quiz. If you confirm, the next level will open, but this quiz will not be counted as passed.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={handleConfirmQuizBypass}
            disabled={bypassEpisodeQuizMutation.isPending}
          >
            {isArabic ? 'نعم، أريد المتابعة' : 'Yes, continue'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setConfirmQuizBypass(false)}
            disabled={bypassEpisodeQuizMutation.isPending}
          >
            {isArabic ? 'العودة ومراجعة المستوى' : 'Go back and review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Deferred Activation Dialog */}
    {activationStatus?.hasPending && (
      <Dialog
        open={showActivationDialog && activationStatus.hasPending}
        onOpenChange={setShowActivationDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              {t('activation.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('activation.dialogDesc')
                .replace('{studyDays}', String(studyPeriodDays))
                .replace('{serviceDays}', String(entitlementDays))}
            </DialogDescription>
          </DialogHeader>

          {activationStatus.maxActivationDate && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">{t('activation.important')}: </span>
                {t('activation.autoActivateNote').replace(
                  '{date}',
                  activationDeadline || ''
                )}
              </span>
            </div>
          )}

          {activationDaysLeft !== null && (
            <p className="text-sm text-amber-700">
              {isArabic
                ? `يتبقى لديك تقريباً ${activationDaysLeft} يوم لإكمال الكورس وإعداد حساب الوسيط.`
                : `You have about ${activationDaysLeft} days left to finish the course and broker setup.`}
            </p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full gap-2">
              <Link href="/broker-onboarding">
                <Zap className="h-4 w-4" />
                {t('activation.startNow')}
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/courses">
                {t('activation.continueLearning')}
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowActivationDialog(false)}
            >
              {isArabic ? 'لاحقاً' : 'Later'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    </ClientLayout>
  );
}
