import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WebsiteStructuredData, OrganizationStructuredData } from "@/components/StructuredData";

// Initialize backend services (scheduler, WebSocket server, database)
if (typeof window === 'undefined') {
  import('../lib/startup')
  import('../lib/init')
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StreamingRange - Discover Hot & Trending Golf Content",
  description: "Discover hot and trending golf videos, highlights, and instruction content from YouTube creators. AI-curated golf streaming platform with audio summaries.",
  keywords: "golf videos, trending golf content, golf highlights, golf instruction, golf viral videos, golf discovery, best golf videos",
  authors: [{ name: "StreamingRange" }],
  creator: "StreamingRange",
  publisher: "StreamingRange",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://streamingrange.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "StreamingRange - Hot & Trending Golf Content",
    description: "Discover hot and trending golf videos, highlights, and instruction content from YouTube creators. AI-curated streaming platform with audio summaries.",
    url: 'https://streamingrange.com',
    siteName: 'StreamingRange',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'StreamingRange - Trending Golf Videos',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "StreamingRange - Hot & Trending Golf Content",
    description: "Discover hot and trending golf videos from YouTube creators. AI-curated streaming platform with audio summaries.",
    images: ['/og-image.jpg'],
    creator: '@streamingrange',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <WebsiteStructuredData />
        <OrganizationStructuredData />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
