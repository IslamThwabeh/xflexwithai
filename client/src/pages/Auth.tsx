import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";

export default function Auth() {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="mb-8 text-center">
        <Link href="/">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors">
            {APP_TITLE}
          </h1>
        </Link>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Master the art of trading
        </p>
      </div>

      {showLogin ? <LoginForm /> : <RegisterForm />}

      <div className="mt-6 text-center">
        <Button
          variant="link"
          onClick={() => setShowLogin(!showLogin)}
          className="text-gray-600 dark:text-gray-300"
        >
          {showLogin ? (
            <>
              Don't have an account? <span className="font-semibold ml-1">Sign up</span>
            </>
          ) : (
            <>
              Already have an account? <span className="font-semibold ml-1">Sign in</span>
            </>
          )}
        </Button>
      </div>

      <div className="mt-4">
        <Link href="/">
          <Button variant="ghost" className="text-gray-600 dark:text-gray-300">
            ← Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
