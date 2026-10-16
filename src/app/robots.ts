import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Disallow rules match by prefix, so only paths that cannot clash with a
// username are listed (a rule for "/me" would also block /mercury). The
// private pages behind login (/settings, /onboarding) are not linked for
// signed-out visitors and redirect to /login anyway; robots.txt is not a
// security measure.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/write/", "/me/", "/auth/", "/admin/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}