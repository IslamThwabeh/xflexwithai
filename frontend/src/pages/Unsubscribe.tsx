import { useEffect, useMemo } from "react";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Unsubscribe() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);
  const unsubscribe = trpc.emailPreferences.unsubscribe.useMutation();

  useEffect(() => {
    if (token && unsubscribe.status === "idle") {
      unsubscribe.mutate({ token });
    }
  }, [token, unsubscribe]);

  const isLoading = !!token && (unsubscribe.status === "idle" || unsubscribe.isPending);
  const isSuccess = unsubscribe.isSuccess;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <section className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
          {isLoading ? (
            <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          ) : (
            <MailX className="h-7 w-7 text-red-500" />
          )}
        </div>

        <h1 className="text-3xl font-bold">
          {isLoading
            ? "Updating your email preference"
            : isSuccess
              ? "You are unsubscribed"
              : "Unsubscribe link unavailable"}
        </h1>

        <p className="mt-4 text-base leading-7 text-slate-600">
          {isLoading
            ? "Please wait while we confirm your request."
            : isSuccess
              ? "You will no longer receive renewal, lifecycle, or marketing reminder emails from XFlex Academy. Important account, login, payment, and security emails may still be sent."
              : "This link is invalid or incomplete. You can still contact support from inside the platform if you need help with email preferences."}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
          <Link href="/support">
            <Button className="bg-emerald-600 hover:bg-emerald-700">Contact Support</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
