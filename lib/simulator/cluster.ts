import type {
  Cluster,
  Container,
  Deployment,
  Kind,
  Labels,
  Pod,
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
export const SECONDS_PER_COMMAND = 5;
export const REVISION = "deployment.kubernetes.io/revision";
export const CHANGE_CAUSE = "kubernetes.io/change-cause";
export const HASH_LABEL = "pod-template-hash";

export function hash(input: string): number {
  let h = 2166136261;
  for (const ch of input) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function suffix(seed: number, length: number): string {
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

export function find<K extends Kind>(c: Cluster, kind: K, namespace: string, name: string) {
  return c.resources.find(
    (r) => r.kind === kind && r.metadata.namespace === namespace && r.metadata.name === name,
  ) as Extract<Resource, { kind: K }> | undefined;
}

export function list<K extends Kind>(c: Cluster, kind: K, namespace?: string) {
  return c.resources.filter(
    (r) => r.kind === kind && (namespace === undefined || r.metadata.namespace === namespace),
  ) as Extract<Resource, { kind: K }>[];
}

export const isReady = (p: Pod) => p.status === "Running" && p.ready;

export function podsOf(c: Cluster, rs: ReplicaSet): Pod[] {
  return list(c, "Pod", rs.metadata.namespace).filter((p) => p.owner === rs.metadata.name);
}

export function replicaSetsOf(c: Cluster, d: Deployment): ReplicaSet[] {
  return list(c, "ReplicaSet", d.metadata.namespace).filter((rs) => rs.owner === d.metadata.name);
}

const templateHash = (t: PodTemplate) => suffix(hash(canonical(t)), 10);

export function currentReplicaSet(c: Cluster, d: Deployment) {
  return find(c, "ReplicaSet", d.metadata.namespace, `${d.metadata.name}-${templateHash(d.template)}`);
}

export const revisionOf = (rs: ReplicaSet) => Number(rs.metadata.annotations[REVISION] ?? 0);

export const containerName = (image: string) => image.split(":")[0].split("/").at(-1)!;

export function newPod(c: Cluster, name: string, namespace: string, t: PodTemplate): Pod {
  const node = WORKERS[c.seq % WORKERS.length];
  return {
    kind: "Pod",
    metadata: meta(c, name, namespace, t.labels, t.annotations),
    image: t.image,
    container: structuredClone(t.container),
    node,
    status: "ContainerCreating",
    ready: false,
    restarts: 0,
  };
}

/** Stable per Pod: each worker gets its own /24 like a real CNI. */
export function podIP(p: Pod): string {
  return `10.244.${WORKERS.indexOf(p.node) + 1}.${(Number(p.metadata.uid) % 250) + 2}`;
}

// --- Container runtime: what each known image does ---

type ImageInfo = { tags: string[]; http?: number; paths?: string[]; tcp?: number; crashes?: string[] };

const IMAGES: Record<string, ImageInfo> = {
  nginx: { tags: ["1.25", "1.26", "1.27", "1.28", "latest"], http: 80, paths: ["/"] },
  httpd: { tags: ["2.4", "latest"], http: 80, paths: ["/"] },
  redis: { tags: ["7", "7.2", "latest"], tcp: 6379 },
  busybox: { tags: ["1.36", "latest"] },
  "example/api": { tags: ["1.0", "1.1", "2.0", "latest"], http: 8080, paths: ["/", "/healthz", "/ready"], crashes: ["2.0"] },
};

function parseImage(image: string) {
  const colon = image.lastIndexOf(":");
  return colon > image.lastIndexOf("/") ? { repo: image.slice(0, colon), tag: image.slice(colon + 1) } : { repo: image, tag: "latest" };
}

/** Unknown repositories behave like nginx, so any image name works for simple examples. */
function imageInfo(image: string) {
  const { repo, tag } = parseImage(image);
  const info = IMAGES[repo];
  if (!info) return { ...IMAGES.nginx, pullable: true, crashes: false };
  return { ...info, pullable: info.tags.includes(tag), crashes: !!info.crashes?.includes(tag) };
}

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

/** Whether the container keeps getting restarted: a crashing image or a failing liveness or startup probe. */
export const crashes = (p: Pod) =>
  imageInfo(p.image).crashes || !!probeFailure(p, p.container.livenessProbe) || !!probeFailure(p, p.container.startupProbe);

/** Pull the image, resolve config references and start the container. */
export function start(c: Cluster, p: Pod) {
  p.ready = false;
  if (pullError(p.image)) p.status = "ImagePullBackOff";
  else if (configError(c, p)) p.status = "CreateContainerConfigError";
  else if (imageInfo(p.image).crashes) {
    p.status = "CrashLoopBackOff";
    p.restarts = Math.max(p.restarts, 1);
  } else {
    p.status = "Running";
    p.ready = !crashes(p) && !probeFailure(p, p.container.readinessProbe);
  }
}

// shortcut: probe timing is not simulated; a failing liveness probe restarts the container once per command.
function tick(p: Pod) {
  if (!crashes(p)) return;
  p.restarts++;
  if (imageInfo(p.image).crashes || p.restarts >= 3) p.status = "CrashLoopBackOff";
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

function createPod(c: Cluster, rs: ReplicaSet) {
  const pod = newPod(c, `${rs.metadata.name}-${suffix(c.seq, 5)}`, rs.metadata.namespace, rs.template);
  pod.owner = rs.metadata.name;
  c.resources.push(pod);
}

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
 * whose labels stop matching, and resources whose owner is gone are garbage collected.
 */
export function reconcile(c: Cluster) {
  for (const d of list(c, "Deployment")) reconcileDeployment(c, d);

  // shortcut: orphaned Pods are never adopted again, even if their labels match a selector later.
  for (const p of list(c, "Pod")) {
    const rs = p.owner ? find(c, "ReplicaSet", p.metadata.namespace, p.owner) : undefined;
    if (rs && !matches(p.metadata.labels, rs.selector)) p.owner = undefined;
  }

  // ReplicaSets first, so their Pods are collected in the same pass.
  c.resources = c.resources.filter(
    (r) => !(r.kind === "ReplicaSet" && r.owner && !find(c, "Deployment", r.metadata.namespace, r.owner)),
  );
  c.resources = c.resources.filter(
    (r) => !(r.kind === "Pod" && r.owner && !find(c, "ReplicaSet", r.metadata.namespace, r.owner)),
  );

  for (const rs of list(c, "ReplicaSet")) {
    const pods = podsOf(c, rs);
    for (let i = pods.length; i < rs.replicas; i++) createPod(c, rs);
    if (pods.length > rs.replicas) {
      // Remove not-ready and newest Pods first, like the real controller prefers.
      const extra = [...pods]
        .sort((a, b) => Number(isReady(a)) - Number(isReady(b)) || b.metadata.createdAt - a.metadata.createdAt)
        .slice(0, pods.length - rs.replicas);
      c.resources = c.resources.filter((r) => !extra.includes(r as Pod));
    }
  }
}

/** Advance the clock and the containers of Pods created before `seq`, so new Pods show ContainerCreating once. */
export function settle(c: Cluster, seq: number) {
  c.clock += SECONDS_PER_COMMAND;
  for (const p of list(c, "Pod")) {
    if (Number(p.metadata.uid) >= seq) continue;
    if (p.status === "ContainerCreating" || p.status === "CreateContainerConfigError") start(c, p);
    else if (p.status === "Running" || p.status === "CrashLoopBackOff") tick(p);
  }
}

/** Reconcile and start containers until nothing changes, as if the cluster had been running for a while. */
export function converge(c: Cluster) {
  for (let i = 0; i < 100; i++) {
    const before = canonical(c.resources);
    reconcile(c);
    for (const p of list(c, "Pod")) if (p.status === "ContainerCreating" || p.status === "CreateContainerConfigError") start(c, p);
    if (canonical(c.resources) === before) return;
  }
}
