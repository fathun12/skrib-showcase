// Public base URL of the site, without a trailing slash. Used by metadata,
// the sitemap and robots. NEXT_PUBLIC_* values are baked in at build time,
// so redeploy after changing it. The `||` also covers an empty value.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");


// The default link preview image (see src/app/api/og/route.tsx).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og`;