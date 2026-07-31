import UserPrefrenceProvider from "@/app/contextAPI/userPrefrenceProvider";
import MediaInteractionProvider from "@/app/contextAPI/MediaInteractionProvider";
import Footbar from "@/components/footbar/foot";
import { Toaster } from "react-hot-toast";
import SwrProvider from "@/components/providers/SwrProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex flex-col justify-center bg-surface-950 text-surface-300">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#ffffff" },
            duration: 3500,
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
            duration: 5000,
          },
          loading: { duration: Infinity },
        }}
      />
      <SwrProvider>
        <MediaInteractionProvider>
          <UserPrefrenceProvider>
            <div className="w-full flex flex-col min-h-screen">
              <main className="grow">{children}</main>
              <Footbar />
            </div>
          </UserPrefrenceProvider>
        </MediaInteractionProvider>
      </SwrProvider>
    </div>
  );
}
