import {
  canI,
  impersonate,
  laptopHttpStatus,
  podHttpStatus,
  processEnv,
  route,
  served,
  type HttpStatus,
  CLUSTER_SCOPED,
  daemonSetStatus,
  jobCounts,
  jobStatus,
  readFile,
  currentReplicaSet,
  decodeBase64,
  endpointsOf,
  find,
  isReady,
  nodeTaints,
  parseQuantity,
  podsOf,
  podsOfOwner,
  qosClass,
  replicaSetsOf,
  type Cluster,
  type Container,
  type Fixture,
  type Kind,
  type Pod,
  type PodStatus,
  type QosClass,
  type ServiceType,
  type TaintEffect,
} from "@/lib/simulator";


/** Owners whose Pods the pod-* validators can look at. A Deployment covers the Pods of all its ReplicaSets. */
export type PodOwnerType = "Deployment" | "ReplicaSet" | "StatefulSet" | "DaemonSet" | "Job";

/** Either one Pod by name, or every Pod of an owner. */
type PodTarget = { podName?: string; ownerType?: PodOwnerType; ownerName?: string; namespace?: string };

export type ResourceField = "requests.cpu" | "requests.memory" | "limits.cpu" | "limits.memory";

export type Validator =
  | { kind: "resource-exists" | "resource-absent"; resourceType: Kind; resourceName: string; namespace?: string }
  | { kind: "replica-count"; resourceType: "Deployment" | "ReplicaSet" | "StatefulSet"; resourceName: string; expectedValue: number; namespace?: string }
  | { kind: "ready-pod-count"; ownerType: PodOwnerType; ownerName: string; expectedValue: number; namespace?: string }
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
  | { kind: "config-key"; resourceType: "ConfigMap" | "Secret"; resourceName: string; key: string; expectedValue: string; namespace?: string }
  /** Every matching Pod (at least one) runs on this node. */
  | ({ kind: "pod-node"; expectedValue: string } & PodTarget)
  /** Pods of the owner that no node could take (status Pending, not yet bound). */
  | { kind: "pending-pod-count"; ownerType: PodOwnerType; ownerName: string; expectedValue: number; namespace?: string }
  /** true when the node is not cordoned. */
  | { kind: "node-schedulable"; nodeName: string; expectedValue: boolean }
  /** Whether the node has a taint with this key and effect (a cordon counts as node.kubernetes.io/unschedulable:NoSchedule). */
  | { kind: "node-taint"; nodeName: string; key: string; effect: TaintEffect; present: boolean }
  | { kind: "node-label"; nodeName: string; key: string; expectedValue: string | null }
  /**
   * A container's request or limit, compared as quantities ("1Gi" equals "1024Mi"). Every condition given must hold:
   * `expectedValue` (null means unset), `atLeast`, `atMost`. For a Pod this is the value after LimitRange defaults.
   */
  | {
      kind: "container-resource";
      ownerType: "Pod" | "Deployment";
      name: string;
      field: ResourceField;
      expectedValue?: string | null;
      atLeast?: string;
      atMost?: string;
      namespace?: string;
    }
  /** Every matching Pod (at least one) has this QoS class. */
  | ({ kind: "qos-class"; expectedValue: QosClass } & PodTarget)
  | { kind: "job-status"; jobName: string; expectedValue: "Complete" | "Failed" | "Running"; namespace?: string }
  /** Pods of the Job that completed successfully. */
  | { kind: "job-succeeded"; jobName: string; expectedValue: number; namespace?: string }
  | { kind: "cronjob-suspended"; cronJobName: string; expectedValue: boolean; namespace?: string }
  /** Ready Pods of the DaemonSet. */
  | { kind: "daemonset-pods"; name: string; expectedValue: number; namespace?: string }
  | { kind: "pvc-status"; claimName: string; expectedValue: "Bound" | "Pending"; namespace?: string }
  | { kind: "pv-status"; pvName: string; expectedValue: "Available" | "Bound" | "Released" }
  /**
   * The text of a file inside every matching Pod (at least one), trailing newline ignored (echo adds one).
   * `expectedValue: null` means the file does not exist.
   */
  | ({ kind: "file-content"; path: string; expectedValue: string | null } & PodTarget)
  /**
   * GET url from a Pod (fromPod, or the first running Pod of fromOwnerType/fromOwnerName), or with neither from the
   * learner's laptop through the Ingress controller (https without certificate checks, like curl -k).
   * expectedStatus: an HTTP status, "timeout", "refused", "dns", or "connected" (a TCP connection opened, any response).
   */
  | {
      kind: "http-get";
      fromPod?: string;
      fromOwnerType?: PodOwnerType;
      fromOwnerName?: string;
      url: string;
      expectedStatus: HttpStatus;
      namespace?: string;
    }
  /** kubectl auth can-i verb resource[/name] --as=as; resource may name a subresource, e.g. pods/log. */
  | { kind: "can-i"; verb: string; resource: string; as: string; expectedValue: boolean; namespace?: string; name?: string }
  /** The Service the Ingress sends host + path to (rules, then its defaultBackend); null when nothing matches. */
  | { kind: "ingress-backend"; ingressName: string; host?: string; path: string; expectedService: string | null; namespace?: string }
  /** A variable in the environment of every matching Pod (at least one); null means unset. */
  | ({ kind: "env-value"; envName: string; expectedValue: string | null } & PodTarget);

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

