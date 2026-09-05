import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/src/features/auth/context/AuthContext";
import { AppHeader } from "@/src/components/AppHeader";
import { Footer } from "@/src/components/Footer";
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
      <body className="flex min-h-[100dvh] flex-col">
        <ServiceWorkerRegistration />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Aller au contenu
        </a>
        <AuthProvider>
          <AppHeader />
          {/* pb-[calc(4.5rem+env(safe-area-inset-bottom))] clears MobileTabBar's
              fixed height (py-2.5 + icon + label ≈ 4.5rem) plus its own
              safe-area padding, so page content isn't hidden under the bar;
              lg:pb-0 since the bar itself is lg:hidden. */}
          <main
            id="contenu"
            className="flex flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
          >
            {children}
          </main>
          {/* Hidden below lg: MobileTabBar owns that space, and a footer
              squeezed above a fixed tab bar on every screen reads as
              cluttered. The same links live in ProfileLegalLinks instead,
              reachable without lg's screen real estate via /profile and
              /login. */}
          <Footer className="hidden lg:block" />
          <MobileTabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
