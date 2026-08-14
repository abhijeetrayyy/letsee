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
};

export default nextConfig;

