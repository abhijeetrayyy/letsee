import { Suspense } from "react";
import SignupPageClient from "./SignupPageClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function SignupLoading() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-900 text-white">
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-neutral-400">Loading…</p>
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
