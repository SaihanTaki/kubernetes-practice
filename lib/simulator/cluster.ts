import { admit, withDefaultRequests } from "./admission";
import { reconcileCronJob, reconcileJob } from "./batch";
import { recordEvent } from "./events";
import { collectFiles, writeFile } from "./files";
import { imageInfo } from "./images";
import { MI, parseMemory, parseQuantity } from "./quantity";
import { evictUntolerated, schedule } from "./scheduler";
import { reconcileDaemonSet, reconcileStatefulSet } from "./sets";
import { runProgram } from "./shell";
import { reconcileStorage } from "./storage";
import type {
  Cluster,
  Container,
  Deployment,
  Kind,
  Labels,
  Node,
  Pod,
  PodOwnerKind,
  PodTemplate,
  PortRef,
  Probe,
  ReplicaSet,
  Resource,
  Service,
} from "./types";

// Characters Kubernetes uses for generated name suffixes (no vowels, no look-alikes).
const ALPHABET = "bcdfghjklmnpqrstvwxz2456789";
export const WORKERS = ["worker-1", "worker-2"];
export const CONTROL_PLANE = "control-plane";
export const CONTROL_PLANE_TAINT = "node-role.kubernetes.io/control-plane";
/** Kinds whose objects have no namespace (metadata.namespace is ""). */
export const CLUSTER_SCOPED: ReadonlySet<string> = new Set(["Node", "Namespace", "PersistentVolume", "StorageClass"]);
export const SECONDS_PER_COMMAND = 5;
export const REVISION = "deployment.kubernetes.io/revision";
export const CHANGE_CAUSE = "kubernetes.io/change-cause";
export const HASH_LABEL = "pod-template-hash";

export function hash(input: string): number {
  let h = 2166136261;
  for (const ch of input) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function suffix(seed: number, length: number): string {
  let n = hash(String(seed));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[n % ALPHABET.length];
    n = hash(String(n));
  }
  return out;
}

/** JSON with sorted object keys, so key order does not count as a change. */
export const canonical = (value: unknown) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );

export const encodeBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
export const decodeBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)));

export function meta(c: Cluster, name: string, namespace: string, labels: Labels, annotations: Labels = {}) {
  return { uid: String(c.seq++), name, namespace, labels: { ...labels }, annotations: { ...annotations }, createdAt: c.clock };
}

