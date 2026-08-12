import { Suspense } from "react";
import UpdatePasswordComponent from "@components/clientComponent/update_password";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
