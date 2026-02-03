import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function LoginLoading() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-950 text-white">
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="text-sm text-neutral-400">Loading…</p>
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
