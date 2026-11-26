import { authEnabled } from "@/auth";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/components/StoreProvider";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const siteUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "getitdone",
    template: "%s · getitdone",
  },
  description: "A calm place for tasks, focus sessions, goals, notes and web-time insights.",
  applicationName: "getitdone",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "getitdone",
    description: "A calm place for all your work.",
    type: "website",
    url: siteUrl,
    siteName: "getitdone",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <StoreProvider>
            <AppShell authEnabled={authEnabled}>{children}</AppShell>
          </StoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
