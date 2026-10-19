"use client";

import { useState } from "react";
import { diagrams } from "@/content/chapters";
import type { DiagramBox, DiagramDef } from "@/content/types";

export function Diagram({ id }: { id: string }) {
  const def = diagrams[id];
  if (!def) throw new Error(`Unknown diagram "${id}"`);
  return <DiagramView def={def} />;
}

function find(box: DiagramBox, id: string): DiagramBox | undefined {
  if (box.id === id) return box;
  for (const child of box.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
}

function Arrow({ down }: { down: boolean }) {
  return (
    <span aria-hidden className="self-center font-mono text-lg leading-none text-muted">
      <span className={down ? "" : "sm:hidden"}>↓</span>
      {!down && <span className="hidden sm:inline">→</span>}
    </span>
  );
}

type BoxProps = { box: DiagramBox; lit: Set<string>; selected: string | null; onSelect: (id: string) => void };

function Box({ box, lit, selected, onSelect }: BoxProps) {
  const ring = lit.has(box.id) ? "border-2 border-accent bg-accent/10" : "border-border";
  const pressed = selected === box.id;
  const header = (
    <>
      <span className="block font-medium">{box.label}</span>
      {box.sub && <span className="block text-xs text-muted">{box.sub}</span>}
    </>
  );

  if (!box.children?.length) {
    return (
      <button
        type="button"
        onClick={() => onSelect(box.id)}
        aria-pressed={pressed}
        className={`min-h-11 rounded-md border bg-surface px-3 py-2 text-left text-sm sm:min-w-[9rem] sm:flex-1 ${ring} ${pressed ? "outline-2 outline-offset-2 outline-accent" : ""}`}
      >
        {header}
      </button>
    );
  }

  const column = box.layout === "column";
  const children = box.children.flatMap((child, i) => [
    ...(box.flow && i > 0 ? [<Arrow key={`arrow-${child.id}`} down={column} />] : []),
    <Box key={child.id} box={child} lit={lit} selected={selected} onSelect={onSelect} />,
  ]);
  const inner = (
    <div className={`flex flex-col gap-3 ${column ? "" : "sm:flex-row sm:flex-wrap sm:items-stretch"}`}>{children}</div>
  );
  if (!box.label) return <div className="flex flex-col gap-3 sm:flex-1">{inner}</div>;

  return (
    <div role="group" aria-label={box.label} className={`rounded-lg border border-dashed bg-code/60 p-3 sm:flex-1 ${ring}`}>
      {box.detail ? (
        <button
          type="button"
          onClick={() => onSelect(box.id)}
          aria-pressed={pressed}
          className={`mb-3 block text-left text-sm ${pressed ? "outline-2 outline-offset-2 outline-accent" : ""}`}
        >
          {header}
        </button>
      ) : (
        <div className="mb-3 text-sm">{header}</div>
      )}
      {inner}
    </div>
  );
}

function DiagramView({ def }: { def: DiagramDef }) {
  const [selected, setSelected] = useState<string | null>(null);
  // null is the overview; otherwise an index into def.steps.
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const steps = def.steps ?? [];
  const step = stepIndex === null ? null : steps[stepIndex];
  const lit = new Set(step?.highlight);
  const box = selected ? find(def.root, selected) : undefined;
  const button = "min-h-11 rounded-md border border-border px-4 hover:bg-code disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <div className="my-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 rounded-md border border-border bg-surface p-3">
          <Box box={def.root} lit={lit} selected={selected} onSelect={setSelected} />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <h4 className="text-sm font-semibold">Details</h4>
          {box ? (
            <>
              <p className="mt-2 font-medium">{box.label}</p>
              <p className="mt-1 text-sm">{box.detail ?? box.sub}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Select a box in the diagram to see what it does.</p>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {stepIndex === null ? (
              <button type="button" className={button} onClick={() => setStepIndex(0)}>
                Start walkthrough
              </button>
            ) : (
              <>
                <button type="button" className={button} disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>
                  Previous step
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={stepIndex === steps.length - 1}
                  onClick={() => setStepIndex(stepIndex + 1)}
                >
                  Next step
                </button>
                <button type="button" className={button} onClick={() => setStepIndex(null)}>
                  Show all
                </button>
              </>
            )}
          </div>
          <div aria-live="polite" className="mt-3">
            {step && stepIndex !== null && (
              <>
                <p className="font-medium">
                  Step {stepIndex + 1} of {steps.length}: {step.title}
                </p>
                <p className="mt-1">{step.text}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
