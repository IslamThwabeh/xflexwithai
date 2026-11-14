import { useState, useRef, useEffect, type FormEvent } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, X, User, ShoppingCart, BookOpen, FileText, Key, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export default function AdminSearchDialog({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Record search can scan several tables. Only explicit submissions may run it;
  // page search stays local and must never enable this query while typing.
  const { data, isFetching, isError, isSuccess, refetch } = trpc.search.admin.useQuery(
    { query: submittedQuery },
    {
      enabled: submittedQuery.length >= 2,
      staleTime: 5 * 60_000,
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    }
  );
  const normalizedQuery = query.trim();
  const isDraft = normalizedQuery !== submittedQuery;
  const showResults = submittedQuery.length >= 2 && !isDraft && !isError;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (normalizedQuery.length < 2 || isFetching) return;
    // A deliberate repeat submit refreshes the results (and retries failures).
    if (normalizedQuery === submittedQuery) void refetch();
    else setSubmittedQuery(normalizedQuery);
  };

  const go = (path: string) => { navigate(path); onClose(); };
  const hasResults = data && (data.users.length || data.orders.length || data.courses.length || data.articles.length || data.keys.length);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg overflow-hidden p-0 [&>button]:hidden" dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className="sr-only">{isRtl ? 'البحث في السجلات' : 'Search records'}</DialogTitle>
        <DialogDescription className="sr-only">{isRtl ? 'ابحث عن مستخدم أو طلب أو دورة أو مقال أو مفتاح.' : 'Find a user, order, course, article or key.'}</DialogDescription>
        <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input ref={inputRef} type="text" maxLength={200} aria-label={isRtl ? 'البحث في السجلات' : 'Search records'} value={query} onChange={e => setQuery(e.target.value)}
            placeholder={isRtl ? 'بحث عن المستخدمين، الطلبات، المفاتيح...' : 'Search users, orders, keys...'}
            className="min-w-0 flex-1 outline-none text-sm bg-transparent" />
          <button type="submit" disabled={normalizedQuery.length < 2 || isFetching} className="shrink-0 rounded bg-primary px-3 py-3 text-sm text-primary-foreground disabled:opacity-50">
            {isFetching ? <Loader2 aria-label={isRtl ? 'جارٍ البحث' : 'Searching'} className="w-4 h-4 animate-spin" /> : isRtl ? 'بحث' : 'Search'}
          </button>
          <button type="button" onClick={onClose} aria-label={isRtl ? 'إغلاق' : 'Close'} className="p-3 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </form>

        <div className="max-h-[50vh] overflow-y-auto">
          {(!submittedQuery || isDraft) && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isRtl ? 'اكتب حرفين على الأقل، ثم اضغط بحث أو Enter.' : 'Type at least 2 characters, then press Search or Enter.'}
            </div>
          )}
          {!isDraft && isError && (
            <p role="alert" className="p-6 text-center text-sm text-destructive">{isRtl ? 'تعذّر البحث. اضغط بحث للمحاولة مجددًا.' : 'Search failed. Press Search to try again.'}</p>
          )}
          {showResults && isSuccess && !isFetching && !hasResults && (
            <div className="p-6 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد نتائج' : 'No results'}</div>
          )}

          {showResults && data?.users?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'المستخدمون' : 'Users'}</p>
              {data.users.map((u: any) => (
                <button key={u.id} onClick={() => go('/admin/students')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <User className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{u.name || u.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {showResults && data?.orders?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'الطلبات' : 'Orders'}</p>
              {data.orders.map((o: any) => (
                <button key={o.id} onClick={() => go('/admin/orders')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <ShoppingCart className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm">#{o.id} — {o.status}</span>
                </button>
              ))}
            </div>
          ) : null}

          {showResults && data?.courses?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'الدورات' : 'Courses'}</p>
              {data.courses.map((c: any) => (
                <button key={c.id} onClick={() => go('/admin/courses')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? c.titleAr : c.titleEn}</span>
                </button>
              ))}
            </div>
          ) : null}

          {showResults && data?.articles?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'المقالات' : 'Articles'}</p>
              {data.articles.map((a: any) => (
                <button key={a.id} onClick={() => go('/admin/articles')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? a.titleAr : a.titleEn}</span>
                </button>
              ))}
            </div>
          ) : null}

          {showResults && data?.keys?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'المفاتيح' : 'Keys'}</p>
              {data.keys.map((k: any) => (
                <button key={k.id} onClick={() => go('/admin/package-keys')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <Key className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-mono truncate">{k.keyCode}</div>
                    {k.email && <div className="text-xs text-muted-foreground truncate">{k.email}</div>}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center">Esc</div>
      </DialogContent>
    </Dialog>
  );
}
