import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/**
 * Not for an index. robots.txt asks a crawler not to fetch this; `noindex` says
 * what to do if one arrives anyway — from a pasted link, a referrer, or a
 * crawler that ignores the file. Belt and braces on pages that are either
 * private or pure funnel.
 */
export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};


function LoginLoading() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-950 text-white">
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-surface-400">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageClient />
    </Suspense>
  );
}
