import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chapters } from "@/content/chapters";

const content: Record<string, () => Promise<{ default: React.ComponentType }>> = {
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

  return (
    <article className="max-w-none">
      <p className="text-sm text-muted">
        {chapter.section} · Chapter {index + 1} · {chapter.difficulty}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{chapter.title}</h1>
      <p className="mt-3 text-lg text-muted">{chapter.summary}</p>

      <section className="mt-6 rounded-md border border-border bg-surface p-4" aria-labelledby="objectives">
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
    </article>
  );
}
