import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Software Factory Demo",
    template: "%s · Software Factory",
  },
  description: "Software Factory Demo #1 — Ameisenfabrik live ACO, DualAB-A façade, Origin→Vercel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
