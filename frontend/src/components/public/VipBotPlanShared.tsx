import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Link } from "wouter";

export type PlanNavLink = {
  href: string;
  label: string;
  active?: boolean;
};

export function usePlanDocumentLanguage(lang: "en" | "ar", dir: "ltr" | "rtl") {
  useEffect(() => {
    const html = document.documentElement;
    const previousLang = html.getAttribute("lang");
    const previousDir = html.getAttribute("dir");
    const previousTranslate = html.getAttribute("translate");
    const hadNoTranslateClass = html.classList.contains("notranslate");

    html.setAttribute("lang", lang);
    html.setAttribute("dir", dir);
    html.setAttribute("translate", "no");
    html.classList.add("notranslate");

    return () => {
      if (previousLang) {
        html.setAttribute("lang", previousLang);
      } else {
        html.removeAttribute("lang");
      }

      if (previousDir) {
        html.setAttribute("dir", previousDir);
      } else {
        html.removeAttribute("dir");
      }

      if (previousTranslate) {
        html.setAttribute("translate", previousTranslate);
      } else {
        html.removeAttribute("translate");
      }

      if (!hadNoTranslateClass) {
        html.classList.remove("notranslate");
      }
    };
  }, [dir, lang]);
}

export function PlanTopBar({
  navLinks,
  homeLabel,
}: {
  navLinks: PlanNavLink[];
  homeLabel: string;
}) {
  return (
    <header className="print-hide sticky top-4 z-20 mb-6 rounded-3xl border border-emerald-100/70 bg-white/92 px-4 py-3 shadow-[0_16px_40px_rgba(16,185,129,0.08)] backdrop-blur md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">
          <Globe className="h-3.5 w-3.5" />
          Business Owner Review
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
          <nav className="flex flex-wrap gap-2">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                <span
                  className={[
                    "inline-flex cursor-pointer items-center rounded-full border px-3 py-2 text-sm font-semibold transition",
                    item.active
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-emerald-100 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50",
                  ].join(" ")}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <Link href="/">
            <Button variant="outline" className="w-full gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50 sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              {homeLabel}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PlanHero({
  eyebrow,
  title,
  afterTitle,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  afterTitle?: ReactNode;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-500/12 via-teal-500/8 to-amber-400/12 p-6 shadow-[0_20px_48px_rgba(15,118,110,0.08)] md:p-8">
      <div className="max-w-4xl">
        <div className="inline-flex items-center rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-600">
          {eyebrow}
        </div>
        <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 md:text-5xl">{title}</h1>
        {afterTitle ? <div className="mt-4">{afterTitle}</div> : null}
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 md:text-base">{subtitle}</p>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export function PlanSectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</div>
      <h2 className="text-2xl font-black text-slate-900 md:text-3xl">{title}</h2>
      <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{subtitle}</p>
    </div>
  );
}