import type { Cluster, Deployment, Fixture, Kind, Labels, Pod, PodTemplate, ReplicaSet, Resource } from "./types";

// Characters Kubernetes uses for generated name suffixes (no vowels, no look-alikes).
const ALPHABET = "bcdfghjklmnpqrstvwxz2456789";
const WORKERS = ["worker-1", "worker-2"];
const FIXTURE_AGE = 600;
export const SECONDS_PER_COMMAND = 5;

function hash(input: string): number {
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

export function meta(c: Cluster, name: string, namespace: string, labels: Labels) {
  return { uid: String(c.seq++), name, namespace, labels: { ...labels }, createdAt: c.clock };
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

export const isReady = (p: Pod) => p.status === "Running";

export function podsOf(c: Cluster, rs: ReplicaSet): Pod[] {
  return list(c, "Pod", rs.metadata.namespace).filter((p) => p.owner === rs.metadata.name);
}

export function replicaSetsOf(c: Cluster, d: Deployment): ReplicaSet[] {
  return list(c, "ReplicaSet", d.metadata.namespace).filter((rs) => rs.owner === d.metadata.name);
}

function templateHash(t: PodTemplate): string {
  return suffix(hash(JSON.stringify(t)), 10);
}

export function currentReplicaSet(c: Cluster, d: Deployment) {
  return find(c, "ReplicaSet", d.metadata.namespace, `${d.metadata.name}-${templateHash(d.template)}`);
}

export function newPod(c: Cluster, name: string, namespace: string, labels: Labels, image: string): Pod {
  const node = WORKERS[c.seq % WORKERS.length];
  return { kind: "Pod", metadata: meta(c, name, namespace, labels), image, node, status: "ContainerCreating", restarts: 0 };
}

function createPod(c: Cluster, rs: ReplicaSet) {
  const pod = newPod(c, `${rs.metadata.name}-${suffix(c.seq, 5)}`, rs.metadata.namespace, rs.template.labels, rs.template.image);
  pod.owner = rs.metadata.name;
  c.resources.push(pod);
}

/**
 * Simplified controllers: Deployments own one ReplicaSet per pod template,
 * ReplicaSets create or remove Pods to match their replica count, and
 * resources whose owner is gone are garbage collected.
 */
export function reconcile(c: Cluster) {
  for (const d of list(c, "Deployment")) {
    let rs = currentReplicaSet(c, d);
    if (!rs) {
      rs = {
        kind: "ReplicaSet",
        metadata: meta(c, `${d.metadata.name}-${templateHash(d.template)}`, d.metadata.namespace, d.template.labels),
        owner: d.metadata.name,
        replicas: d.replicas,
        selector: { ...d.selector },
        template: structuredClone(d.template),
      };
      c.resources.push(rs);
    }
    // A Deployment overrides manual scaling of the ReplicaSet it owns.
    rs.replicas = d.replicas;
    // Old ReplicaSets are kept for rollback but run no Pods.
    // shortcut: the switch to the new template is instant, not a gradual rolling update.
    for (const old of replicaSetsOf(c, d)) if (old !== rs) old.replicas = 0;
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

/** Advance the clock: containers of Pods created before `seq` that were being created are now running. */
export function settle(c: Cluster, seq: number) {
  c.clock += SECONDS_PER_COMMAND;
  for (const p of list(c, "Pod")) {
    if (p.status === "ContainerCreating" && Number(p.metadata.uid) < seq) p.status = "Running";
  }
}

export function createCluster(fixture: Fixture = {}): Cluster {
  const c: Cluster = {
    clock: -FIXTURE_AGE,
    seq: 1,
    nodes: ["control-plane", ...WORKERS],
    namespaces: ["default", "kube-system", ...(fixture.namespaces ?? [])],
    resources: [],
    files: { ...fixture.files },
  };
  const ns = (n?: string) => n ?? "default";
  for (const d of fixture.deployments ?? []) {
    c.resources.push({
      kind: "Deployment",
      metadata: meta(c, d.name, ns(d.namespace), d.labels),
      replicas: d.replicas,
      selector: { ...d.labels },
      template: { labels: { ...d.labels }, image: d.image },
    });
  }
  for (const r of fixture.replicaSets ?? []) {
    c.resources.push({
      kind: "ReplicaSet",
      metadata: meta(c, r.name, ns(r.namespace), r.labels),
      replicas: r.replicas,
      selector: { ...r.labels },
      template: { labels: { ...r.labels }, image: r.image },
    });
  }
  for (const p of fixture.pods ?? []) {
    c.resources.push({
      kind: "Pod",
      metadata: meta(c, p.name, ns(p.namespace), p.labels ?? {}),
      image: p.image,
      node: WORKERS[0],
      status: p.status ?? "Running",
      restarts: p.restarts ?? 0,
    });
  }
  reconcile(c);
  for (const p of list(c, "Pod")) if (p.status === "ContainerCreating") p.status = "Running";
  c.clock = 0;
  return c;
}
