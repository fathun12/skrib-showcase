// Shared Sentry settings for the browser and the server, so the privacy choices
// live in one place.

// Page addresses in breadcrumbs (the trail of pages and requests before an
// error) can hold a query string, for example /search?q=... . The words people
// search for must not leave the site, so everything after "?" or "#" is cut.
// Keys: "url" (fetch and XHR breadcrumbs) and "from" and "to" (navigation
// breadcrumbs). Keep /privacy in sync when this changes.
const ADDRESS_KEYS = ["url", "from", "to"];

function withoutQuery(address: string): string {
  return address.split(/[?#]/, 1)[0];
}

function cutAddressQueries<T extends { data?: Record<string, unknown> }>(
  breadcrumb: T,
): T {
  const data = breadcrumb.data;
  if (!data) return breadcrumb;

  const cleaned: Record<string, unknown> = { ...data };
  for (const key of ADDRESS_KEYS) {
    const value = cleaned[key];
    if (typeof value === "string") cleaned[key] = withoutQuery(value);
  }
  return { ...breadcrumb, data: cleaned };
}

export const sentryOptions = {
  // Without a DSN the SDK sends nothing.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only report from a production build, so local development does not use up
  // the free quota.
  enabled: process.env.NODE_ENV === "production",

  // Errors only: no tracing (no tracesSampleRate), no replay, and we never call
  // Sentry.logger, so no logs are sent either.

  // Send as little personal data as possible (keep /privacy in sync).
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },

  // No query strings in the page addresses of breadcrumbs.
  beforeBreadcrumb: cutAddressQueries,
};