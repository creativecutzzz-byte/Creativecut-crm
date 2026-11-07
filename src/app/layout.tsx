import type { Metadata, Viewport } from "next";
import { Bebas_Neue } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Brand fonts (same as creativecut website): Satoshi for text, Bebas Neue for big headings.
const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-400.woff2", weight: "400" },
    { path: "./fonts/Satoshi-500.woff2", weight: "500" },
    { path: "./fonts/Satoshi-700.woff2", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Creative Cut CRM", template: "%s · Creative Cut CRM" },
  description: "AI-powered CRM for the Creative Cut agency.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${satoshi.variable} ${bebas.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
