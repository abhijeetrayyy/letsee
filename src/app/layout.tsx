import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SearchProvider } from "./contextAPI/searchContext";
import { CountryProvider } from "./contextAPI/countryContext";
import AuthProvider from "./contextAPI/AuthProvider";
import { LogedNavbar } from "@components/header/navbar";
import { ScrollToTop } from "@components/ui/ScrollToTop";
import RegisterServiceWorker from "@/components/pwa/RegisterServiceWorker";
import { siteUrl } from "@/utils/siteUrl";
import JsonLd from "@components/seo/JsonLd";
import { organisationLd } from "@/utils/structuredData";

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
  /**
   * Every relative URL in every page's metadata resolves against this.
   *
   * Without it Next cannot turn a relative OG image into the absolute URL the
   * Open Graph spec requires, and canonicals from child routes have no origin
   * to hang off. It was unset, which is why nothing shared with a preview.
   *
   * The origin comes from siteUrl(), so one place decides it — the share sheet,
   * robots, the sitemap and every canonical agree by construction.
   */
  metadataBase: new URL(siteUrl()),
  title: {
    default: "LetSee — Social Film Journal",
    // Child pages set a bare title; this gives them the brand without every
    // page having to remember to append it.
    template: "%s · LetSee",
  },
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
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Let Google show a full-size preview image and an unclipped snippet;
      // the defaults truncate both.
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
  // `data-scroll-behavior` is Next's own opt-out, and it warns at runtime
  // without it. globals.css sets `scroll-behavior: smooth` on <html>, which CSS
  // applies to *every* scroll — including the ones Next performs during a route
  // transition, so navigating between pages animates a long glide down the old
  // document instead of arriving at the top. This confines smooth scrolling to
  // in-page anchors, where it was meant to apply.
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-surface-950 text-surface-200 min-h-screen`}
      >
        {/*
          Site-level graph, emitted once for every page. The SearchAction is
          what lets a result render a search box for this site rather than only
          a link to it.
        */}
        <JsonLd data={organisationLd()} />
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
