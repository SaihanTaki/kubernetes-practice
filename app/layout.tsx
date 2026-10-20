import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NavLink } from "@/components/NavLink";
import { ThemeSelect, themeScript } from "@/components/ThemeSelect";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "Kubernetes Practice", template: "%s · Kubernetes Practice" },
  description: "Learn Kubernetes with diagrams, quizzes, and a simulated kubectl terminal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme before hydration, so React would otherwise warn about the mismatch.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans text-[17px] leading-7 antialiased">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 px-4 py-1 sm:px-6">
            <NavLink href="/" className="mr-auto font-semibold tracking-tight text-fg">
              Kubernetes Practice
            </NavLink>
            {/* On phones the links take their own row under the name and theme picker. */}
            <div className="order-last flex w-full gap-6 sm:order-none sm:w-auto">
              <NavLink href="/playground">Playground</NavLink>
              <NavLink href="/cheatsheet">Cheatsheet</NavLink>
            </div>
            <ThemeSelect />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t border-border">
          <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
            Practice only. The terminal is a simulator: nothing runs on a real cluster and nothing you do here is saved.
          </p>
        </footer>
      </body>
    </html>
  );
}
