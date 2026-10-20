import {
  currentReplicaSet,
  decodeBase64,
  endpointsOf,
  find,
  isReady,
  podsOf,
  replicaSetsOf,
  type Cluster,
  type Fixture,
  type Kind,
  type PodStatus,
  type ServiceType,
} from "@/lib/simulator";

export type Validator =
  | { kind: "resource-exists" | "resource-absent"; resourceType: Kind; resourceName: string; namespace?: string }
  | { kind: "replica-count"; resourceType: "Deployment" | "ReplicaSet"; resourceName: string; expectedValue: number; namespace?: string }
  | { kind: "ready-pod-count"; ownerType: "Deployment" | "ReplicaSet"; ownerName: string; expectedValue: number; namespace?: string }
  /** Ready Pods behind a Service. */
  | { kind: "endpoint-count"; serviceName: string; expectedValue: number; namespace?: string }
  | { kind: "service-type"; serviceName: string; expectedValue: ServiceType; namespace?: string }
  /** `expectedValue: null` means the key is absent. */
  | { kind: "label-equals" | "annotation-equals"; resourceType: Kind; resourceName: string; key: string; expectedValue: string | null; namespace?: string }
  /** The image in the Deployment's Pod template. */
  | { kind: "deployment-image"; resourceName: string; expectedValue: string; namespace?: string }
  /** All replicas run the current template and are ready, and no old Pods are left. */
  | { kind: "rollout-complete"; resourceName: string; namespace?: string }
  | { kind: "pod-status"; podName: string; expectedValue: PodStatus; namespace?: string }
  /** The plain (decoded, for a Secret) value of one key. */
  | { kind: "config-key"; resourceType: "ConfigMap" | "Secret"; resourceName: string; key: string; expectedValue: string; namespace?: string };

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
    case "endpoint-count": {
      const svc = find(c, "Service", ns, v.serviceName);
      return !!svc && endpointsOf(c, svc).length === v.expectedValue;
    }
    case "service-type":
      return find(c, "Service", ns, v.serviceName)?.type === v.expectedValue;
    case "label-equals":
    case "annotation-equals": {
      const r = find(c, v.resourceType, ns, v.resourceName);
      if (!r) return false;
      const values = v.kind === "label-equals" ? r.metadata.labels : r.metadata.annotations;
      return (Object.hasOwn(values, v.key) ? values[v.key] : null) === v.expectedValue;
    }
    case "deployment-image":
      return find(c, "Deployment", ns, v.resourceName)?.template.image === v.expectedValue;
    case "rollout-complete": {
      const d = find(c, "Deployment", ns, v.resourceName);
      const rs = d && currentReplicaSet(c, d);
      if (!d || !rs) return false;
      const all = replicaSetsOf(c, d).flatMap((s) => podsOf(c, s));
      const current = podsOf(c, rs);
      return all.length === d.replicas && current.length === d.replicas && current.every(isReady);
    }
    case "pod-status":
      return find(c, "Pod", ns, v.podName)?.status === v.expectedValue;
    case "config-key": {
      const r = find(c, v.resourceType, ns, v.resourceName);
      if (!r || !Object.hasOwn(r.data, v.key)) return false;
      return (r.kind === "Secret" ? decodeBase64(r.data[v.key]) : r.data[v.key]) === v.expectedValue;
    }
  }
}
