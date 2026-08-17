/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` writes a full production build into the same .next/ that a
  // running `next dev` watches. Turbopack then invalidates and re-resolves
  // continuously — measured at ~450% CPU and 9GB RSS while completely idle.
  // NEXT_DIST_DIR lets a verification build write somewhere else instead.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
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

