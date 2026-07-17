import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppShell from "@/components/AppShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Home Inventory",
  description: "Household inventory, restock planning, and an assistant that knows the shelves.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Home Inventory",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A3C5E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${plexMono.variable}`}>
      <body className="font-body min-h-screen bg-bg text-ink antialiased">
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
