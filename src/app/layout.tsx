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
   * The origin comes from siteUrl(), so one place decides it — the share sheet
   * and every canonical agree by construction. (The sitemap that used to be the
   * third member of that sentence is deleted; see `robots.ts`.)
   */
  metadataBase: new URL(siteUrl()),

  /**
   * Not indexed, and no links followed. Applies to every page that does not
   * override it, which is all of them.
   *
   * This is the other half of `robots.txt`, and it does a different job.
   * `Disallow: /` asks a crawler not to *fetch* a URL; it does not remove a URL
   * that is already in an index, and a blocked page can still be listed from
   * inbound links alone ("no information is available for this page"). `noindex`
   * is what actually withdraws them — but a crawler has to fetch the page to
   * read the tag, which is why both exist and why the two are not redundant.
   *
   * `nofollow` matters more than it looks: it tells the crawlers that do fetch
   * pages here not to walk the title → cast → person → title graph that turned
   * into 1.24M ISR writes in three days.
   *
   * The OpenGraph and Twitter blocks below stay. They are what makes a link
   * pasted into a DM render a card, which is a real feature for real users, and
   * they cost nothing: a few hundred bytes of head, read only when somebody
   * shares a link on purpose. The same goes for the JSON-LD helpers and the
   * canonical tags — inert under `noindex`, and not worth a refactor to remove.
   */
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  // What stood here before, for whoever reverses this: index/follow true, with
  // googleBot carrying "max-image-preview": "large", "max-snippet": -1 and
  // "max-video-preview": -1 to stop Google truncating the preview card.
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
