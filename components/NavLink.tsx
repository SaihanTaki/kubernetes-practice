"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center ${className ?? (active ? "text-fg underline decoration-accent decoration-2 underline-offset-8" : "text-muted hover:text-fg")}`}
    >
      {children}
    </Link>
  );
}
