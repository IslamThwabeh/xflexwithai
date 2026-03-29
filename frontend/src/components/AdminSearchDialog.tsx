import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, X, User, ShoppingCart, BookOpen, FileText, Key, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

export default function AdminSearchDialog({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  const { data, isLoading } = trpc.search.admin.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const go = (path: string) => { navigate(path); onClose(); };
  const hasResults = data && (data.users.length || data.orders.length || data.courses.length || data.articles.length || data.keys.length);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()} dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => handleChange(e.target.value)}
            placeholder={isRtl ? 'بحث عن المستخدمين، الطلبات، المفاتيح...' : 'Search users, orders, keys...'}
            className="flex-1 outline-none text-sm bg-transparent" />
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {debouncedQuery.length < 2 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isRtl ? 'اكتب حرفين على الأقل' : 'Type at least 2 characters'}
            </div>
          )}
          {debouncedQuery.length >= 2 && !isLoading && !hasResults && (
            <div className="p-6 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد نتائج' : 'No results'}</div>
          )}

          {data?.users?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'المستخدمون' : 'Users'}</p>
              {data.users.map((u: any) => (
                <button key={u.id} onClick={() => go('/admin/users')}
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

          {data?.orders?.length ? (
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

          {data?.courses?.length ? (
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

          {data?.articles?.length ? (
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

          {data?.keys?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{isRtl ? 'المفاتيح' : 'Keys'}</p>
              {data.keys.map((k: any) => (
                <button key={k.id} onClick={() => go('/admin/keys')}
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
      </div>
    </div>
  );
}
