import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminCourseCard } from "./AdminCourseCard";
import { AdminCourseFormDialog, type CourseFormData } from "./AdminCourseFormDialog";

const EMPTY_FORM: CourseFormData = {
  titleEn: "",
  titleAr: "",
  descriptionEn: "",
  descriptionAr: "",
  thumbnailUrl: "",
  price: 0,
  level: "beginner",
  isPublished: false,
  stageNumber: 0,
  introVideoUrl: "",
  hasPdf: false,
  hasIntroVideo: false,
  pdfUrl: "",
};

export default function AdminCourses() {
  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [formData, setFormData] = useState<CourseFormData>({ ...EMPTY_FORM });

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Course created successfully");
      utils.courses.listAll.invalidate();
      setIsDialogOpen(false);
      setFormData({ ...EMPTY_FORM });
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
      setFormData({ ...EMPTY_FORM });
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
      stageNumber: course.stageNumber || 0,
      introVideoUrl: course.introVideoUrl || "",
      hasPdf: !!course.hasPdf,
      hasIntroVideo: !!course.hasIntroVideo,
      pdfUrl: course.pdfUrl || "",
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

  const handleUploadImage = async (file: File): Promise<string> => {
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
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('admin.courses')}</h1>
            <p className="text-muted-foreground">{t('admin.courses.subtitle')}</p>
          </div>
          <Button onClick={() => { setFormData({ ...EMPTY_FORM }); setEditingCourse(null); setIsDialogOpen(true); }}>
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
              <AdminCourseCard
                key={course.id}
                course={course}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <AdminCourseFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          formData={formData}
          setFormData={setFormData}
          isEditing={!!editingCourse}
          isSaving={createMutation.isPending || updateMutation.isPending}
          onSubmit={handleSubmit}
          onUploadImage={handleUploadImage}
        />
      </div>
    </DashboardLayout>
  );
}
