import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@/lib/formatDuration";
import { FileUpload } from "@/components/FileUpload";
import { Plus, Edit, Trash2, Video, ArrowLeft, MoveUp, MoveDown, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRoute, Link } from "wouter";

export default function AdminEpisodes() {
  const [, params] = useRoute("/admin/courses/:courseId/episodes");
  const courseId = params?.courseId ? parseInt(params.courseId) : null;

  const utils = trpc.useUtils();
  const { data: course } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: !!courseId }
  );
  const { data: episodes, isLoading } = trpc.episodes.listByCourse.useQuery(
    { courseId: courseId! },
    { enabled: !!courseId }
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<any>(null);
  const [previewingEpisode, setPreviewingEpisode] = useState<any>(null);

  const createMutation = trpc.episodes.create.useMutation({
    onSuccess: () => {
      toast.success("Episode created successfully");
      utils.episodes.listByCourse.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create episode: ${error.message}`);
    },
  });

  const updateMutation = trpc.episodes.update.useMutation({
    onSuccess: () => {
      toast.success("Episode updated successfully");
      utils.episodes.listByCourse.invalidate();
      setIsDialogOpen(false);
      setEditingEpisode(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update episode: ${error.message}`);
    },
  });

  const deleteMutation = trpc.episodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Episode deleted successfully");
      utils.episodes.listByCourse.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete episode: ${error.message}`);
    },
  });

  const uploadVideo = trpc.upload.video.useMutation();

  const [formData, setFormData] = useState({
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    videoUrl: "",
    duration: 0,
    order: 1,
    isFree: false,
  });

  const resetForm = () => {
    setFormData({
      titleEn: "",
      titleAr: "",
      descriptionEn: "",
      descriptionAr: "",
      videoUrl: "",
      duration: 0,
      order: (episodes?.length || 0) + 1,
      isFree: false,
    });
  };

  const handleEdit = (episode: any) => {
    setEditingEpisode(episode);
    setFormData({
      titleEn: episode.titleEn,
      titleAr: episode.titleAr,
      descriptionEn: episode.descriptionEn || "",
      descriptionAr: episode.descriptionAr || "",
      videoUrl: episode.videoUrl || "",
      duration: episode.duration || 0,
      order: episode.order,
      isFree: episode.isFree,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    if (editingEpisode) {
      updateMutation.mutate({ id: editingEpisode.id, ...formData });
    } else {
      createMutation.mutate({ courseId, ...formData });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this episode?")) {
      deleteMutation.mutate({ id });
    }
  };

  if (!courseId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invalid course ID</p>
          <Link href="/admin/courses">
            <Button className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/courses">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{course?.titleEn || "Loading..."}</h1>
            <p className="text-muted-foreground">Manage course episodes</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingEpisode(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Episode
          </Button>
        </div>

        {isLoading ? (
          <p>Loading episodes...</p>
        ) : !episodes || episodes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No episodes yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first episode to start building your course content
              </p>
              <Button onClick={() => { resetForm(); setEditingEpisode(null); setIsDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Episode
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {episodes
              .sort((a, b) => a.order - b.order)
              .map((episode, index) => (
                <Card key={episode.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-blue-600">{episode.order}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{episode.titleEn}</CardTitle>
                            {episode.isFree && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                                FREE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{episode.titleAr}</p>
                          {episode.descriptionEn && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {episode.descriptionEn}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            {episode.duration && (
                              <span>{formatDuration(episode.duration)}</span>
                            )}
                            {episode.videoUrl && (
                              <span className="flex items-center gap-1">
                                <Video className="h-3 w-3" />
                                Video available
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {episode.videoUrl && (
                          <Button variant="outline" size="sm" onClick={() => setPreviewingEpisode(episode)}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleEdit(episode)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(episode.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {previewingEpisode?.id === episode.id && episode.videoUrl && (
                    <CardContent>
                      <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                          src={episode.videoUrl}
                          controls
                          autoPlay
                          className="w-full h-full"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewingEpisode(null)}
                        className="mt-2"
                      >
                        Close Preview
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEpisode ? "Edit Episode" : "Create New Episode"}</DialogTitle>
              <DialogDescription>
                Fill in the episode details in both English and Arabic
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="titleEn">Title (English)</Label>
                  <Input
                    id="titleEn"
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    required
                    placeholder="e.g., Introduction to Technical Analysis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleAr">Title (Arabic)</Label>
                  <Input
                    id="titleAr"
                    value={formData.titleAr}
                    onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                    required
                    dir="rtl"
                    placeholder="مثال: مقدمة في التحليل الفني"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="descriptionEn">Description (English)</Label>
                  <Textarea
                    id="descriptionEn"
                    value={formData.descriptionEn}
                    onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                    rows={3}
                    placeholder="Episode description..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionAr">Description (Arabic)</Label>
                  <Textarea
                    id="descriptionAr"
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    rows={3}
                    dir="rtl"
                    placeholder="وصف الحلقة..."
                  />
                </div>
              </div>

              <FileUpload
                accept="video/*"
                maxSize={500}
                label="Episode Video"
                preview="video"
                currentUrl={formData.videoUrl}
                onUrlChange={(url) => setFormData({ ...formData, videoUrl: url })}
                onUpload={async (file) => {
                  const reader = new FileReader();
                  return new Promise((resolve, reject) => {
                    reader.onload = async () => {
                      const base64 = reader.result?.toString().split(',')[1];
                      if (!base64) {
                        reject(new Error('Failed to read file'));
                        return;
                      }
                      
                      try {
                        const result = await uploadVideo.mutateAsync({
                          fileName: file.name,
                          fileData: base64,
                          contentType: file.type,
                        });
                        resolve(result.url);
                      } catch (error) {
                        reject(error);
                      }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Upload a video file (max 500MB) or paste a YouTube/Vimeo URL in the input above
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Episode Order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    required
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isFree">Access Type</Label>
                  <div className="flex items-center space-x-2 h-10">
                    <Switch
                      id="isFree"
                      checked={formData.isFree}
                      onCheckedChange={(checked) => setFormData({ ...formData, isFree: checked })}
                    />
                    <Label htmlFor="isFree" className="cursor-pointer">
                      {formData.isFree ? "Free Preview" : "Premium"}
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingEpisode ? "Update" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
