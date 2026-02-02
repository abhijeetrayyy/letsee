"use client";

import LoginForm from "@/components/login/loginform";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function LoginPageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/app");
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const statusParam = searchParams.get("status");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
    if (statusParam === "check-email") {
      setInfo("Check your email to confirm your account.");
    }
  }, [searchParams]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/app");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full bg-neutral-700 flex justify-center p-4">
        <Link className="max-w-6xl w-full m-auto text-gray-100" href="/app">
          Let&apos;see
        </Link>
      </div>
      <LoginForm
        onLogin={login}
        loading={loading}
        error={error}
        info={info}
      />
    </>
  );
}
