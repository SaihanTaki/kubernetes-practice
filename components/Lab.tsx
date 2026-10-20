"use client";

import { labs } from "@/content/chapters";
import { check, type LabDefinition } from "@/lib/labs";
import { FileEditor } from "./FileEditor";
import { Terminal } from "./Terminal";
import { useCluster } from "./useCluster";
import { WorkloadDiagram } from "./WorkloadDiagram";

export function Lab({ id }: { id: string }) {
  const lab = labs.find((l) => l.id === id);
  if (!lab) throw new Error(`Unknown lab "${id}"`);
  return <LabView lab={lab} />;
}

function LabView({ lab }: { lab: LabDefinition }) {
  const { id } = lab;
  const { cluster, execute, reset, epoch, setFile } = useCluster(lab.fixture);
  const done = lab.objectives.map((o) => check(cluster, o.validator));
  const complete = done.every(Boolean);

  return (
    <section className="my-8 rounded-lg border border-border bg-surface p-4" aria-labelledby={`lab-${id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`lab-${id}`} className="text-lg font-semibold">
          Lab: {lab.title}
        </h3>
        <span className="text-sm text-muted">{lab.difficulty}</span>
      </div>
      <p className="mt-2">{lab.scenario}</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <ol className="list-decimal space-y-1 pl-5">
            {lab.instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h4 className="mt-5 text-sm font-semibold">Objectives</h4>
          <ul className="mt-2 space-y-1" aria-live="polite">
            {lab.objectives.map((o, i) => (
              <li key={o.id} className={done[i] ? "text-ok" : "text-muted"}>
                <span aria-hidden>{done[i] ? "✓ " : "○ "}</span>
                {o.description}
                <span className="sr-only">{done[i] ? " (done)" : " (not done)"}</span>
              </li>
            ))}
          </ul>
          {complete && <p className="mt-3 font-medium text-ok">All objectives met. Lab complete.</p>}

          <div className="mt-5 space-y-2">
            {lab.hints.map((hint, i) => (
              <details key={i} className="rounded border border-border">
                <summary className="cursor-pointer px-3 py-3 text-sm">Hint {i + 1}</summary>
                <p className="px-3 pb-3 text-sm">{hint}</p>
              </details>
            ))}
            <details className="rounded border border-border">
              <summary className="cursor-pointer px-3 py-3 text-sm">Show solution</summary>
              {Object.entries(lab.solutionFiles ?? {}).map(([name, text]) => (
                <div key={name} className="px-3 pb-3">
                  <p className="text-sm">
                    Edit <code className="font-mono">{name}</code> to:
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded bg-code p-2 font-mono text-sm">{text}</pre>
                </div>
              ))}
              <pre className="px-3 pb-3 font-mono text-sm whitespace-pre-wrap">{lab.solution.join("\n")}</pre>
            </details>
          </div>
        </div>

        <div>
          <Terminal key={epoch} execute={execute} label={lab.title} />
          <button
            type="button"
            onClick={reset}
            className="mt-3 min-h-11 rounded-md border border-border px-4 hover:bg-code"
          >
            Reset lab
          </button>
        </div>
      </div>

      {Object.keys(cluster.files).length > 0 && (
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold">Files</h4>
          <FileEditor key={epoch} files={cluster.files} onChange={setFile} />
        </div>
      )}

      <div className="mt-6">
        <WorkloadDiagram cluster={cluster} />
      </div>
    </section>
  );
}
