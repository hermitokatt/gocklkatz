import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Arbeitsmarkt",
    template: "%s · Arbeitsmarkt",
  },
  description:
    "Arbeitsmarkt — a job-listing pipeline demo that presents the system using synthetic data.",
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
