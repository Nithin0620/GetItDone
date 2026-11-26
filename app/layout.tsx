import { authEnabled } from "@/auth";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/components/StoreProvider";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "getitdone",
  description: "A calm place for all your work.",
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
