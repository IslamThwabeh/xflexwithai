import type { ReactNode } from "react";
import { Link } from "wouter";
import { LogIn, Phone, X } from "lucide-react";

import { APP_LOGO, APP_TITLE } from "@/const";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type PublicMobileNavSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "ar" | "en";
  intro: string;
  loginLabel: string;
  children: ReactNode;
};

export const publicMobileNavItemClassName =
  "block rounded-2xl px-4 py-3.5 text-[1.05rem] text-gray-600 transition-all hover:bg-xf-cream hover:text-xf-dark";

export default function PublicMobileNavSheet({
  open,
  onOpenChange,
  language,
  intro,
  loginLabel,
  children,
}: PublicMobileNavSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        dir={language === "ar" ? "rtl" : "ltr"}
        className="flex h-full w-[min(88vw,22rem)] flex-col overflow-hidden border-l border-white/60 bg-white/96 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl [&>button]:hidden"
      >
        <SheetHeader className="border-b border-slate-200 px-4 pb-4 pt-5 text-start">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-auto" />
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SheetTitle className="sr-only">
            {language === "ar" ? "القائمة الرئيسية" : "Main navigation"}
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-slate-500">
            {intro}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <nav>{children}</nav>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="flex flex-col gap-2">
              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-3 text-center text-[1.05rem] font-semibold text-white transition-all hover:bg-green-600"
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </a>
              <Link href="/auth" onClick={() => onOpenChange(false)}>
                <button
                  type="button"
                  className="btn-primary-xf inline-flex w-full items-center justify-center gap-2 py-3 text-center text-[1.05rem]"
                >
                  <LogIn className="h-4 w-4" />
                  {loginLabel}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}