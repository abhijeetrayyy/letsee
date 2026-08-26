/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` writes a full production build into the same .next/ that a
  // running `next dev` watches. Turbopack then invalidates and re-resolves
  // continuously — measured at ~450% CPU and 9GB RSS while completely idle.
  // NEXT_DIST_DIR lets a verification build write somewhere else instead.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,

  /**
   * The client router cache, which Next ships switched off.
   *
   * `staleTimes.dynamic` defaults to **0**, and that default is the reason a
   * back-button press costs money here. Every dynamically-rendered route —
   * `/app/browse`, `/app/profile/[id]`, `/app/watchlist`, `/app/tonight`, the
   * whole signed-in half of the product — has its RSC payload thrown away the
   * instant you navigate off it. Going film → back → film → back is four full
   * renders of two pages, not two.
   *
   * 30 seconds is the length of a single browsing gesture: open a title from a
   * grid, decide, come back. Inside that window Back is served from memory —
   * instant, and free. Outside it, nothing changes.
   *
   * This is one of the rare settings that makes the product *faster* and
   * cheaper at once, which is why it is set conservatively rather than high:
   * the ceiling on staleness is 30s of server-rendered data, and almost
   * nothing here depends on that. Everything that must be live — ratings,
   * watchlist state, the room, unread counts — is client-fetched through SWR
   * and revalidated by `mutate()`, which the router cache does not touch.
   * The two `router.refresh()` call sites (sign-out, taste edit) clear this
   * cache explicitly, so neither can serve a stale page.
   *
   * `static: 300` does the same for prefetched `<Link prefetch>` payloads on
   * the cached title pages, whose content already has a 24h revalidate — a
   * five-minute client window cannot make them staler than they are.
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },


  /**
   * Security headers. There were none at all.
   *
   * Everything here is enforced except the full Content-Security-Policy, and
   * that split is deliberate.
   *
   * **Enforced**, because none of it can break a working page:
   *   - `frame-ancestors 'none'` plus X-Frame-Options: this app renders inside
   *     no one's iframe, and the pages behind auth carry one-click destructive
   *     controls — the Danger Zone, Leave club, unfollow — which is exactly
   *     what clickjacking is for.
   *   - nosniff: several routes hand back user-supplied text; a browser that
   *     guesses at content type turns a stored string into a stored script.
   *   - Referrer-Policy: a profile URL contains a username, and the default
   *     policy leaks the full path to every image host and outbound link. TMDB
   *     does not need to know whose profile you were reading.
   *   - HSTS: preload is deliberately NOT set. It is close to irreversible and
   *     that is the operator's decision, not this file's.
   *
   * **Report-Only** for the real policy, because a wrong CSP is an outage and
   * this one cannot be validated from here. Next inlines bootstrap script and
   * style, so a strict policy needs per-request nonces, which `headers()`
   * cannot produce — that is middleware work. Report-Only costs nothing, breaks
   * nothing, and turns "we think this is right" into a list of what actually
   * violates it. Promote it to `Content-Security-Policy` once the console is
   * quiet.
   *
   * The allowances are the app's real dependencies: TMDB for every poster,
   * Supabase over https and wss for REST and realtime, and YouTube frames for
   * the trailer shelves on five surfaces.
   *
   * `img.youtube.com` is in that list because Report-Only put it there. The
   * first draft allowed only `i.ytimg.com`, which is the host everyone assumes
   * serves YouTube thumbnails; the shelves actually request
   * `img.youtube.com/vi/<id>/mqdefault.jpg`. Enforced, that draft would have
   * blanked every trailer thumbnail on every title page.
   */
  async headers() {
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseWs = supabase.replace(/^https:/, "wss:");

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https://image.tmdb.org https://*.supabase.co https://i.ytimg.com https://img.youtube.com",
      "media-src 'self' https://*.supabase.co",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      `connect-src 'self' ${supabase} ${supabaseWs} https://api.themoviedb.org`.trim(),
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Enforced, and safe to enforce: frame-ancestors is unaffected by the
          // inline-script problem that keeps the rest in Report-Only.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },

  /**
   * The genre routes became /app/browse.
   *
   * These URLs are in people's history and in the wild, and the ids carry over
   * unchanged — a genre id is a genre id — so a redirect costs one line and
   * keeps every one of them working. The `-Name` suffix the old scroller
   * appended (`/list/16-Animation`) has to be matched and dropped, which is
   * what the second capture is for.
   *
   * Permanent, because the old routes are gone rather than moved temporarily.
   */
  async redirects() {
    return [
      {
        source: "/app/moviebygenre/list/:id(\\d+):rest(-.*)?",
        destination: "/app/browse?genre=:id",
        permanent: true,
      },
      {
        source: "/app/tvbygenre/list/:id(\\d+):rest(-.*)?",
        destination: "/app/browse?type=tv&genre=:id",
        permanent: true,
      },
      { source: "/app/moviebygenre/:path*", destination: "/app/browse", permanent: true },
      { source: "/app/tvbygenre/:path*", destination: "/app/browse?type=tv", permanent: true },
    ];
  },
};

export default nextConfig;

