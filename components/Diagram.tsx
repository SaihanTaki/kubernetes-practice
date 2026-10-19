"use client";

import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState } from "react";
import { diagrams } from "@/content/chapters";
import type { DiagramDef } from "@/content/types";

// Only edge lines fade during a step; dimming text would drop it below WCAG AA contrast.
const DIM = 0.25;

// The built-in group node renders nothing, so override it to show the label.
function GroupNode({ data }: NodeProps<Node<{ label: string }>>) {
  return <div className="px-2 py-1 text-left text-xs text-muted">{data.label}</div>;
}
// Handles on every side, hidden, so each edge can leave from the side facing its target.
const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];
function BoxNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <>
      <div className="text-left text-sm">{data.label}</div>
      {SIDES.flatMap((side) => [
        <Handle key={`s-${side}`} id={`s-${side}`} type="source" position={side} className="opacity-0" />,
        <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={side} className="opacity-0" />,
      ])}
    </>
  );
}
const nodeTypes = { group: GroupNode, box: BoxNode };

function sides(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  return dy > 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}

export function Diagram({ id }: { id: string }) {
  const def = diagrams[id];
  if (!def) throw new Error(`Unknown diagram "${id}"`);
  return <DiagramView def={def} />;
}

function DiagramView({ def }: { def: DiagramDef }) {
  const [selected, setSelected] = useState<string | null>(null);
  // null is the overview; otherwise an index into def.steps.
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const steps = def.steps ?? [];
  const step = stepIndex === null ? null : steps[stepIndex];
  const lit = new Set(step?.nodes);
  const dim = (on: boolean) => (step && !on ? { opacity: DIM } : {});

  const nodes: Node[] = [
    ...(def.groups ?? []).map((g) => ({
      id: g.id,
      type: "group",
      position: { x: g.x, y: g.y },
      data: { label: g.label },
      style: { width: g.width, height: g.height },
      zIndex: -1,
      selectable: false,
      focusable: false,
    })),
    ...def.nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      type: "box",
      // Keep the built-in default node look for the custom type.
      className: "react-flow__node-default",
      data: { label: n.label },
      style: {
        width: 170,
        ...(lit.has(n.id) && { borderColor: "var(--accent)", borderWidth: 2, boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)" }),
      },
      ariaLabel: n.label,
      selected: n.id === selected,
    })),
  ];
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const edges: Edge[] = def.edges.map((e, i) => {
    const [out, into] = sides(byId.get(e.from)!, byId.get(e.to)!);
    return {
      id: `${i}-${e.from}-${e.to}`,
      type: "straight",
      source: e.from,
      target: e.to,
      sourceHandle: `s-${out}`,
      targetHandle: `t-${into}`,
      label: e.label,
      style: dim(lit.has(e.from) && lit.has(e.to)),
    };
  });
  const node = def.nodes.find((n) => n.id === selected);
  const select = (n: Node) => n.type !== "group" && setSelected(n.id);
  const button = "min-h-11 rounded-md border border-border px-4 hover:bg-code disabled:opacity-50 disabled:hover:bg-transparent";

  return (
    <div className="my-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[26rem] rounded-md border border-border bg-surface" aria-label="Diagram">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            colorMode="system"
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, n) => select(n)}
            onSelectionChange={({ nodes }) => nodes[0] && select(nodes[0])}
          />
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <h4 className="text-sm font-semibold">Details</h4>
          {node ? (
            <>
              <p className="mt-2 font-medium">{node.label}</p>
              <p className="mt-1 text-sm">{node.detail}</p>
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
                  Previous
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={stepIndex === steps.length - 1}
                  onClick={() => setStepIndex(stepIndex + 1)}
                >
                  Next
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
