import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ameisenwerkstatt",
    template: "%s · Ameisenwerkstatt",
  },
  description:
    "Ant colony optimisation on a fixed travelling-salesman problem, in a live 3D Werkstatt.",
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
