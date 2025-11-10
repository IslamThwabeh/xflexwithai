import { LoginForm } from "@/components/LoginForm";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";
import { GraduationCap } from "lucide-react";

export default function AdminLogin() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="mb-8 text-center">
        <Link href="/">
          <div className="flex items-center gap-2 justify-center cursor-pointer hover:opacity-80 transition-opacity mb-4">
            <GraduationCap className="h-10 w-10 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">
              {APP_TITLE}
            </h1>
          </div>
        </Link>
        <p className="text-slate-300">
          Admin Portal
        </p>
      </div>

      <LoginForm isAdmin={true} />

      <div className="mt-6">
        <Link href="/">
          <button className="text-slate-400 hover:text-white transition-colors">
            ← Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
