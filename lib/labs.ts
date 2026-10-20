import { find, isReady, podsOf, replicaSetsOf, type Cluster, type Fixture, type Kind } from "@/lib/simulator";

export type Validator =
  | { kind: "resource-exists" | "resource-absent"; resourceType: Kind; resourceName: string; namespace?: string }
  | { kind: "replica-count"; resourceType: "Deployment" | "ReplicaSet"; resourceName: string; expectedValue: number; namespace?: string }
  | { kind: "ready-pod-count"; ownerType: "Deployment" | "ReplicaSet"; ownerName: string; expectedValue: number; namespace?: string };

export type LabDefinition = {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  scenario: string;
  instructions: string[];
  fixture: Fixture;
  objectives: { id: string; description: string; validator: Validator }[];
  hints: string[];
  solution: string[];
  /** Files as the learner should leave them after editing, written before the solution commands run. */
  solutionFiles?: Record<string, string>;
};

export function check(c: Cluster, v: Validator): boolean {
  const ns = v.namespace ?? "default";
  switch (v.kind) {
    case "resource-exists":
      return !!find(c, v.resourceType, ns, v.resourceName);
    case "resource-absent":
      return !find(c, v.resourceType, ns, v.resourceName);
    case "replica-count":
      return find(c, v.resourceType, ns, v.resourceName)?.replicas === v.expectedValue;
    case "ready-pod-count": {
      const owner = find(c, v.ownerType, ns, v.ownerName);
      if (!owner) return false;
      const sets = owner.kind === "Deployment" ? replicaSetsOf(c, owner) : [owner];
      return sets.flatMap((rs) => podsOf(c, rs)).filter(isReady).length === v.expectedValue;
    }
  }
}
