import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Eye, EyeOff, Video } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";

interface CourseCardProps {
  course: {
    id: number;
    titleEn: string;
    titleAr: string;
    descriptionEn: string;
    level: string;
    isPublished: boolean | number;
    stageNumber?: number | null;
  };
  onEdit: (course: any) => void;
  onDelete: (id: number) => void;
}

export function AdminCourseCard({ course, onEdit, onDelete }: CourseCardProps) {
  const { t } = useLanguage();

  return (
    <Card>
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
          <span className="capitalize text-muted-foreground">{course.level}</span>
          {(course.stageNumber ?? 0) > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              Stage {course.stageNumber}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/admin/courses/${course.id}/episodes`}>
            <Button variant="default" size="sm" className="w-full">
              <Video className="mr-1 h-3 w-3" />
              {t('admin.courses.manageEpisodes')}
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(course)} className="flex-1">
              <Edit className="mr-1 h-3 w-3" />
              {t('admin.courses.edit')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(course.id)} className="text-red-600 hover:text-red-700">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
