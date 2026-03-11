// Root layout with Geist Mono font, dark theme
// Base wrapper for all pages

import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "GHWars - GitHub Coding Competition",
  description:
    "Compete with developers worldwide. Track your daily code output and climb the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
