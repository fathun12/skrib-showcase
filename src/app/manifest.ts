import type { MetadataRoute } from "next";

// The web app manifest: what makes Skrib installable on a phone.
// Next.js serves it at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Skrib",
    short_name: "Skrib",
    description: "A calm place to read and write.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}