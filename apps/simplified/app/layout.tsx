import type { Metadata } from "next";
import { Literata, Noto_Sans_SC, Syne } from "next/font/google";

import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// CJK via next/font: do not preload (split across many files). Omitting
// latin-only subsets so simplified glyphs like 汉字入门 are included.
const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  variable: "--font-hanzi",
  display: "swap",
  preload: false,
  fallback: [
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Noto Sans CJK SC",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "Simplified — learn Chinese characters",
  description: "A calm path into simplified Chinese: start with radicals and common components.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${literata.variable} ${notoSansSc.variable}`}>
        {children}
      </body>
    </html>
  );
}
