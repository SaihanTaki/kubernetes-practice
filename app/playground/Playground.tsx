"use client";

import { Terminal } from "@/components/Terminal";
import { useCluster } from "@/components/useCluster";
import { WorkloadDiagram } from "@/components/WorkloadDiagram";
import type { Fixture } from "@/lib/simulator";

const fixture: Fixture = {
  deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }],
  pods: [{ name: "toolbox", image: "busybox:1.36", labels: { app: "toolbox" } }],
};

export function Playground() {
  const { cluster, execute, reset, epoch } = useCluster(fixture);
  return (
    <>
      <Terminal key={epoch} execute={execute} label="Playground" />
      <button type="button" onClick={reset} className="mt-3 min-h-11 rounded-md border border-border px-4 hover:bg-code">
        Reset cluster
      </button>
      <div className="mt-6">
        <WorkloadDiagram cluster={cluster} />
      </div>
    </>
  );
}
