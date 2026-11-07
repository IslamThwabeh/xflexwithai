import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ClientGuideLibrary from './ClientGuideLibrary';
import type { ClientGuideTopic } from '@shared/clientGuides';

export default function ClientGuideHelpButton({ topic }: { topic: ClientGuideTopic }) {
  const { language, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const ar = language === 'ar';
  const title = topic === 'lexai'
    ? (ar ? 'شرح استخدام LexAI' : 'How to use LexAI')
    : (ar ? 'شرح استخدام التوصيات' : 'How to use Recommendations');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="shrink-0 border-emerald-200 bg-white text-emerald-800"><PlayCircle className="h-4 w-4" />{title}</Button></DialogTrigger>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} closeLabel={ar ? 'إغلاق الشرح' : 'Close guide'} className="max-h-[92svh] overflow-y-auto bg-slate-50 p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader className="pr-8 text-start">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{ar ? 'اختر شرحاً للمشاهدة. يمكنك إغلاق النافذة والعودة إلى نفس مكانك.' : 'Choose a guide to watch. Close this window to return to your work.'}</DialogDescription>
        </DialogHeader>
        {open && <ClientGuideLibrary initialTopic={topic} compact />}
      </DialogContent>
    </Dialog>
  );
}
