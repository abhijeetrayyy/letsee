"use client";

import LoginForm from "@/components/login/loginform";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginForm
      onLogin={login}
      loading={loading}
      error={error}
      info={info}
    />
  );
}
