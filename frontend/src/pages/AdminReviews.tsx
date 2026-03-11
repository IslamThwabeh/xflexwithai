import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Check, X, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AdminReviews() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const { data: reviews, isLoading, refetch } = trpc.reviews.listAll.useQuery(
    filter === 'all' ? {} : { isApproved: filter === 'approved' }
  );

  const moderateMut = trpc.reviews.moderate.useMutation({
    onSuccess: () => { refetch(); toast.success(isRtl ? 'تم التحديث' : 'Updated'); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.reviews.delete.useMutation({
    onSuccess: () => { refetch(); toast.success(isRtl ? 'تم الحذف' : 'Deleted'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            {isRtl ? 'إدارة التقييمات والمراجعات' : 'Reviews & Ratings Management'}
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
              {f === 'all' ? (isRtl ? 'الكل' : 'All') :
               f === 'pending' ? (isRtl ? 'في الانتظار' : 'Pending') :
               (isRtl ? 'موافق عليها' : 'Approved')}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : !reviews?.length ? (
          <div className="text-center py-12 text-muted-foreground">{isRtl ? 'لا توجد مراجعات' : 'No reviews found'}</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review: any) => (
              <div key={review.id} className="bg-white border rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{review.userName || review.userEmail}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm text-blue-600">{isRtl ? review.courseTitleAr : review.courseTitleEn}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                      ))}
                      <span className="text-xs text-muted-foreground ms-1">{review.rating}/5</span>
                    </div>
                    {review.comment && <p className="text-sm mt-2 text-gray-700">{review.comment}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={review.isApproved ? 'default' : 'secondary'}>
                      {review.isApproved ? (isRtl ? 'موافق' : 'Approved') : (isRtl ? 'معلق' : 'Pending')}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  {!review.isApproved && (
                    <Button size="sm" variant="outline" className="text-green-600"
                      onClick={() => moderateMut.mutate({ reviewId: review.id, isApproved: true })}>
                      <Check className="w-3.5 h-3.5 me-1" /> {isRtl ? 'موافقة' : 'Approve'}
                    </Button>
                  )}
                  {review.isApproved && (
                    <Button size="sm" variant="outline" className="text-amber-600"
                      onClick={() => moderateMut.mutate({ reviewId: review.id, isApproved: false })}>
                      <X className="w-3.5 h-3.5 me-1" /> {isRtl ? 'إلغاء الموافقة' : 'Unapprove'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-red-600"
                    onClick={() => { if (confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) deleteMut.mutate({ reviewId: review.id }); }}>
                    <Trash2 className="w-3.5 h-3.5 me-1" /> {isRtl ? 'حذف' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
