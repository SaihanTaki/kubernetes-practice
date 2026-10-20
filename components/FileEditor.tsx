"use client";

import { useState } from "react";

type Props = { files: Record<string, string>; onChange: (name: string, text: string) => void };

/** Edits the simulated cluster's in-memory files, which kubectl apply -f and cat read. */
export function FileEditor({ files, onChange }: Props) {
  const names = Object.keys(files).sort();
  const [picked, setPicked] = useState<string | null>(null);
  const name = picked && names.includes(picked) ? picked : names[0];
  if (!name) return null;

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 pt-2" role="tablist" aria-label="Files">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === name}
            onClick={() => setPicked(n)}
            className={`min-h-11 rounded-t-md px-3 font-mono text-sm ${n === name ? "border border-b-0 border-border bg-code" : "text-muted hover:text-fg"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor={`file-${name}`}>
        Contents of {name}
      </label>
      <textarea
        id={`file-${name}`}
        value={files[name]}
        onChange={(e) => onChange(name, e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        rows={Math.min(24, Math.max(8, files[name].split("\n").length + 1))}
        className="block w-full resize-y rounded-b-md bg-code p-3 font-mono text-base leading-6 sm:text-sm"
      />
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        Edits are saved as you type. Run <code className="font-mono">kubectl apply -f {name}</code> to apply them.
      </p>
    </div>
  );
}
