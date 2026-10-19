import Link from "next/link";
import { chapters } from "@/content/chapters";

export default function Home() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Kubernetes Practice</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Read a chapter, run commands in a simulated kubectl terminal, and check what you learned. Nothing is saved:
        reload the page and every exercise starts fresh.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Chapters</h2>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {chapters.map((c, i) => (
          <li key={c.slug} className="flex gap-4 py-4">
            <span className="w-6 shrink-0 font-mono text-muted">{i + 1}</span>
            <div>
              {c.ready ? (
                <Link href={`/chapters/${c.slug}`} className="font-medium text-accent underline-offset-4 hover:underline">
                  {c.title}
                </Link>
              ) : (
                <span className="font-medium">
                  {c.title} <span className="text-sm font-normal text-muted">(coming soon)</span>
                </span>
              )}
              <p className="mt-1 text-sm text-muted">{c.summary}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-xl font-semibold">Practice on your own</h2>
      <p className="mt-2 text-muted">
        The <Link href="/playground" className="text-accent underline underline-offset-4">playground</Link> gives you a
        small simulated cluster to explore freely. The{" "}
        <Link href="/cheatsheet" className="text-accent underline underline-offset-4">cheatsheet</Link> lists the
        commands and manifests from the chapters.
      </p>
    </>
  );
}
