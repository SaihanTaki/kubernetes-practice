"use client";

import { ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import { isReady, list, podsOf, replicaSetsOf, run, type Cluster, type Pod, type ReplicaSet, type Resource } from "@/lib/simulator";

const WIDTH = 170;
const GAP = 20;
const ROW = { Deployment: 0, ReplicaSet: 110, Pod: 220 };

const idOf = (r: Resource) => `${r.kind}/${r.metadata.namespace}/${r.metadata.name}`;

type Tone = "ok" | "wait" | "bad";
const TONE = { ok: "text-ok", wait: "text-muted", bad: "text-bad" };

function nodeFor(r: Resource, x: number, status: string, tone: Tone): Node {
  return {
    id: idOf(r),
    position: { x, y: ROW[r.kind] },
    data: {
      label: (
        <div className="text-left">
          <div className="text-xs text-muted">{r.kind}</div>
          <div className="truncate font-mono text-sm">{r.metadata.name}</div>
          <div className={`text-xs ${TONE[tone]}`}>{status}</div>
        </div>
      ),
    },
    style: { width: WIDTH, borderStyle: tone === "ok" ? "solid" : "dashed" },
    ariaLabel: `${r.kind} ${r.metadata.name}, ${status}`,
  };
}

/** Lays Pods out left to right and centres each owner above its children. */
function layout(c: Cluster) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let next = 0;
  const slot = () => (next++) * (WIDTH + GAP);
  const centre = (xs: number[]) => (xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : slot());

  const placePod = (p: Pod) => {
    const x = slot();
    nodes.push(nodeFor(p, x, p.status, isReady(p) ? "ok" : p.status === "ContainerCreating" ? "wait" : "bad"));
    return x;
  };
  const placeSet = (rs: ReplicaSet) => {
    const pods = podsOf(c, rs);
    const x = centre(pods.map(placePod));
    const ready = pods.filter(isReady).length;
    nodes.push(nodeFor(rs, x, `${ready}/${rs.replicas} ready`, ready === rs.replicas ? "ok" : "wait"));
    for (const p of pods) edges.push({ id: `${idOf(rs)}>${idOf(p)}`, source: idOf(rs), target: idOf(p) });
    return x;
  };

  for (const d of list(c, "Deployment")) {
    const sets = replicaSetsOf(c, d);
    const x = centre(sets.map(placeSet));
    const ready = sets.flatMap((rs) => podsOf(c, rs)).filter(isReady).length;
    nodes.push(nodeFor(d, x, `${ready}/${d.replicas} ready`, ready === d.replicas ? "ok" : "wait"));
    for (const rs of sets) edges.push({ id: `${idOf(d)}>${idOf(rs)}`, source: idOf(d), target: idOf(rs) });
  }
  for (const rs of list(c, "ReplicaSet").filter((rs) => !rs.owner)) placeSet(rs);
  for (const p of list(c, "Pod").filter((p) => !p.owner)) placePod(p);
  return { nodes, edges };
}

export function WorkloadDiagram({ cluster }: { cluster: Cluster }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { nodes, edges } = layout(cluster);
  const resource = cluster.resources.find((r) => idOf(r) === selected);
  const details = resource
    ? run(cluster, `kubectl describe ${resource.kind.toLowerCase()} ${resource.metadata.name} -n ${resource.metadata.namespace}`).output
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="h-80 rounded-md border border-border bg-surface" aria-label="Workload diagram">
        {nodes.length ? (
          <ReactFlow
            // Remount when the set of resources changes so the view refits.
            key={nodes.map((n) => n.id).join()}
            nodes={nodes.map((n) => ({ ...n, selected: n.id === selected }))}
            edges={edges}
            fitView
            colorMode="system"
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, n) => setSelected(n.id)}
            onSelectionChange={({ nodes }) => nodes[0] && setSelected(nodes[0].id)}
          />
        ) : (
          <p className="p-4 text-muted">No workloads in the cluster.</p>
        )}
      </div>
      <div className="rounded-md border border-border bg-surface p-3">
        <h4 className="text-sm font-semibold">Details</h4>
        {details ? (
          <pre className="mt-2 overflow-x-auto font-mono text-xs leading-5 whitespace-pre-wrap">{details}</pre>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {selected ? "That resource no longer exists." : "Select a box in the diagram to see its details."}
          </p>
        )}
      </div>
    </div>
  );
}
