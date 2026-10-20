import { age, fail, table, type Parsed } from "./cli";
import { configError, crashes, find, hash, isReady, list, podsOfOwner, probeFailure, pullError, SECONDS_PER_COMMAND } from "./cluster";
import { imageInfo } from "./images";
import { MI, parseCpu, parseMemory } from "./quantity";
import type { Cluster, ClusterEvent, Pod, PodOwnerKind, Probe } from "./types";

/** Warnings the kubelet would have recorded for the Pod's current state; derived, not stored. */
export function kubeletEvents(c: Cluster, p: Pod): ClusterEvent[] {
  const events: [ClusterEvent["type"], string, string][] = [];
  const name = p.container.name;
  if (p.status === "ImagePullBackOff") {
    events.push(["Warning", "Failed", pullError(p.image)!], ["Normal", "BackOff", `Back-off pulling image "${p.image}"`]);
  }
  if (p.status === "CreateContainerConfigError") events.push(["Warning", "Failed", `Error: ${configError(c, p)}`]);
  if (p.status === "Running" || p.status === "CrashLoopBackOff") {
    const failures: [string, Probe | undefined][] = [
      ["Startup", p.container.startupProbe],
      ["Liveness", p.container.livenessProbe],
      ["Readiness", p.container.readinessProbe],
    ];
    for (const [kind, probe] of failures) {
      const why = probeFailure(p, probe);
      if (!why) continue;
      events.push(["Warning", "Unhealthy", `${kind} probe failed: ${why}`]);
      if (kind !== "Readiness") events.push(["Normal", "Killing", `Container ${name} failed ${kind.toLowerCase()} probe, will be restarted`]);
    }
    if (p.status === "CrashLoopBackOff" && crashes(p)) {
      events.push(["Warning", "BackOff", `Back-off restarting failed container ${name} in pod ${p.metadata.name}`]);
    }
  }
  const { uid, namespace, name: podName, createdAt } = p.metadata;
  // The kubelet acts once the Pod is bound, one command after it was created.
  const at = Math.min(c.clock, createdAt + SECONDS_PER_COMMAND);
  return events.map(([type, reason, message]) => ({
    uid, kind: "Pod", namespace, name: podName, type, reason, message, source: "kubelet", count: 1, firstSeen: at, lastSeen: at,
  }));
}

/** Stored events plus the derived kubelet ones, oldest first. */
export function allEvents(c: Cluster): ClusterEvent[] {
  const derived = list(c, "Pod").flatMap((p) => kubeletEvents(c, p));
  return [...c.events, ...derived].map((e, i) => ({ e, i })).sort((a, b) => a.e.lastSeen - b.e.lastSeen || a.i - b.i).map(({ e }) => e);
}

const FIELDS: Record<string, (e: ClusterEvent) => string> = {
  "involvedObject.name": (e) => e.name,
  "involvedObject.kind": (e) => e.kind,
  type: (e) => e.type,
  reason: (e) => e.reason,
};

