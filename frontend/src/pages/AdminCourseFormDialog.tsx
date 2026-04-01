import { Button } from "@/components/ui/button";
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
import { FileUpload } from "@/components/FileUpload";
import { useLanguage } from "@/contexts/LanguageContext";

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

export function AdminCourseFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isEditing,
  isSaving,
  onSubmit,
  onUploadImage,
}: Props) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('admin.courses.editCourse') : t('admin.courses.createCourse')}</DialogTitle>
          <DialogDescription>
            {t('admin.courses.fillBoth')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
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
            onUpload={onUploadImage}
          />

          <div className="grid gap-4 md:grid-cols-2">
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

          {/* Stage & Media fields */}
          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Stage & Media</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Stage Number (0 = none)</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.stageNumber}
                  onChange={(e) => setFormData({ ...formData, stageNumber: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Intro Video URL</Label>
                <Input
                  value={formData.introVideoUrl}
                  onChange={(e) => setFormData({ ...formData, introVideoUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>PDF URL</Label>
                <Input
                  value={formData.pdfUrl}
                  onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasIntroVideo}
                  onChange={(e) => setFormData({ ...formData, hasIntroVideo: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Has Intro Video
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasPdf}
                  onChange={(e) => setFormData({ ...formData, hasPdf: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Has PDF
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('admin.courses.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('admin.courses.saving') : (isEditing ? t('admin.courses.update') : t('admin.courses.create'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
