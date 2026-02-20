import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Play,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Episode {
  id: number;
  titleEn: string;
  titleAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  order: number;
  level?: string; // Optional grouping label (if present in data)
  isCompleted?: boolean;
  progress?: number;
}

export default function CoursePlayer() {
  const params = useParams();
  const courseId = parseInt(params.id || "0");
  const { user } = useAuth();
  
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Queries
  const { data: course } = trpc.courses.getById.useQuery({ id: courseId });
  const { data: episodes } = trpc.episodes.listByCourse.useQuery({ courseId });
  const { data: enrollment } = trpc.enrollments.getEnrollment.useQuery(
    { courseId },
    { enabled: !!user }
  );
  const { data: hasAccess } = trpc.registrationKeys.checkAccess.useQuery(
    { email: user?.email || "", courseId },
    { enabled: !!user?.email }
  );

  // Mutations
  const updateProgress = trpc.episodeProgress.updateProgress.useMutation();

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Group episodes by level
  const episodesList = (episodes ?? []) as Episode[];
  const episodesByLevel = episodesList.reduce<Record<string, Episode[]>>((acc, episode) => {
    const level = (episode as any).level || "Other";
    if (!acc[level]) {
      acc[level] = [];
    }
    acc[level].push(episode);
    return acc;
  }, {});

  // Set first episode as current if none selected
  useEffect(() => {
    if (episodes && episodes.length > 0 && !currentEpisode) {
      setCurrentEpisode(episodes[0]);
    }
  }, [episodes, currentEpisode]);

  const handleEpisodeSelect = (episode: Episode) => {
    setCurrentEpisode(episode);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleVideoProgress = (episodeId: number, progress: number) => {
    if (user) {
      updateProgress.mutate({
        episodeId,
        courseId,
        watchedDuration: progress,
        isCompleted: progress > 0.9, // 90% watched = completed
      });
    }
  };

  const goToNextEpisode = () => {
    if (!episodes || !currentEpisode) return;
    const currentIndex = episodesList.findIndex((episode) => episode.id === currentEpisode.id);
    if (currentIndex < episodes.length - 1) {
      setCurrentEpisode(episodes[currentIndex + 1]);
    }
  };

  const goToPreviousEpisode = () => {
    if (!episodes || !currentEpisode) return;
    const currentIndex = episodesList.findIndex((episode) => episode.id === currentEpisode.id);
    if (currentIndex > 0) {
      setCurrentEpisode(episodes[currentIndex - 1]);
    }
  };

  // Check access
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>
              Please login to access this course
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = "/auth")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess?.hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need a valid registration key to access this course
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => (window.location.href = "/activate-key")}
              className="w-full"
            >
              Activate Registration Key
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <div className="sticky top-0 z-50 bg-background border-b p-4 flex items-center justify-between">
          <h1 className="font-semibold truncate">{course?.titleEn}</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <X /> : <Menu />}
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
        {/* Sidebar - Episode List */}
        <div
          className={`${
            showSidebar ? "block" : "hidden"
          } md:block w-full md:w-80 lg:w-96 border-r bg-card overflow-hidden flex flex-col`}
        >
          <div className="p-4 border-b">
            <h2 className="font-bold text-lg">{course?.titleEn}</h2>
            <p className="text-sm text-muted-foreground">
              {episodes?.length || 0} episodes
            </p>
            {enrollment && (
              <Progress
                value={enrollment.progressPercentage}
                className="mt-2"
              />
            )}
          </div>

          <ScrollArea className="flex-1">
            <Accordion type="multiple" className="w-full">
              {Object.entries(episodesByLevel || {}).map(([level, levelEpisodes]) => (
                <AccordionItem key={level} value={level}>
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold">{level}</span>
                      <Badge variant="secondary">
                        {levelEpisodes.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-1">
                      {levelEpisodes.map((episode) => (
                        <button
                          key={episode.id}
                          onClick={() => handleEpisodeSelect(episode)}
                          className={`w-full text-left p-3 hover:bg-accent transition-colors ${
                            currentEpisode?.id === episode.id
                              ? "bg-accent border-l-4 border-primary"
                              : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-1">
                              {episode.isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Play className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {episode.titleAr}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {Math.floor((episode.duration ?? 0) / 60)} min
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </div>

        {/* Main Content - Video Player */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentEpisode ? (
            <>
              {/* Video Player */}
              <div className="relative bg-black aspect-video md:aspect-auto md:flex-1">
                <video
                  key={currentEpisode.id}
                  controls
                  className="w-full h-full"
                  src={currentEpisode.videoUrl ?? undefined}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget;
                    const progress = video.currentTime / video.duration;
                    if (progress > 0) {
                      handleVideoProgress(currentEpisode.id, progress);
                    }
                  }}
                  autoPlay
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video Info & Controls */}
              <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold">
                    {currentEpisode.titleAr}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentEpisode.titleEn}
                  </p>
                </div>

                {currentEpisode.descriptionAr && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">About this episode</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {currentEpisode.descriptionAr}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={goToPreviousEpisode}
                    disabled={
                      !episodes ||
                      episodes.findIndex((e) => e.id === currentEpisode.id) === 0
                    }
                    className="flex-1"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={goToNextEpisode}
                    disabled={
                      !episodes ||
                      episodes.findIndex((e) => e.id === currentEpisode.id) ===
                        episodes.length - 1
                    }
                    className="flex-1"
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <Card className="max-w-md">
                <CardHeader>
                  <CardTitle>No Episode Selected</CardTitle>
                  <CardDescription>
                    Select an episode from the sidebar to start watching
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
