import Link from "next/link";
import { chapters, sections, type Chapter } from "@/content/chapters";

function contents(c: Chapter) {
  const { quiz, labs, diagrams } = c.data;
  return [
    `${quiz.length} questions`,
    labs.length ? `${labs.length} lab` : null,
    diagrams.length ? `${diagrams.length} diagram${diagrams.length > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function Home() {
  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-end">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Learn Kubernetes by doing it</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-muted">
            Read a chapter, work through its diagrams, then run real <code className="font-mono text-fg">kubectl</code>{" "}
            commands against a simulated cluster in your browser. Nothing to install, nothing saved: reload and every
            exercise starts fresh.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium">Already know the basics?</p>
          <p className="mt-1 text-muted">
            Open the <Link href="/playground" className="text-accent underline underline-offset-4">playground</Link> for a
            free cluster, or search the{" "}
            <Link href="/cheatsheet" className="text-accent underline underline-offset-4">cheatsheet</Link> for a
            command.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section} aria-labelledby={`section-${section}`} className="mt-14">
          <h2 id={`section-${section}`} className="text-2xl font-semibold tracking-tight">
            {section}
          </h2>
          <ol className="mt-5 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {chapters
              .filter((c) => c.section === section)
              .map((c) => {
                const n = String(chapters.indexOf(c) + 1).padStart(2, "0");
                const body = (
                  <>
                    <span className="font-mono text-sm text-muted">{n}</span>
                    <span className="mt-1 block text-lg font-medium">{c.title}</span>
                    <span className="mt-1 block text-muted">{c.summary}</span>
                    <span className="mt-3 block font-mono text-xs text-muted">
                      {c.difficulty} · {contents(c)}
                    </span>
                  </>
                );
                return (
                  <li key={c.slug} className="bg-surface sm:last:odd:col-span-2">
                    {c.ready ? (
                      <Link
                        href={`/chapters/${c.slug}`}
                        className="block h-full p-5 hover:bg-code [&>span:nth-child(2)]:text-accent"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="h-full p-5">
                        {body}
                        <span className="mt-2 block text-sm text-muted">Coming soon</span>
                      </div>
                    )}
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
    </>
  );
}
