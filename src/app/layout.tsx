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
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LetSee — Social Film Journal",
  description:
    "Track what you watch. Write reviews. Share with friends. Your personal film journal and social hub for cinephiles.",
  keywords: [
    "movies",
    "film",
    "reviews",
    "watchlist",
    "cinephile",
    "social",
    "TV shows",
    "ratings",
    "diary",
  ],
  authors: [{ name: "Abhijeet Ray", url: "https://github.com/abhijeetrayy" }],
  creator: "Abhijeet Ray",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "LetSee",
    title: "LetSee — Social Film Journal",
    description:
      "Track what you watch. Write reviews. Share with friends. Your personal film journal for cinephiles.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LetSee — Social Film Journal",
    description:
      "Track what you watch. Write reviews. Share with friends.",
  },
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-surface-950 text-surface-200 min-h-screen`}
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
