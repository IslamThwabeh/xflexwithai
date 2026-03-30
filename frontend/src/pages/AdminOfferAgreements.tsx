import { FileCheck, Download, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import DashboardLayout from '@/components/DashboardLayout';
import { useState } from 'react';

export default function AdminOfferAgreements() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data: agreements, isLoading } = trpc.offers.listAgreements.useQuery({ offerSlug: 'eid-fitr-2026' });
  const deleteMutation = trpc.offers.deleteAgreement.useMutation({
    onSuccess: () => utils.offers.listAgreements.invalidate(),
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = (id: number, name: string) => {
    if (!confirm(isRtl ? `هل أنت متأكد من حذف موافقة "${name}"؟` : `Delete agreement for "${name}"?`)) return;
    setDeletingId(id);
    deleteMutation.mutate({ id }, { onSettled: () => setDeletingId(null) });
  };

  const exportCSV = () => {
    if (!agreements?.length) return;
    const header = 'Name,Email,Phone,Agreed At,IP';
    const rows = agreements.map((a: any) =>
      `"${a.fullName}","${a.email}","${a.phone || ''}","${a.agreedAt}","${a.ipAddress || ''}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'offer-agreements.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="h-7 w-7 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold">{isRtl ? 'موافقات العروض' : 'Offer Agreements'}</h1>
              <p className="text-sm text-muted-foreground">
                {isRtl ? 'عرض ضمان الاستفادة — عيد الفطر ٢٠٢٦' : 'Benefit Guarantee Offer — Eid Al-Fitr 2026'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {agreements?.length ?? 0} {isRtl ? 'موافقة' : 'agreements'}
            </Badge>
            {agreements && agreements.length > 0 && (
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition"
              >
                <Download className="h-4 w-4" />
                {isRtl ? 'تصدير CSV' : 'Export CSV'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">#</th>
                  <th className="px-4 py-3 text-start font-semibold">{isRtl ? 'الاسم' : 'Name'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isRtl ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isRtl ? 'الواتساب' : 'WhatsApp'}</th>
                  <th className="px-4 py-3 text-start font-semibold">{isRtl ? 'تاريخ الموافقة' : 'Agreed At'}</th>
                  <th className="px-4 py-3 text-start font-semibold">IP</th>
                  <th className="px-4 py-3 text-center font-semibold">{isRtl ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {isRtl ? 'جارٍ التحميل...' : 'Loading...'}
                  </td></tr>
                ) : !agreements?.length ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {isRtl ? 'لا توجد موافقات بعد' : 'No agreements yet'}
                  </td></tr>
                ) : (
                  agreements.map((a: any, i: number) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition">
                      <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{a.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.email}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.phone ? (
                          <a href={`https://wa.me/${a.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
                            {a.phone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(a.agreedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US', {
                          dateStyle: 'medium', timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{a.ipAddress || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(a.id, a.fullName)}
                          disabled={deletingId === a.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === a.id ? '...' : (isRtl ? 'حذف' : 'Delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
