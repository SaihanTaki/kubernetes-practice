"use client";

import { useState } from "react";
import { isReady, list, podsOf, replicaSetsOf, run, type Cluster, type Pod, type ReplicaSet, type Resource } from "@/lib/simulator";

const idOf = (r: Resource) => `${r.kind}/${r.metadata.namespace}/${r.metadata.name}`;

type Select = { selected: string | null; onSelect: (id: string) => void };

function PodChip({ pod, selected, onSelect }: { pod: Pod } & Select) {
  const tone = isReady(pod) ? "border-ok" : pod.status === "ContainerCreating" ? "border-dashed border-border" : "border-bad";
  const text = isReady(pod) ? "text-ok" : pod.status === "ContainerCreating" ? "text-muted" : "text-bad";
  const id = idOf(pod);
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected === id}
      className={`min-h-11 min-w-0 rounded-md border-2 bg-surface px-3 py-1.5 text-left ${tone} ${selected === id ? "outline-2 outline-offset-2 outline-accent" : ""}`}
    >
      <span className="block text-xs text-muted">Pod</span>
      <span className="block truncate font-mono text-sm">{pod.metadata.name}</span>
      <span className={`block text-xs ${text}`}>{pod.status}</span>
    </button>
  );
}

function Group({ resource, status, children, selected, onSelect }: { resource: Resource; status: string; children: React.ReactNode } & Select) {
  const id = idOf(resource);
  return (
    <div role="group" aria-label={`${resource.kind} ${resource.metadata.name}`} className="rounded-lg border border-dashed border-border bg-code/60 p-3">
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-pressed={selected === id}
        className={`mb-3 block min-h-11 text-left ${selected === id ? "outline-2 outline-offset-2 outline-accent" : ""}`}
      >
        <span className="block text-xs text-muted">{resource.kind}</span>
        <span className="block font-mono text-sm">{resource.metadata.name}</span>
        <span className="block text-xs text-muted">{status}</span>
      </button>
      {children}
    </div>
  );
}

function Pods({ pods, ...select }: { pods: Pod[] } & Select) {
  if (!pods.length) return <p className="text-sm text-muted">No Pods.</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
      {pods.map((p) => (
        <PodChip key={p.metadata.uid} pod={p} {...select} />
      ))}
    </div>
  );
}

function SetBox({ c, rs, ...select }: { c: Cluster; rs: ReplicaSet } & Select) {
  const pods = podsOf(c, rs);
  return (
    <Group resource={rs} status={`${pods.filter(isReady).length}/${rs.replicas} ready`} {...select}>
      <Pods pods={pods} {...select} />
    </Group>
  );
}

export function WorkloadDiagram({ cluster: c }: { cluster: Cluster }) {
  const [selected, setSelected] = useState<string | null>(null);
  const select = { selected, onSelect: setSelected };
  const resource = c.resources.find((r) => idOf(r) === selected);
  const details = resource
    ? run(c, `kubectl describe ${resource.kind.toLowerCase()} ${resource.metadata.name} -n ${resource.metadata.namespace}`).output
    : null;
  const standaloneSets = list(c, "ReplicaSet").filter((rs) => !rs.owner);
  const standalonePods = list(c, "Pod").filter((p) => !p.owner);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-3 rounded-md border border-border bg-surface p-3" aria-label="Workload diagram">
        {list(c, "Deployment").map((d) => {
          const sets = replicaSetsOf(c, d);
          const ready = sets.flatMap((rs) => podsOf(c, rs)).filter(isReady).length;
          return (
            <Group key={d.metadata.uid} resource={d} status={`${ready}/${d.replicas} ready`} {...select}>
              <div className="space-y-3">
                {sets.map((rs) => (
                  <SetBox key={rs.metadata.uid} c={c} rs={rs} {...select} />
                ))}
              </div>
            </Group>
          );
        })}
        {standaloneSets.map((rs) => (
          <SetBox key={rs.metadata.uid} c={c} rs={rs} {...select} />
        ))}
        {standalonePods.length > 0 && (
          <div role="group" aria-label="Standalone Pods" className="rounded-lg border border-dashed border-border p-3">
            <p className="mb-3 text-xs text-muted">Standalone Pods (no controller)</p>
            <Pods pods={standalonePods} {...select} />
          </div>
        )}
        {!c.resources.length && <p className="p-1 text-muted">No workloads in the cluster.</p>}
      </div>
      <div className="rounded-md border border-border bg-surface p-3">
        <h4 className="text-sm font-semibold">Details</h4>
        {details ? (
          <pre className="mt-2 overflow-x-auto font-mono text-xs leading-5 whitespace-pre-wrap">{details}</pre>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {selected ? "That resource no longer exists." : "Select a box to see its kubectl describe output."}
          </p>
        )}
      </div>
    </div>
  );
}
