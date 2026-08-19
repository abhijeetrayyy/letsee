import { Suspense } from "react";
import UpdatePasswordComponent from "@components/clientComponent/update_password";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/**
 * Not for an index. robots.txt asks a crawler not to fetch this; `noindex` says
 * what to do if one arrives anyway — from a pasted link, a referrer, or a
 * crawler that ignores the file. Belt and braces on pages that are either
 * private or pure funnel.
 */
export const metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};


function UpdatePasswordFallback() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-950">
      <LoadingSpinner size="lg" className="border-t-white" />
      <p className="mt-4 text-sm text-surface-400">Loading…</p>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordComponent />
    </Suspense>
  );
}
