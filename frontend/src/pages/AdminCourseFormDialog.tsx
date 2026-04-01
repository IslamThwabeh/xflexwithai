import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminCourseFormBody } from "./AdminCourseFormBody";

export interface CourseFormData {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  thumbnailUrl: string;
  price: number;
  level: "beginner" | "intermediate" | "advanced";
  isPublished: boolean;
  stageNumber: number;
  introVideoUrl: string;
  hasPdf: boolean;
  hasIntroVideo: boolean;
  pdfUrl: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CourseFormData;
  setFormData: React.Dispatch<React.SetStateAction<CourseFormData>>;
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onUploadImage: (file: File) => Promise<string>;
}

export function AdminCourseFormDialog({ open, onOpenChange, formData, setFormData, isEditing, isSaving, onSubmit, onUploadImage }: Props) {
  const { t } = useLanguage();
  const set = (patch: Partial<CourseFormData>) => setFormData({ ...formData, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('admin.courses.editCourse') : t('admin.courses.createCourse')}</DialogTitle>
          <DialogDescription>{t('admin.courses.fillBoth')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <AdminCourseFormBody formData={formData} set={set} t={t} onUploadImage={onUploadImage} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('admin.courses.cancel')}</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('admin.courses.saving') : (isEditing ? t('admin.courses.update') : t('admin.courses.create'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
