import type { MetadataRoute } from "next";
import { siteUrl } from "@/utils/siteUrl";

/**
 * There was no robots.txt at all, which for a social product is not neutral —
 * a crawler with no guidance indexes the sign-up form and the password reset
 * page as readily as a film page, and follows every `/api/` link it finds.
 *
 * Allowed: the landing page and everything a signed-out visitor can genuinely
 * read — titles, people, browse, public profiles, lists, reviews, clubs.
 *
 * Disallowed splits into two kinds:
 *   - private surfaces (messages, notifications, onboarding, import, admin)
 *     which 401 or redirect anyway, but should not be in an index; and
 *   - `/api/`, which is not a document tree and where several routes are
 *     deliberately expensive to serve.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/update-password",
          "/app/messages",
          "/app/notification",
          "/app/welcome",
          "/app/profile/setup",
          "/app/import",
          "/app/quick-add",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
