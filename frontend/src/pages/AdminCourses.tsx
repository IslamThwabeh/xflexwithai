import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FileUpload } from "@/components/FileUpload";
import { Plus, Edit, Trash2, Eye, EyeOff, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function AdminCourses() {
  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Course created successfully");
      utils.courses.listAll.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create course: ${error.message}`);
    },
  });

  const updateMutation = trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success("Course updated successfully");
      utils.courses.listAll.invalidate();
      setIsDialogOpen(false);
      setEditingCourse(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update course: ${error.message}`);
    },
  });

  const deleteMutation = trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success("Course deleted successfully");
      utils.courses.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete course: ${error.message}`);
    },
  });

  const uploadImage = trpc.upload.image.useMutation();

  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    thumbnailUrl: "",
    price: 0,
    level: "beginner" as "beginner" | "intermediate" | "advanced",
    isPublished: false,
  });

  const resetForm = () => {
    setFormData({
      titleEn: "",
      titleAr: "",
      descriptionEn: "",
      descriptionAr: "",
      thumbnailUrl: "",
      price: 0,
      level: "beginner",
      isPublished: false,
    });
  };

  const handleEdit = (course: any) => {
    setEditingCourse(course);
    setFormData({
      titleEn: course.titleEn,
      titleAr: course.titleAr,
      descriptionEn: course.descriptionEn,
      descriptionAr: course.descriptionAr,
      thumbnailUrl: course.thumbnailUrl || "",
      price: course.price,
      level: course.level,
      isPublished: course.isPublished,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm(t('admin.courses.deleteConfirm'))) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.courses')}</h1>
            <p className="text-muted-foreground">{t('admin.courses.subtitle')}</p>
          </div>
          <Button onClick={() => { resetForm(); setEditingCourse(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.courses.addCourse')}
          </Button>
        </div>

        {isLoading ? (
          <p>{t('admin.loading')}</p>
        ) : !courses || courses.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">{t('admin.courses.noCourses')} {t('admin.courses.noCoursesCta')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{course.titleEn}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{course.titleAr}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {course.isPublished ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {course.descriptionEn}
                  </p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="font-medium">${(course.price / 100).toFixed(2)}</span>
                    <span className="capitalize text-muted-foreground">{course.level}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Link href={`/admin/courses/${course.id}/episodes`}>
                      <Button variant="default" size="sm" className="w-full">
                        <Video className="mr-1 h-3 w-3" />
                        {t('admin.courses.manageEpisodes')}
                      </Button>
                    </Link>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(course)} className="flex-1">
                        <Edit className="mr-1 h-3 w-3" />
                        {t('admin.courses.edit')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(course.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCourse ? t('admin.courses.editCourse') : t('admin.courses.createCourse')}</DialogTitle>
              <DialogDescription>
                {t('admin.courses.fillBoth')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="titleEn">{t('admin.courses.titleEn')}</Label>
                  <Input
                    id="titleEn"
                    value={formData.titleEn}
                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleAr">{t('admin.courses.titleAr')}</Label>
                  <Input
                    id="titleAr"
                    value={formData.titleAr}
                    onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                    required
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="descriptionEn">{t('admin.courses.descEn')}</Label>
                  <Textarea
                    id="descriptionEn"
                    value={formData.descriptionEn}
                    onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                    required
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionAr">{t('admin.courses.descAr')}</Label>
                  <Textarea
                    id="descriptionAr"
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    required
                    rows={4}
                    dir="rtl"
                  />
                </div>
              </div>

              <FileUpload
                accept="image/*"
                maxSize={5}
                label={t('admin.courses.thumbnail.label')}
                preview="image"
                currentUrl={formData.thumbnailUrl}
                onUrlChange={(url) => setFormData({ ...formData, thumbnailUrl: url })}
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
                        const result = await uploadImage.mutateAsync({
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

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('admin.courses.price')}</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price / 100}
                    onChange={(e) => setFormData({ ...formData, price: Math.round(parseFloat(e.target.value) * 100) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">{t('admin.courses.level')}</Label>
                  <Select value={formData.level} onValueChange={(value: any) => setFormData({ ...formData, level: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">{t('admin.courses.beginner')}</SelectItem>
                      <SelectItem value="intermediate">{t('admin.courses.intermediate')}</SelectItem>
                      <SelectItem value="advanced">{t('admin.courses.advanced')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isPublished">{t('admin.courses.status')}</Label>
                  <Select value={formData.isPublished ? "published" : "draft"} onValueChange={(value) => setFormData({ ...formData, isPublished: value === "published" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t('admin.courses.draft')}</SelectItem>
                      <SelectItem value="published">{t('admin.courses.published')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('admin.courses.cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? t('admin.courses.saving') : (editingCourse ? t('admin.courses.update') : t('admin.courses.create'))}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
