import { Link } from 'wouter';
import { MessageSquare } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { usePageVisible } from '@/hooks/usePageVisible';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';

export default function LiveExpertEntry() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const visible = usePageVisible();
  const workspace = trpc.liveExpert.myWorkspace.useQuery(undefined, { retry: false, refetchInterval: visible ? 30000 : false, refetchIntervalInBackground: false });
  return <Link href="/live-package/messages" className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 hover:bg-emerald-100">
    <div><h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-5 w-5" />{isAr ? 'راسل خبير لايف' : 'Message your Live Expert'}</h2><p className="mt-2 text-sm">{isAr ? 'اسأل خبيرك عن الدروس واللقاءات في محادثتك الخاصة.' : 'Ask your expert about lessons and classes in your private conversation.'}</p></div>
    {workspace.data?.unread ? <Badge>{workspace.data.unread} {isAr ? 'جديد' : 'new'}</Badge> : null}
  </Link>;
}
