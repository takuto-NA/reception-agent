import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reception Agent",
  description: "Mastra-based agent playground",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
          <header className="border-b border-zinc-200/70 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black/40">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold tracking-tight">
                Reception Agent
              </Link>
              <nav className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <Link
                  href="/"
                  className="rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  Chat
                </Link>
                <Link
                  href="/settings"
                  className="rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  Settings
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
