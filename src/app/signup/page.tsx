import { Suspense } from "react";
import SignupPageClient from "./SignupPageClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/**
 * Not for an index. robots.txt asks a crawler not to fetch this; `noindex` says
 * what to do if one arrives anyway — from a pasted link, a referrer, or a
 * crawler that ignores the file. Belt and braces on pages that are either
 * private or pure funnel.
 */
export const metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};


function SignupLoading() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-900 text-white">
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-surface-400">Loading…</p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupPageClient />
    </Suspense>
  );
}
