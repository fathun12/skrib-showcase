import type { Metadata, Viewport } from "next";
import {
  Inter,
  Source_Serif_4,
  Geist_Mono,
  Noto_Naskh_Arabic,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/ui/layout/ThemeProvider";
import { HeaderLive } from "@/features/notifications/HeaderLive";
import { MobileNavSpacer } from "@/features/notifications/MobileNavSpacer";
import { Footer } from "@/ui/layout/Footer";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/features/moderation/queries";
import { getOpenReportCounts } from "@/features/moderation/counts";
import { signOut } from "@/features/auth/actions";
import { getUnreadCount } from "@/features/notifications/queries";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site";
import { SPLASH_IMAGES } from "@/lib/splash";
import { ProfileHoverCardProvider } from "@/features/profiles/ProfileHoverCardProvider";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import { ServiceWorkerRegister } from "@/features/pwa/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Only the Arabic block of a post uses this font. preload: false means no page
// asks for it up front; the browser downloads it only when Arabic letters are
// on the page.
const naskhArabic = Noto_Naskh_Arabic({
  variable: "--font-naskh-arabic",
  subsets: ["arabic"],
  preload: false,
});

export const metadata: Metadata = {
  // Lets Next.js turn relative URLs (canonical, images) into absolute ones.
  metadataBase: new URL(SITE_URL),
  title: {
    // Pages that set a plain `title` become "<title> | Skrib".
    default: "Skrib",
    template: "%s | Skrib",
  },
  description: "A calm place to read and write.",
  // The installed app on iPhone: its name and the screen shown while it opens.
  appleWebApp: {
    capable: true,
    title: "Skrib",
    statusBarStyle: "default",
    startupImage: SPLASH_IMAGES,
  },
  // iOS still reads its own tag; Next.js writes only the standard one.
  other: { "apple-mobile-web-app-capable": "yes" },
  // Note: a page that sets its own `openGraph` replaces this whole object,
  // so such pages must repeat `siteName`.
  openGraph: {
    siteName: "Skrib",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Skrib",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE],
  },
};

// Colors of the browser bar on phones; they follow the phone's own light or
// dark setting and match the --background tokens of globals.css.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F11" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const current = await getCurrentUser();
  const user = current?.profile?.username
    ? {
        displayName: current.profile.display_name,
        username: current.profile.username,
        avatarUrl: current.profile.avatar_url,
      }
    : null;

  const [unreadCount, admin] = await Promise.all([
    current && user ? getUnreadCount(current.id) : 0,
    user ? isAdmin() : false,
  ]);
  // Only an admin pays for this extra query: the open reports that wait.
  const reportCounts = admin ? await getOpenReportCounts() : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif.variable} ${geistMono.variable} ${naskhArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister userId={current?.id ?? null} />
        <ThemeProvider>
          <TooltipProvider>
            <HeaderLive
              user={user}
              signOutAction={signOut}
              unreadCount={unreadCount}
              isAdmin={admin}
              moderationCount={reportCounts?.total ?? 0}
            />
            <ProfileHoverCardProvider>
              <main className="flex-1">{children}</main>
            </ProfileHoverCardProvider>
            <Footer />
            {user ? <MobileNavSpacer /> : null}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}