export function matches(labels: Labels, selector: Labels): boolean {
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

const pool = (c: Cluster, kind: Kind): Resource[] => (kind === "Node" ? c.nodes : c.resources);

export function find<K extends Kind>(c: Cluster, kind: K, namespace: string, name: string) {
  return pool(c, kind).find(
    (r) => r.kind === kind && r.metadata.namespace === namespace && r.metadata.name === name,
  ) as Extract<Resource, { kind: K }> | undefined;
}

export function list<K extends Kind>(c: Cluster, kind: K, namespace?: string) {
  return pool(c, kind).filter(
    (r) => r.kind === kind && (namespace === undefined || r.metadata.namespace === namespace),
  ) as Extract<Resource, { kind: K }>[];
}

export function addResource(c: Cluster, r: Resource) {
  if (r.kind === "Node") c.nodes.push(r);
  else c.resources.push(r);
}

export function removeResource(c: Cluster, r: Resource) {
  if (r.kind === "Node") c.nodes = c.nodes.filter((x) => x !== r);
  else c.resources = c.resources.filter((x) => x !== r);
}

export const isReady = (p: Pod) => p.status === "Running" && p.ready;

/** A Pod whose containers ran to completion: it holds no resources and quota no longer counts it. */
export const isFinished = (p: Pod) => p.status === "Completed" || p.status === "Error";

export const ownerKindOf = (p: Pod): PodOwnerKind => p.ownerKind ?? "ReplicaSet";

export function podsOf(c: Cluster, rs: ReplicaSet): Pod[] {
  return list(c, "Pod", rs.metadata.namespace).filter((p) => p.owner === rs.metadata.name && ownerKindOf(p) === "ReplicaSet");
}

/** Pods of a Deployment (through its ReplicaSets) or of any direct Pod owner. */
export function podsOfOwner(c: Cluster, kind: "Deployment" | PodOwnerKind, namespace: string, name: string): Pod[] | undefined {
  if (kind === "Deployment") {
    const d = find(c, "Deployment", namespace, name);
    return d && replicaSetsOf(c, d).flatMap((rs) => podsOf(c, rs));
  }
  if (!find(c, kind, namespace, name)) return undefined;
  return list(c, "Pod", namespace).filter((p) => p.owner === name && ownerKindOf(p) === kind);
}

function node(c: Cluster, name: string, zone: string, memory: string): Node {
  const labels: Labels = { "kubernetes.io/hostname": name, "kubernetes.io/os": "linux", "topology.kubernetes.io/zone": zone };
  const control = name === CONTROL_PLANE;
  if (control) labels[`node-role.kubernetes.io/${CONTROL_PLANE}`] = "";
  return {
    kind: "Node",
    // Not from meta(): node uids must not use c.seq, which names generated Pods.
    metadata: { uid: `node/${name}`, name, namespace: "", labels, annotations: {}, createdAt: c.clock },
    taints: control ? [{ key: CONTROL_PLANE_TAINT, effect: "NoSchedule" }] : [],
    unschedulable: false,
    allocatable: { cpu: "2", memory, pods: 110 },
  };
}

export const defaultNodes = (c: Cluster) => [node(c, CONTROL_PLANE, "zone-a", "2Gi"), node(c, WORKERS[0], "zone-a", "4Gi"), node(c, WORKERS[1], "zone-b", "4Gi")];

export const workerNode = (c: Cluster, name: string) => node(c, name, "zone-a", "4Gi");

export function replicaSetsOf(c: Cluster, d: Deployment): ReplicaSet[] {
  return list(c, "ReplicaSet", d.metadata.namespace).filter((rs) => rs.owner === d.metadata.name);
}

export const templateHash = (t: PodTemplate) => suffix(hash(canonical(t)), 10);

export function currentReplicaSet(c: Cluster, d: Deployment) {
  return find(c, "ReplicaSet", d.metadata.namespace, `${d.metadata.name}-${templateHash(d.template)}`);
}

export const revisionOf = (rs: ReplicaSet) => Number(rs.metadata.annotations[REVISION] ?? 0);

export const containerName = (image: string) => image.split(":")[0].split("/").at(-1)!;

/** A new Pod, not yet bound to a node: the scheduler places it at the end of the command. */
export function newPod(c: Cluster, name: string, namespace: string, t: PodTemplate): Pod {
  const pod: Pod = {
    kind: "Pod",
    metadata: meta(c, name, namespace, t.labels, t.annotations),
    image: t.image,
    container: withDefaultRequests(structuredClone(t.container)),
    node: "",
    status: "Pending",
    ready: false,
    restarts: 0,
  };
  if (t.spec) pod.spec = structuredClone(t.spec);
  return pod;
}

/** Stable per Pod: each node gets its own /24 like a real CNI (control-plane 0, worker-N N). */
export function podIP(p: Pod): string {
  return `10.244.${Number(p.node.match(/-(\d+)$/)?.[1] ?? 0)}.${(Number(p.metadata.uid) % 250) + 2}`;
}

// --- Container runtime ---

export const pullError = (image: string) =>
  imageInfo(image).pullable ? null : `Failed to pull image "${image}": manifest for ${image} not found: manifest unknown`;

export function resolvePort(container: Container, ref: PortRef): number | undefined {
  if (typeof ref === "number") return ref;
  return container.ports?.find((p) => p.name === ref)?.containerPort;
}

/** Why a probe fails, in the kubelet's words, or null when it passes. */
export function probeFailure(p: Pod, probe?: Probe): string | null {
  if (!probe || probe.exec) return null;
  const info = imageInfo(p.image);
  const ref = (probe.httpGet ?? probe.tcpSocket)!.port;
  const port = resolvePort(p.container, ref) ?? ref;
  const ip = podIP(p);
  const refused = `dial tcp ${ip}:${port}: connect: connection refused`;
  if (probe.tcpSocket) return port === info.http || port === info.tcp ? null : refused;
  const path = probe.httpGet!.path ?? "/";
  const url = `Get "http://${ip}:${port}${path}"`;
  if (port === info.http) return info.paths!.includes(path) ? null : "HTTP probe failed with statuscode: 404";
  if (port === info.tcp) return `${url}: net/http: HTTP/1.x transport connection broken: malformed HTTP response`;
  return `${url}: ${refused}`;
}

/** The first env or envFrom reference that cannot be resolved, as the kubelet reports it. */
export function configError(c: Cluster, p: Pod): string | null {
  const ns = p.metadata.namespace;
  const lookup = (kind: "ConfigMap" | "Secret", name: string, key?: string) => {
    const obj = find(c, kind, ns, name);
    if (!obj) return `${kind.toLowerCase()} "${name}" not found`;
    if (key !== undefined && !Object.hasOwn(obj.data, key)) return `couldn't find key ${key} in ${kind} ${ns}/${name}`;
    return null;
  };
  for (const e of p.container.env ?? []) {
    const cm = e.valueFrom?.configMapKeyRef;
    const s = e.valueFrom?.secretKeyRef;
    const err = cm ? lookup("ConfigMap", cm.name, cm.key) : s ? lookup("Secret", s.name, s.key) : null;
    if (err) return err;
  }
  for (const e of p.container.envFrom ?? []) {
    const err = e.configMapRef ? lookup("ConfigMap", e.configMapRef.name) : e.secretRef ? lookup("Secret", e.secretRef.name) : null;
    if (err) return err;
  }
  return null;
}

/** Why a configMap or secret volume cannot be mounted, as the kubelet's FailedMount event says, or null. */
export function mountError(c: Cluster, p: Pod): string | null {
  const ns = p.metadata.namespace;
  for (const v of p.spec?.volumes ?? []) {
    const fail = (what: string) => `MountVolume.SetUp failed for volume "${v.name}" : ${what} not found`;
    if (v.configMap && !find(c, "ConfigMap", ns, v.configMap.name)) return fail(`configmap "${v.configMap.name}"`);
    if (v.secret && !find(c, "Secret", ns, v.secret.secretName)) return fail(`secret "${v.secret.secretName}"`);
  }
  return null;
}

/** Whether the image needs more memory than the container's limit allows. */
export function oomKilled(p: Pod) {
  const limit = parseMemory(p.container.resources?.limits?.memory ?? "");
  return limit !== null && limit < imageInfo(p.image).memoryMi * MI;
}

export type QosClass = "Guaranteed" | "Burstable" | "BestEffort";

/** Guaranteed when cpu and memory limits are set and requests equal them; BestEffort when nothing is set. */
export function qosClass(ctr: Container): QosClass {
  const { requests = {}, limits = {} } = ctr.resources ?? {};
  if (!Object.keys(requests).length && !Object.keys(limits).length) return "BestEffort";
  const same = (["cpu", "memory"] as const).every(
    (r) => limits[r] !== undefined && parseQuantity(r, limits[r]) === parseQuantity(r, requests[r] ?? limits[r]),
  );
  return same ? "Guaranteed" : "Burstable";
}

/** Whether the container keeps getting restarted: a crashing image, an OOM kill, or a failing liveness or startup probe. */
export const crashes = (p: Pod) =>
  imageInfo(p.image).crashes || oomKilled(p) || !!probeFailure(p, p.container.livenessProbe) || !!probeFailure(p, p.container.startupProbe);

/** Why the previous container run ended, as `describe` shows under Last State, or null. */
export function lastTermination(p: Pod): { reason: string; exitCode: number } | null {
  if (!p.restarts) return null;
  const exit = runProgram(p.image, p.container)?.exitCode;
  if (exit !== undefined && exit !== null) return { reason: exit ? "Error" : "Completed", exitCode: exit };
  if (imageInfo(p.image).crashes) return { reason: "Error", exitCode: 1 };
  if (oomKilled(p)) return { reason: "OOMKilled", exitCode: 137 };
  return null;
}

/** Mount volumes, pull the image, resolve config references and start the container. */
export function start(c: Cluster, p: Pod) {
  p.ready = false;
  if (mountError(c, p)) p.status = "ContainerCreating";
  else if (pullError(p.image)) p.status = "ImagePullBackOff";
  else if (configError(c, p)) p.status = "CreateContainerConfigError";
  else if (imageInfo(p.image).crashes) {
    if (p.spec?.restartPolicy === "Never") p.status = "Error";
    else {
      p.status = "CrashLoopBackOff";
      p.restarts = Math.max(p.restarts, 1);
    }
  } else if (oomKilled(p)) p.status = "OOMKilled";
  else {
    p.status = "Running";
    p.ready = !crashes(p) && !probeFailure(p, p.container.readinessProbe);
    for (const w of runProgram(p.image, p.container)?.writes ?? []) writeFile(c, p, w.path, w.text, w.append);
  }
}

/** A run-to-completion container exited: restartPolicy decides between a final state and a restart. */
function exited(p: Pod, code: number) {
  p.ready = false;
  const policy = p.spec?.restartPolicy ?? "Always";
  if (policy === "Never" || (policy === "OnFailure" && code === 0)) p.status = code === 0 ? "Completed" : "Error";
  else {
    p.restarts++;
    p.status = "CrashLoopBackOff";
  }
}

// shortcut: probe timing is not simulated; a failing liveness probe restarts the container once per command.
function tick(p: Pod) {
  const exit = runProgram(p.image, p.container)?.exitCode;
  if (exit !== undefined && exit !== null) return exited(p, exit);
  if (!crashes(p)) return;
  if (p.spec?.restartPolicy === "Never") {
    p.ready = false;
    p.status = oomKilled(p) ? "OOMKilled" : "Error";
    return;
  }
  p.restarts++;
  if (imageInfo(p.image).crashes || p.restarts >= 3) p.status = "CrashLoopBackOff";
  else if (oomKilled(p)) p.status = "OOMKilled";
}

export function endpointsOf(c: Cluster, svc: Service): { pod: Pod; ip: string; ports: number[] }[] {
  if (!Object.keys(svc.selector).length) return [];
  return list(c, "Pod", svc.metadata.namespace)
    .filter((p) => isReady(p) && matches(p.metadata.labels, svc.selector))
    .map((pod) => ({
      pod,
      ip: podIP(pod),
      ports: svc.ports.map((sp) => resolvePort(pod.container, sp.targetPort)).filter((n): n is number => n !== undefined),
    }))
    .filter((e) => e.ports.length);
}

// --- Controllers ---

/**
 * Creates a Pod for a controller, through admission (LimitRange, ResourceQuota). A rejection becomes a
 * FailedCreate event on the owner and no Pod. Returns whether the Pod was created.
 */
export function spawnPod(
  c: Cluster,
  owner: Extract<Resource, { kind: PodOwnerKind }>,
  name: string,
  t: PodTemplate,
  source: string,
  created = `Created pod: ${name}`,
): boolean {
  const seq = c.seq;
  const pod = newPod(c, name, owner.metadata.namespace, t);
  pod.owner = owner.metadata.name;
  if (owner.kind !== "ReplicaSet") pod.ownerKind = owner.kind;
  const denied = admit(c, pod);
  if (denied) {
    // Give the next attempt the same name, so the event repeats (count++) instead of piling up.
    c.seq = seq;
    recordEvent(c, owner, "Warning", "FailedCreate", `Error creating: pods "${name}" is forbidden: ${denied}`, source);
    return false;
  }
  c.resources.push(pod);
  recordEvent(c, owner, "Normal", "SuccessfulCreate", created, source);
  return true;
}

const createPod = (c: Cluster, rs: ReplicaSet) =>
  spawnPod(c, rs, `${rs.metadata.name}-${suffix(c.seq, 5)}`, rs.template, "replicaset-controller");

const scaled = (value: number | string, total: number, round: (n: number) => number) =>
  typeof value === "number" ? value : round((total * parseInt(value, 10)) / 100);

/** One step of a rollout from the `active` old ReplicaSets to `rs`. */
function rollout(c: Cluster, d: Deployment, rs: ReplicaSet, active: ReplicaSet[]) {
  if (!active.length) {
    rs.replicas = d.replicas;
    return;
  }
  if (d.strategy.type === "Recreate") {
    for (const old of active) old.replicas = 0;
    return;
  }
  const surge = scaled(d.strategy.maxSurge, d.replicas, Math.ceil);
  // The API rejects both being 0; treat it as 1 unavailable so a rollout can always move.
  const unavailable = scaled(d.strategy.maxUnavailable, d.replicas, Math.floor) || (surge ? 0 : 1);
  const minAvailable = d.replicas - unavailable;
  const all = [rs, ...active];
  const total = () => all.reduce((n, s) => n + s.replicas, 0);
  const readyOf = (s: ReplicaSet) => podsOf(c, s).filter(isReady).length;

  // Old Pods that are not ready go first, then ready ones while enough Pods stay available.
  let budget = total() - minAvailable - (rs.replicas - readyOf(rs));
  for (const old of active) {
    const k = Math.max(0, Math.min(budget, old.replicas - readyOf(old)));
    old.replicas -= k;
    budget -= k;
  }
  let spare = all.reduce((n, s) => n + readyOf(s), 0) - minAvailable;
  for (const old of active) {
    const k = Math.max(0, Math.min(spare, old.replicas));
    old.replicas -= k;
    spare -= k;
  }
  rs.replicas = rs.replicas < d.replicas ? Math.min(d.replicas, rs.replicas + Math.max(0, d.replicas + surge - total())) : d.replicas;
}

function reconcileDeployment(c: Cluster, d: Deployment) {
  let rs = currentReplicaSet(c, d);
  const olds = replicaSetsOf(c, d).filter((s) => s !== rs);
  const active = olds.filter((s) => s.replicas > 0 || podsOf(c, s).length > 0);
  if (d.paused) {
    // shortcut: a paused Deployment only scales a finished rollout, it does not scale a half-done one proportionally.
    const running = rs && (rs.replicas > 0 || podsOf(c, rs).length) ? [rs, ...active] : active;
    if (running.length <= 1) {
      const only = running[0] ?? rs;
      if (only) only.replicas = d.replicas;
    }
    return;
  }
  if (!rs) {
    const h = templateHash(d.template);
    const labels = { ...d.template.labels, [HASH_LABEL]: h };
    rs = {
      kind: "ReplicaSet",
      metadata: meta(c, `${d.metadata.name}-${h}`, d.metadata.namespace, labels),
      owner: d.metadata.name,
      replicas: 0,
      selector: { ...d.selector, [HASH_LABEL]: h },
      template: { ...structuredClone(d.template), labels },
    };
    c.resources.push(rs);
  }
  const newest = Math.max(0, ...olds.map(revisionOf));
  if (revisionOf(rs) <= newest) rs.metadata.annotations[REVISION] = String(newest + 1);
  d.metadata.annotations[REVISION] = rs.metadata.annotations[REVISION];
  const cause = d.metadata.annotations[CHANGE_CAUSE];
  if (cause !== undefined) rs.metadata.annotations[CHANGE_CAUSE] = cause;
  rollout(c, d, rs, active);
}

/**
 * Simplified controllers: Deployments roll between one ReplicaSet per pod template,
 * ReplicaSets create or remove Pods to match their replica count and release Pods
 * whose labels stop matching, Jobs, CronJobs, DaemonSets and StatefulSets run theirs,
 * claims bind, and resources whose owner is gone are garbage collected.
 */
export function reconcile(c: Cluster) {
  // Pod garbage collection for deleted nodes, and NoExecute taints.
  const nodes = new Set(c.nodes.map((n) => n.metadata.name));
  c.resources = c.resources.filter((r) => !(r.kind === "Pod" && r.node && !nodes.has(r.node)));
  evictUntolerated(c);

  for (const cj of list(c, "CronJob")) reconcileCronJob(c, cj);
  c.resources = c.resources.filter((r) => !(r.kind === "Job" && r.owner && !find(c, "CronJob", r.metadata.namespace, r.owner)));
  for (const d of list(c, "Deployment")) reconcileDeployment(c, d);

  // shortcut: orphaned Pods are never adopted again, even if their labels match a selector later.
  for (const p of list(c, "Pod")) {
    const rs = p.owner && ownerKindOf(p) === "ReplicaSet" ? find(c, "ReplicaSet", p.metadata.namespace, p.owner) : undefined;
    if (rs && !matches(p.metadata.labels, rs.selector)) p.owner = undefined;
  }

  // ReplicaSets first, so their Pods are collected in the same pass.
  c.resources = c.resources.filter(
    (r) => !(r.kind === "ReplicaSet" && r.owner && !find(c, "Deployment", r.metadata.namespace, r.owner)),
  );
  c.resources = c.resources.filter(
    (r) => !(r.kind === "Pod" && r.owner && !find(c, ownerKindOf(r), r.metadata.namespace, r.owner)),
  );

  for (const rs of list(c, "ReplicaSet")) {
    const pods = podsOf(c, rs);
    for (let i = pods.length; i < rs.replicas && createPod(c, rs); i++);
    if (pods.length > rs.replicas) {
      // Remove not-ready and newest Pods first, like the real controller prefers.
      const extra = [...pods]
        .sort((a, b) => Number(isReady(a)) - Number(isReady(b)) || b.metadata.createdAt - a.metadata.createdAt)
        .slice(0, pods.length - rs.replicas);
      c.resources = c.resources.filter((r) => !extra.includes(r as Pod));
    }
  }
  for (const j of list(c, "Job")) reconcileJob(c, j);
  for (const ds of list(c, "DaemonSet")) reconcileDaemonSet(c, ds);
  for (const sts of list(c, "StatefulSet")) reconcileStatefulSet(c, sts);
  reconcileStorage(c);
  schedule(c);
  collectFiles(c);
}

const startable = (p: Pod) => !!p.node && (p.status === "ContainerCreating" || p.status === "CreateContainerConfigError");

/** Advance the clock and the containers of Pods created before `seq`, so new Pods show ContainerCreating once. */
export function settle(c: Cluster, seq: number) {
  c.clock += SECONDS_PER_COMMAND;
  for (const p of list(c, "Pod")) {
    if (Number(p.metadata.uid) >= seq) continue;
    if (startable(p)) start(c, p);
    else if (p.status === "Running" || p.status === "CrashLoopBackOff" || p.status === "OOMKilled") tick(p);
  }
}

/** Reconcile and start containers until nothing changes, as if the cluster had been running for a while. */
export function converge(c: Cluster) {
  for (let i = 0; i < 100; i++) {
    const before = canonical(c.resources);
    reconcile(c);
    for (const p of list(c, "Pod")) if (startable(p)) start(c, p);
    if (canonical(c.resources) === before) return;
  }
}
