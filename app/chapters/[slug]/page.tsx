import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chapters } from "@/content/chapters";

const content: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  intro: () => import("@/content/chapters/intro.mdx"),
  architecture: () => import("@/content/chapters/architecture.mdx"),
  pods: () => import("@/content/chapters/pods.mdx"),
  replicasets: () => import("@/content/chapters/replicasets.mdx"),
  deployments: () => import("@/content/chapters/deployments.mdx"),
  namespaces: () => import("@/content/chapters/namespaces.mdx"),
  imperative: () => import("@/content/chapters/imperative.mdx"),
  declarative: () => import("@/content/chapters/declarative.mdx"),
};

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return chapters.filter((c) => c.ready).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const chapter = chapters.find((c) => c.slug === slug);
  return { title: chapter?.title, description: chapter?.summary };
}

export default async function ChapterPage({ params }: Props) {
  const { slug } = await params;
  const index = chapters.findIndex((c) => c.slug === slug);
  const chapter = chapters[index];
  if (!chapter?.ready || !content[slug]) notFound();
  const { default: Content } = await content[slug]();

  const ready = chapters.filter((c) => c.ready);
  const at = ready.indexOf(chapter);
  const [prev, next] = [ready[at - 1], ready[at + 1]];
  const n = String(index + 1).padStart(2, "0");

  return (
    <article>
      <p className="font-mono text-sm text-muted">
        <Link href="/" className="hover:text-fg">
          {chapter.section.toLowerCase()}
        </Link>{" "}
        / {n} · {chapter.difficulty}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{chapter.title}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-muted">{chapter.summary}</p>

      <section className="mt-8 max-w-[70ch] rounded-lg border border-border bg-surface p-5" aria-labelledby="objectives">
        <h2 id="objectives" className="font-semibold">
          After this chapter you can
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          {chapter.data.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      <Content />

      <nav aria-label="Chapters" className="mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/chapters/${prev.slug}`} className="rounded-lg border border-border bg-surface p-4 hover:bg-code">
            <span className="block font-mono text-xs text-muted">previous</span>
            <span className="mt-1 block font-medium text-accent">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/chapters/${next.slug}`}
            className="rounded-lg border border-border bg-surface p-4 text-right hover:bg-code"
          >
            <span className="block font-mono text-xs text-muted">next</span>
            <span className="mt-1 block font-medium text-accent">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
