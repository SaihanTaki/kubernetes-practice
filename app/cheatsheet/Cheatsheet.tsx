"use client";

import Link from "next/link";
import { useState } from "react";
import { chapters } from "@/content/chapters";
import type { CheatsheetEntry } from "@/content/cheatsheet";

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  return (
    <button
      type="button"
      onClick={copy}
      onBlur={() => setState("idle")}
      className="min-h-11 shrink-0 rounded-md border border-border px-3 text-sm hover:bg-code"
    >
      <span aria-live="polite">{{ idle: "Copy", copied: "Copied", failed: "Copy failed" }[state]}</span>
    </button>
  );
}

export function Cheatsheet({ entries }: { entries: CheatsheetEntry[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = entries.filter((e) =>
    [e.title, e.category, e.code, ...e.keywords].some((field) => field.toLowerCase().includes(q)),
  );
  const categories = [...new Set(shown.map((e) => e.category))];

  return (
    <>
      <label htmlFor="cheatsheet-search" className="block font-medium">
        Search commands and manifests
      </label>
      <input
        id="cheatsheet-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="scale, -l, selector"
        className="mt-2 min-h-11 w-full max-w-md rounded-md border border-border bg-surface px-3"
      />

      {!shown.length && <p className="mt-8 text-muted">No entries match &ldquo;{query}&rdquo;.</p>}

      {categories.map((category) => (
        <section key={category} className="mt-10">
          <h2 className="text-xl font-semibold">{category}</h2>
          <ul className="mt-4 space-y-6">
            {shown
              .filter((e) => e.category === category)
              .map((e) => {
                const chapter = chapters.find((c) => c.slug === e.relatedChapter && c.ready);
                return (
                  <li key={e.id}>
                    <h3 className="font-medium">{e.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {e.explanation} {e.simulated ? "Works in the simulator." : "Real cluster only, not simulated yet."}
                      {chapter && (
                        <>
                          {" "}
                          <Link href={`/chapters/${chapter.slug}`} className="text-accent underline underline-offset-4">
                            {chapter.title} chapter
                          </Link>
                        </>
                      )}
                    </p>
                    <div className="mt-2 flex items-start gap-2">
                      <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-code p-3 font-mono text-sm">
                        <code>{e.code}</code>
                      </pre>
                      <CopyButton text={e.code} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}
