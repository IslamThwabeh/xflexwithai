import { useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, X, BookOpen, Package, FileText, Calendar, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

export default function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  const { data, isLoading } = trpc.search.public.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const go = (path: string) => { navigate(path); onClose(); };

  const hasResults = data && (data.courses.length || data.packages.length || data.articles.length || data.events.length);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={isRtl ? 'ابحث عن الدورات، الباقات، المقالات...' : 'Search courses, packages, articles...'}
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {debouncedQuery.length < 2 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isRtl ? 'اكتب حرفين على الأقل للبحث' : 'Type at least 2 characters to search'}
            </div>
          )}

          {debouncedQuery.length >= 2 && !isLoading && !hasResults && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isRtl ? 'لا توجد نتائج' : 'No results found'}
            </div>
          )}

          {data?.courses?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {isRtl ? 'الدورات' : 'Courses'}
              </p>
              {data.courses.map((c: any) => (
                <button key={c.id} onClick={() => go(`/course/${c.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? c.titleAr : c.titleEn}</span>
                </button>
              ))}
            </div>
          ) : null}

          {data?.packages?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {isRtl ? 'الباقات' : 'Packages'}
              </p>
              {data.packages.map((p: any) => (
                <button key={p.id} onClick={() => go(`/packages/${p.slug}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <Package className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? p.nameAr : p.nameEn}</span>
                </button>
              ))}
            </div>
          ) : null}

          {data?.articles?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {isRtl ? 'المقالات' : 'Articles'}
              </p>
              {data.articles.map((a: any) => (
                <button key={a.id} onClick={() => go(`/articles/${a.slug}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <FileText className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? a.titleAr : a.titleEn}</span>
                </button>
              ))}
            </div>
          ) : null}

          {data?.events?.length ? (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {isRtl ? 'الفعاليات' : 'Events'}
              </p>
              {data.events.map((e: any) => (
                <button key={e.id} onClick={() => go('/events')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-start">
                  <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm truncate">{isRtl ? e.titleAr : e.titleEn}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center">
          {isRtl ? 'اضغط Esc للإغلاق' : 'Press Esc to close'}
        </div>
      </div>
    </div>
  );
}
