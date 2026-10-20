import type { Metadata } from "next";
import Link from "next/link";
import { ThemeSelect, themeScript } from "@/components/ThemeSelect";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kubernetes Practice", template: "%s · Kubernetes Practice" },
  description: "Learn Kubernetes with diagrams, quizzes, and a simulated kubectl terminal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme before hydration, so React would otherwise warn about the mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3">
            <Link href="/" className="mr-auto py-2 font-semibold">
              Kubernetes Practice
            </Link>
            <Link href="/playground" className="py-2 text-muted hover:text-fg">
              Playground
            </Link>
            <Link href="/cheatsheet" className="py-2 text-muted hover:text-fg">
              Cheatsheet
            </Link>
            <ThemeSelect />
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
