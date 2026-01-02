import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartLens",
  description: "AI駆動型の教育機関向け組織運営プラットフォーム",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Lens",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import Link from "next/link";
// ... imports

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="T-kSMcQeQ7Okxyr3b24mvT8wfjj1m9C7KdkGhmZRf3k" />
        {/* Google Analytics - Manual Injection for Verification */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-8J4WFQMKLQ"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8J4WFQMKLQ');
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-100`}>
        <ClientLayout>
            {children}
        </ClientLayout>
      </body>
    </html>
  );
}