function targetPods(c: Cluster, v: PodTarget): Pod[] {
  const ns = v.namespace ?? "default";
  if (v.podName !== undefined) {
    const pod = find(c, "Pod", ns, v.podName);
    return pod ? [pod] : [];
  }
  if (!v.ownerType || v.ownerName === undefined) return [];
  return podsOfOwner(c, v.ownerType, ns, v.ownerName) ?? [];
}

function resourceMatches(ctr: Container | undefined, v: Extract<Validator, { kind: "container-resource" }>): boolean {
  if (!ctr) return false;
  const [field, name] = v.field.split(".") as ["requests" | "limits", "cpu" | "memory"];
  const raw = ctr.resources?.[field]?.[name];
  const value = raw === undefined ? null : parseQuantity(name, raw);
  const parse = (q: string) => parseQuantity(name, q);
  if (v.expectedValue !== undefined && value !== (v.expectedValue === null ? null : parse(v.expectedValue))) return false;
  if (v.atLeast !== undefined && (value === null || value < parse(v.atLeast)!)) return false;
  if (v.atMost !== undefined && (value === null || value > parse(v.atMost)!)) return false;
  return true;
}

export function check(c: Cluster, v: Validator): boolean {
  const ns = ("namespace" in v ? v.namespace : undefined) ?? "default";
  const scoped = (kind: Kind) => (CLUSTER_SCOPED.has(kind) ? "" : ns);
  switch (v.kind) {
    case "resource-exists":
      return !!find(c, v.resourceType, scoped(v.resourceType), v.resourceName);
    case "resource-absent":
      return !find(c, v.resourceType, scoped(v.resourceType), v.resourceName);
    case "replica-count":
      return find(c, v.resourceType, ns, v.resourceName)?.replicas === v.expectedValue;
    case "ready-pod-count": {
      const pods = podsOfOwner(c, v.ownerType, ns, v.ownerName);
      return !!pods && pods.filter(isReady).length === v.expectedValue;
    }
    case "endpoint-count": {
      const svc = find(c, "Service", ns, v.serviceName);
      return !!svc && endpointsOf(c, svc).length === v.expectedValue;
    }
    case "service-type":
      return find(c, "Service", ns, v.serviceName)?.type === v.expectedValue;
    case "label-equals":
    case "annotation-equals": {
      const r = find(c, v.resourceType, scoped(v.resourceType), v.resourceName);
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
    case "pod-node": {
      const pods = targetPods(c, v);
      return pods.length > 0 && pods.every((p) => p.node === v.expectedValue);
    }
    case "pending-pod-count": {
      const pods = podsOfOwner(c, v.ownerType, ns, v.ownerName);
      return !!pods && pods.filter((p) => p.status === "Pending").length === v.expectedValue;
    }
    case "node-schedulable": {
      const n = find(c, "Node", "", v.nodeName);
      return !!n && !n.unschedulable === v.expectedValue;
    }
    case "node-taint": {
      const n = find(c, "Node", "", v.nodeName);
      return !!n && nodeTaints(n).some((t) => t.key === v.key && t.effect === v.effect) === v.present;
    }
    case "node-label": {
      const n = find(c, "Node", "", v.nodeName);
      return !!n && (Object.hasOwn(n.metadata.labels, v.key) ? n.metadata.labels[v.key] : null) === v.expectedValue;
    }
    case "container-resource": {
      const ctr = v.ownerType === "Pod" ? find(c, "Pod", ns, v.name)?.container : find(c, "Deployment", ns, v.name)?.template.container;
      return resourceMatches(ctr, v);
    }
    case "qos-class": {
      const pods = targetPods(c, v);
      return pods.length > 0 && pods.every((p) => qosClass(p.container) === v.expectedValue);
    }
    case "job-status": {
      const j = find(c, "Job", ns, v.jobName);
      return !!j && jobStatus(j) === v.expectedValue;
    }
    case "job-succeeded": {
      const j = find(c, "Job", ns, v.jobName);
      return !!j && jobCounts(c, j).succeeded === v.expectedValue;
    }
    case "cronjob-suspended":
      return find(c, "CronJob", ns, v.cronJobName)?.suspend === v.expectedValue;
    case "daemonset-pods": {
      const ds = find(c, "DaemonSet", ns, v.name);
      return !!ds && daemonSetStatus(c, ds).ready === v.expectedValue;
    }
    case "pvc-status": {
      const pvc = find(c, "PersistentVolumeClaim", ns, v.claimName);
      return !!pvc && !pvc.terminating && pvc.phase === v.expectedValue;
    }
    case "pv-status": {
      const pv = find(c, "PersistentVolume", "", v.pvName);
      return !!pv && !pv.terminating && pv.phase === v.expectedValue;
    }
    case "http-get": {
      if (v.fromPod === undefined && v.fromOwnerType === undefined) return laptopHttpStatus(c, v.url, v.expectedStatus);
      const from = targetPods(c, { podName: v.fromPod, ownerType: v.fromOwnerType, ownerName: v.fromOwnerName, namespace: v.namespace })
        .filter((p) => p.status === "Running")
        .sort((a, b) => (a.metadata.name < b.metadata.name ? -1 : 1))[0];
      return !!from && podHttpStatus(c, from, v.url, v.expectedStatus);
    }
    case "can-i":
      return canI(c, impersonate(v.as, []), v.verb, v.resource, ns, v.name) === v.expectedValue;
    case "ingress-backend": {
      const ing = find(c, "Ingress", ns, v.ingressName);
      if (!ing || !served(c, ing)) return false;
      return (route([ing], v.host ?? "", v.path)?.backend.service.name ?? null) === v.expectedService;
    }
    case "env-value": {
      const pods = targetPods(c, v);
      const value = (p: Pod) => processEnv(c, p).findLast(([k]) => k === v.envName)?.[1] ?? null;
      return pods.length > 0 && pods.every((p) => value(p) === v.expectedValue);
    }
    case "file-content": {
      const pods = targetPods(c, v);
      const text = (p: Pod) => readFile(c, p, v.path)?.replace(/\n$/, "") ?? null;
      return pods.length > 0 && pods.every((p) => text(p) === v.expectedValue);
    }
  }
}
