import UserPrefrenceProvider from "@/app/contextAPI/userPrefrenceProvider";
import Footbar from "@/components/footbar/foot";
import { Toaster } from "react-hot-toast";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <AuthProvider>
    <div className="w-full flex flex-col justify-center bg-neutral-900 text-gray-300">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          success: { iconTheme: { primary: "#22c55e", secondary: "#ffffff" }, duration: 3500 },
          error: { iconTheme: { primary: "#ef4444", secondary: "#ffffff" }, duration: 5000 },
          loading: { duration: Infinity },
        }}
      />
      <UserPrefrenceProvider>
        <div className="w-full flex flex-col min-h-screen">
          <main className="grow px-3 py-2">{children}</main>
          <Footbar />
        </div>
      </UserPrefrenceProvider>
    </div>
  );
}
