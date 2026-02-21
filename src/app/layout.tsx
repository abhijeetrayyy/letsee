import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SearchProvider } from "./contextAPI/searchContext";
import { CountryProvider } from "./contextAPI/countryContext";
import AuthProvider from "./contextAPI/AuthProvider";
import { LogedNavbar } from "@components/header/navbar";
import { ScrollToTop } from "@components/ui/ScrollToTop";
import RegisterServiceWorker from "@/components/pwa/RegisterServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Let's see",
  description: "A social media platform for movie lovers",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RegisterServiceWorker />
        <AuthProvider>
          <SearchProvider>
            <CountryProvider>
              <ScrollToTop />
              <LogedNavbar />
              {children}
            </CountryProvider>
          </SearchProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
