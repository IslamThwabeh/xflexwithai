import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import type { CourseFormData } from "./AdminCourseFormDialog";

interface Props {
  formData: CourseFormData;
  set: (patch: Partial<CourseFormData>) => void;
  t: (key: string) => string;
  onUploadImage: (file: File) => Promise<string>;
}

export function AdminCourseFormBody({ formData, set, t, onUploadImage }: Props) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="titleEn">{t('admin.courses.titleEn')}</Label>
          <Input id="titleEn" value={formData.titleEn} onChange={(e) => set({ titleEn: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="titleAr">{t('admin.courses.titleAr')}</Label>
          <Input id="titleAr" value={formData.titleAr} onChange={(e) => set({ titleAr: e.target.value })} required dir="rtl" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="descriptionEn">{t('admin.courses.descEn')}</Label>
          <Textarea id="descriptionEn" value={formData.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} required rows={4} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="descriptionAr">{t('admin.courses.descAr')}</Label>
          <Textarea id="descriptionAr" value={formData.descriptionAr} onChange={(e) => set({ descriptionAr: e.target.value })} required rows={4} dir="rtl" />
        </div>
      </div>
      <FileUpload accept="image/*" maxSize={5} label={t('admin.courses.thumbnail.label')} preview="image"
        currentUrl={formData.thumbnailUrl} onUrlChange={(url) => set({ thumbnailUrl: url })} onUpload={onUploadImage} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="level">{t('admin.courses.level')}</Label>
          <Select value={formData.level} onValueChange={(value: any) => set({ level: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">{t('admin.courses.beginner')}</SelectItem>
              <SelectItem value="intermediate">{t('admin.courses.intermediate')}</SelectItem>
              <SelectItem value="advanced">{t('admin.courses.advanced')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="isPublished">{t('admin.courses.status')}</Label>
          <Select value={formData.isPublished ? "published" : "draft"} onValueChange={(v) => set({ isPublished: v === "published" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('admin.courses.draft')}</SelectItem>
              <SelectItem value="published">{t('admin.courses.published')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="border-t pt-4 mt-4">
        <h3 className="font-medium text-sm text-muted-foreground mb-3">Stage & Media</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Stage Number (0 = none)</Label>
            <Input type="number" min="0" max="20" value={formData.stageNumber} onChange={(e) => set({ stageNumber: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Intro Video URL</Label>
            <Input value={formData.introVideoUrl} onChange={(e) => set({ introVideoUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>PDF URL</Label>
            <Input value={formData.pdfUrl} onChange={(e) => set({ pdfUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={formData.hasIntroVideo} onChange={(e) => set({ hasIntroVideo: e.target.checked })} className="rounded border-gray-300" />
            Has Intro Video
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={formData.hasPdf} onChange={(e) => set({ hasPdf: e.target.checked })} className="rounded border-gray-300" />
            Has PDF
          </label>
        </div>
      </div>
    </>
  );
}
