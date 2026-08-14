"use client";

import SignupForm from "@/components/signup/signupForm";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignupPageClient() {
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

  const signup = async (email: string, password: string) => {
    setLoading(true);
    setError("");
    setInfo("");

    // Explicit emailRedirectTo: without it Supabase falls back to the
    // project's Site URL, so a confirmation link would point at whatever that
    // happens to be rather than the domain the person signed up on.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/welcome`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.push("/app/welcome");
      return;
    }
    setInfo("Check your email to confirm your account.");
    setLoading(false);
  };

  return (
    <SignupForm
      onSignup={signup}
      loading={loading}
      error={error}
      info={info}
    />
  );
}
