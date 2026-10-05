import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

import { CountryProvider } from "./contextAPI/countryContext";
import AuthProvider from "./contextAPI/AuthProvider";
import { ShellBars } from "@components/ds/Shell";
import { ScrollToTop } from "@components/ui/ScrollToTop";
import RegisterServiceWorker from "@/components/pwa/RegisterServiceWorker";
import { siteUrl } from "@/utils/siteUrl";
import JsonLd from "@components/seo/JsonLd";
import { organisationLd } from "@/utils/structuredData";
import NavigationProgress from "@components/ui/NavigationProgress";
import PendingNavigation from "@components/ui/PendingNavigation";
import FairUseNotice from "@components/ui/FairUseNotice";
import { Suspense } from "react";
import { TOKENS } from "@/design/tokens";
import { THEME_SCRIPT } from "@/lib/theme";
import { Toaster } from "react-hot-toast";
import SwrProvider from "@/components/providers/SwrProvider";
import MediaInteractionProvider from "./contextAPI/MediaInteractionProvider";
import UserPrefrenceProvider from "./contextAPI/userPrefrenceProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The voice: titles of films and series, page titles, and (in italic) the
 * words people write. docs/design/SYSTEM.md §2. Only the `opsz` axis is added,
 * so 20 px section heads and 56 px heroes come from one file.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
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
  themeColor: TOKENS.page,
  width: "device-width",
  initialScale: 1,
  // No maximumScale: pinch-zoom is how people with low vision read a page
  // (WCAG 1.4.4). iOS's zoom on focusing a small field is stopped instead by
  // keeping phone inputs at 16 px (globals.css).
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
  //
  // The font variables sit on <html>, not <body>: Tailwind's font tokens
  // (--font-sans, --font-mono, --font-display) are declared on :root and
  // resolve var() there. With the variables one level down they resolved to
  // nothing, and every page fell back to the system font.
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Light by default; a saved dark choice is applied before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="font-sans antialiased bg-page text-ink-200 min-h-screen"
      >
        {/*
          Site-level graph, emitted once for every page. The SearchAction is
          what lets a result render a search box for this site rather than only
          a link to it.
        */}
        <JsonLd data={organisationLd()} />
        <RegisterServiceWorker />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <AuthProvider>
          <CountryProvider>
            {/*
              Here rather than in the /app layout: the bars are in this layout,
              and Log it from the bars logs through the same preferences (its
              Undo puts a title's status back) and toasts as every page does.
              Below /app they were out of reach, so the sheet's rows saw empty
              defaults — and pages outside /app had no toasts at all. None of
              these fetch anything without a session.
            */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                success: { iconTheme: { primary: TOKENS.action, secondary: TOKENS.onAction }, duration: 3500 },
                error: { iconTheme: { primary: TOKENS.danger, secondary: TOKENS.ink0 }, duration: 5000 },
                loading: { duration: Infinity },
              }}
            />
            <SwrProvider>
              <MediaInteractionProvider>
                <UserPrefrenceProvider>
                  <ScrollToTop />
                  <ShellBars />
                  {/* The one <main> on every page, and where the skip link lands. */}
                  <main id="content" tabIndex={-1} className="scroll-mt-14 focus:outline-none md:scroll-mt-16">
                    {children}
                  </main>
                  {/* The next page's shape while a tapped link's page loads. */}
                  <PendingNavigation />
                  {/* "Slow down" in a sentence when the site asks (lib/limits). */}
                  <FairUseNotice />
                </UserPrefrenceProvider>
              </MediaInteractionProvider>
            </SwrProvider>
          </CountryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
