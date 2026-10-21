import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.aurele.pk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aurelé",
  description: "Aurelé fine jewelry. Aurele.",
  openGraph: {
    title: "Aurelé",
    description: "Quiet pieces, made to be worn every day.",
    siteName: "Aurelé",
    type: "website",
    images: [{ url: "/tiles/elegance-earrings.jpg", alt: "Aurelé" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurelé",
    description: "Quiet pieces, made to be worn every day.",
    images: ["/tiles/elegance-earrings.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
