import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { withApiBase } from '@/lib/apiBase';
import ClientLayout from '@/components/ClientLayout';
import { ArrowLeft, Download, ExternalLink, FileText, Lock, Package } from 'lucide-react';

function formatFileSize(bytes: number | null | undefined, isRtl: boolean) {
  if (!bytes || bytes <= 0) return isRtl ? 'الحجم غير متوفر' : 'Size unavailable';

  const units = isRtl ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const display = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

export default function StudentDocuments() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data, isLoading } = trpc.documents.myLibrary.useQuery();

  return (
    <ClientLayout>
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-xf-cream)]" dir={isRtl ? 'rtl' : 'ltr'}>
        <main className="container mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-xf-dark)]">
                {isRtl ? 'ملفات الدورة' : 'Course Documents'}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {isRtl
                  ? 'حمّل ملفات الدورة أو افتحها مباشرة بصيغة PDF من حسابك.'
                  : 'Open the course files in PDF or download them directly from your account.'}
              </p>
            </div>
            <Link href="/courses">
              <Button variant="ghost">
                <ArrowLeft className={`h-4 w-4 ${isRtl ? 'rotate-180' : ''}`} />
                {isRtl ? 'العودة للوحة الطالب' : 'Back to Dashboard'}
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="border-emerald-100">
                  <CardHeader>
                    <div className="h-5 w-2/3 animate-pulse rounded bg-emerald-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-emerald-50" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-emerald-50" />
                    <div className="h-9 w-full animate-pulse rounded bg-emerald-100" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !data?.hasAccess ? (
            <Card className="mx-auto max-w-2xl border-amber-200 bg-white">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Lock className="h-6 w-6" />
                </div>
                <CardTitle>{isRtl ? 'الملفات غير متاحة بعد' : 'Documents Are Locked'}</CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'فعّل أي باقة أولاً حتى يظهر لك أرشيف ملفات الدورة مع أزرار الفتح والتنزيل.'
                    : 'Activate any package first to unlock the course document library with preview and download access.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Link href="/activate-key">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Package className="h-4 w-4" />
                    {isRtl ? 'تفعيل باقة' : 'Activate Package'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="border-emerald-100 bg-white">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      {isRtl ? 'وصولك الحالي' : 'Your Current Access'}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--color-xf-dark)]">
                      {isRtl ? (data.packageNameAr ?? 'باقة مفعّلة') : (data.packageNameEn ?? 'Activated Package')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isRtl
                        ? `لديك الآن ${data.documents.length} ملف${data.documents.length === 1 ? '' : 'ات'} متاحة للعرض والتنزيل.`
                        : `You currently have ${data.documents.length} document${data.documents.length === 1 ? '' : 's'} available to preview and download.`}
                    </p>
                  </div>
                  {data.bulkDownloadPath ? (
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                      <a href={withApiBase(data.bulkDownloadPath)}>
                        <Download className="h-4 w-4" />
                        {isRtl ? 'تحميل جميع الملفات' : 'Download All'}
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {data.documents.length === 0 ? (
                <Card className="border-dashed border-emerald-200 bg-white">
                  <CardHeader>
                    <CardTitle>{isRtl ? 'الملفات قيد التجهيز' : 'Documents Are Being Prepared'}</CardTitle>
                    <CardDescription>
                      {isRtl
                        ? 'تم تجهيز المكتبة، لكن لم يتم رفع الملفات النهائية بعد. ستظهر هنا فور إضافتها.'
                        : 'The library is ready, but the final files have not been uploaded yet. They will appear here as soon as they are imported.'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.documents.map((document) => (
                    <Card key={document.id} className="border-emerald-100 bg-white shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <FileText className="h-5 w-5" />
                          </div>
                          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                            {document.mimeType === 'application/pdf' ? 'PDF' : (isRtl ? 'ملف' : 'File')}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-snug">
                          {isRtl ? document.titleAr : document.titleEn}
                        </CardTitle>
                        <CardDescription>
                          {(isRtl ? document.descriptionAr : document.descriptionEn) || (isRtl ? 'ملف إضافي ضمن مكتبة الدورة.' : 'Additional material included in your course library.')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>{isRtl ? 'اسم الملف' : 'File name'}: {document.originalFileName}</p>
                          <p>{isRtl ? 'الحجم' : 'Size'}: {formatFileSize(document.fileSizeBytes, isRtl)}</p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          {document.viewPath ? (
                            <Button asChild variant="outline" className="flex-1">
                              <a href={withApiBase(document.viewPath)} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                                {isRtl ? 'فتح PDF' : 'Open PDF'}
                              </a>
                            </Button>
                          ) : null}
                          <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                            <a href={withApiBase(document.downloadPath)}>
                              <Download className="h-4 w-4" />
                              {isRtl ? 'تنزيل' : 'Download'}
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </ClientLayout>
  );
}