export function getEvents(c: Cluster, p: Parsed): string {
  let events = allEvents(c).filter((e) => p.allNamespaces || e.namespace === p.namespace);
  for (const part of p.fieldSelector?.split(",") ?? []) {
    const m = part.match(/^([^=!]+)(!=|==|=)(.*)$/);
    const field = m && Object.hasOwn(FIELDS, m[1]) ? FIELDS[m[1]] : fail(`error: field label not supported: ${m?.[1] ?? part}\nSupported: ${Object.keys(FIELDS).join(", ")}`);
    events = events.filter((e) => (field(e) === m![3]) === (m![2] !== "!="));
  }
  if (!events.length) return p.allNamespaces ? "No resources found" : `No resources found in ${p.namespace} namespace.`;
  const rows = events.map((e) => [
    ...(p.allNamespaces ? [e.namespace] : []),
    age(c, e.lastSeen), e.type, e.reason, `${e.kind.toLowerCase()}/${e.name}`, e.message,
  ]);
  return table([[...(p.allNamespaces ? ["NAMESPACE"] : []), "LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], ...rows]);
}

/** Workload types `kubectl logs <type>/<name>` accepts. Part B adds jobs here. */
export const LOG_OWNERS: Record<string, "Deployment" | PodOwnerKind> = {
  deploy: "Deployment", deployment: "Deployment", deployments: "Deployment",
  rs: "ReplicaSet", replicaset: "ReplicaSet", replicasets: "ReplicaSet",
};

const WAITING: Partial<Record<Pod["status"], string>> = {
  Pending: "ContainerCreating",
  ContainerCreating: "ContainerCreating",
  ImagePullBackOff: "trying and failing to pull image",
  CreateContainerConfigError: "CreateContainerConfigError",
};

function logPod(c: Cluster, p: Parsed): { pod: Pod; note?: string } {
  const [ref, extra] = p.args;
  if (!ref) fail("error: expected 'logs POD_NAME' or 'logs TYPE/NAME', e.g. kubectl logs web or kubectl logs deployment/web");
  if (extra) fail(`error: unexpected argument "${extra}"`);
  const [type, name] = ref.includes("/") ? ref.split("/") : ["pod", ref];
  if (["po", "pod", "pods"].includes(type)) return { pod: find(c, "Pod", p.namespace, name) ?? fail(`Error from server (NotFound): pods "${name}" not found`) };
  const kind = Object.hasOwn(LOG_OWNERS, type) ? LOG_OWNERS[type] : fail(`error: cannot get logs from ${type}, use a pod, deployment/<name> or replicaset/<name>`);
  const pods = podsOfOwner(c, kind, p.namespace, name) ?? fail(`Error from server (NotFound): ${kind.toLowerCase()}s.apps "${name}" not found`);
  if (!pods.length) fail(`error: timed out waiting for the condition`);
  const sorted = [...pods].sort((a, b) => Number(isReady(b)) - Number(isReady(a)) || (a.metadata.name < b.metadata.name ? -1 : 1));
  return { pod: sorted[0], note: pods.length > 1 ? `Found ${pods.length} pods, using pod/${sorted[0].metadata.name}` : undefined };
}

export function logs(c: Cluster, p: Parsed): string {
  const { pod, note } = logPod(c, p);
  const ctr = pod.container.name;
  if (p.container !== undefined && p.container !== ctr) fail(`error: container ${p.container} is not valid for pod ${pod.metadata.name}`);
  const waiting = WAITING[pod.status];
  if (waiting) fail(`Error from server (BadRequest): container "${ctr}" in pod "${pod.metadata.name}" is waiting to start: ${waiting}`);
  if (p.previous && !pod.restarts) fail(`Error from server (BadRequest): previous terminated container "${ctr}" in pod "${pod.metadata.name}" not found`);
  const info = imageInfo(pod.image);
  let lines = info.logs?.(pod, info.tag) ?? [];
  if (p.tail !== undefined) lines = p.tail ? lines.slice(-p.tail) : [];
  return [...(note ? [note] : []), ...lines].join("\n");
}

const NODE_BASE: Record<string, { cpu: number; memoryMi: number }> = { "control-plane": { cpu: 150, memoryMi: 900 } };
const WORKER_BASE = { cpu: 40, memoryMi: 400 };

/** What metrics-server would report for a running container: millicores and MiB. */
export function podUsage(p: Pod) {
  const info = imageInfo(p.image);
  return { cpu: info.cpuMilli ?? (hash(p.metadata.uid) % 5) + 1, memoryMi: info.memoryMi };
}

export function top(c: Cluster, p: Parsed): string {
  const [what, name, extra] = p.args;
  if (extra) fail(`error: unexpected argument "${extra}"`);
  const running = (ns?: string) => list(c, "Pod", ns).filter((x) => x.status === "Running");
  if (["no", "node", "nodes"].includes(what)) {
    let nodes = list(c, "Node");
    if (name) nodes = nodes.filter((n) => n.metadata.name === name);
    if (name && !nodes.length) fail(`Error from server (NotFound): nodes "${name}" not found`);
    const rows = nodes.map((n) => {
      const base = NODE_BASE[n.metadata.name] ?? WORKER_BASE;
      const pods = running().filter((x) => x.node === n.metadata.name).map(podUsage);
      const cpu = pods.reduce((s, u) => s + u.cpu, base.cpu);
      const mem = pods.reduce((s, u) => s + u.memoryMi, base.memoryMi);
      const pct = (used: number, total: number) => `${Math.floor((used / total) * 100)}%`;
      return [n.metadata.name, `${cpu}m`, pct(cpu, parseCpu(n.allocatable.cpu)!), `${mem}Mi`, pct(mem * MI, parseMemory(n.allocatable.memory)!)];
    });
    return table([["NAME", "CPU(cores)", "CPU(%)", "MEMORY(bytes)", "MEMORY(%)"], ...rows]);
  }
  if (!["po", "pod", "pods"].includes(what)) fail("error: use kubectl top nodes or kubectl top pods");
  let pods = running(p.allNamespaces ? undefined : p.namespace);
  if (name) {
    pods = pods.filter((x) => x.metadata.name === name);
    if (!pods.length) fail(find(c, "Pod", p.namespace, name) ? `error: metrics not available yet` : `Error from server (NotFound): pods "${name}" not found`);
  }
  if (!pods.length) return p.allNamespaces ? "No resources found" : `No resources found in ${p.namespace} namespace.`;
  const rows = pods.map((x) => {
    const u = podUsage(x);
    return [...(p.allNamespaces ? [x.metadata.namespace] : []), x.metadata.name, `${u.cpu}m`, `${u.memoryMi}Mi`];
  });
  return table([[...(p.allNamespaces ? ["NAMESPACE"] : []), "NAME", "CPU(cores)", "MEMORY(bytes)"], ...rows]);
}
