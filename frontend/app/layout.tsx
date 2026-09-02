import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/src/features/auth/context/AuthContext";
import { AppHeader } from "@/src/components/AppHeader";
import { MobileTabBar } from "@/src/components/MobileTabBar";
import { ServiceWorkerRegistration } from "@/src/components/ServiceWorkerRegistration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UrbanFlow Mobility",
  description: "Planificateur d'itinéraires multimodal pour Montpellier Méditerranée Métropole",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UrbanFlow",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a5f" },
    { media: "(prefers-color-scheme: dark)", color: "#3b6ea5" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Aller au contenu
        </a>
        <AuthProvider>
          <AppHeader />
          {/* pb-16 clears MobileTabBar's own height (py-2.5 content + icon +
              label ≈ 4rem) so the last bit of page content isn't hidden
              under it; lg:pb-0 since the bar itself is lg:hidden. */}
          <main id="contenu" className="flex flex-1 flex-col pb-16 lg:pb-0">
            {children}
          </main>
          <MobileTabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
