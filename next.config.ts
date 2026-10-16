import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Only these hosts may be optimized by next/image:
// - OUR Cloudinary account (path limited to the cloud name)
// - Google profile photos (the host and path seen in real profiles data)
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  // Send title, description and canonical in <head> for every visitor
  // instead of streaming them after the body.
  htmlLimitedBots: /.*/,
  // The service worker file must never be cached by the browser or the CDN,
  // or visitors could keep running an old copy after a deploy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          // Same policy as the Next.js PWA guide: the worker loads nothing foreign.
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      ...(cloudName
        ? [
            {
              protocol: "https" as const,
              hostname: "res.cloudinary.com",
              pathname: `/${cloudName}/**`,
            },
          ]
        : []),
      {
        protocol: "https" as const,
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "raw-ii",
  project: "javascript-nextjs",
  silent: !process.env.CI,
});