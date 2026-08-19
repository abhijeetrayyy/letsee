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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- useSearchParams resolves on the client; deriving in render would flash the wrong state
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
    /**
     * One message, whichever case this is — and it has to name both.
     *
     * When the address already has an account, Supabase returns SUCCESS with
     * no session and sends no mail. That is deliberate: a different response
     * for a known address would let anyone probe which emails are registered,
     * which on a site with private profiles is a real leak. But the screen
     * then told people to check an inbox nothing was ever sent to, and the
     * only way to discover the truth was to guess and try logging in — which
     * is exactly what happened.
     *
     * `data.user.identities` is empty in that case, and it is deliberately NOT
     * read here. Branching on it would restore the enumeration hole in the UI
     * after the API closed it. Instead the copy covers both outcomes, so it is
     * true either way and neither leaves anybody waiting.
     */
    setInfo(
      "If that email is new, a confirmation link is on its way. If you already have an account, sign in instead.",
    );
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
