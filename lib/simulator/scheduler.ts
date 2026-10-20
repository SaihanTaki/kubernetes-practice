import { find, isFinished, list, matches } from "./cluster";
import { recordEvent } from "./events";
import { parseCpu, parseMemory } from "./quantity";
import { bindForPod, claimProblem, volumeNodeConflict } from "./storage";
import type { Cluster, LabelSelector, Labels, MatchExpression, Node, NodeSelectorTerm, Pod, PodSpec, Taint, Toleration } from "./types";

export const UNSCHEDULABLE_TAINT = "node.kubernetes.io/unschedulable";

/** The node's taints, plus the one the node controller adds while it is cordoned. */
export function nodeTaints(n: Node): Taint[] {
  const cordon = n.unschedulable && !n.taints.some((t) => t.key === UNSCHEDULABLE_TAINT);
  return cordon ? [...n.taints, { key: UNSCHEDULABLE_TAINT, effect: "NoSchedule" }] : n.taints;
}

export function tolerates(tolerations: Toleration[] = [], t: Taint): boolean {
  return tolerations.some(
    (tol) =>
      (!tol.effect || tol.effect === t.effect) &&
      (tol.operator === "Exists" ? !tol.key || tol.key === t.key : tol.key === t.key && (tol.value ?? "") === (t.value ?? "")),
  );
}

export function expressionMatches(labels: Labels, e: MatchExpression): boolean {
  const has = Object.hasOwn(labels, e.key);
  switch (e.operator) {
    case "In":
      return has && !!e.values?.includes(labels[e.key]);
    case "NotIn":
      return !has || !e.values?.includes(labels[e.key]);
    case "Exists":
      return has;
    case "DoesNotExist":
      return !has;
  }
}

export const selectorMatches = (labels: Labels, s: LabelSelector = {}) =>
  matches(labels, s.matchLabels ?? {}) && (s.matchExpressions ?? []).every((e) => expressionMatches(labels, e));

const termMatches = (labels: Labels, t: NodeSelectorTerm) => (t.matchExpressions ?? []).every((e) => expressionMatches(labels, e));

/** Requests of the Pod in millicores and bytes. */
export function podRequests(p: Pod) {
  const r = p.container.resources?.requests;
  return { cpu: parseCpu(r?.cpu ?? "0") ?? 0, memory: parseMemory(r?.memory ?? "0") ?? 0 };
}

export const podsOnNode = (c: Cluster, node: string) => list(c, "Pod").filter((p) => p.node === node && !isFinished(p));

const taintText = (t: Taint) => `{${t.key}: ${t.value ?? ""}}`;

/** Resource failures leave room for preemption; everything else cannot be fixed by evicting Pods. */
const RESOURCE_REASONS = ["Insufficient cpu", "Insufficient memory", "Too many pods"];

/** Why cordon, taints, nodeSelector or required node affinity rule the node out for this spec, or null. */
export function nodeMismatch(spec: PodSpec | undefined, n: Node): string | null {
  const tolerations = spec?.tolerations;
  if (n.unschedulable && !tolerates(tolerations, { key: UNSCHEDULABLE_TAINT, effect: "NoSchedule" })) return "node(s) were unschedulable";
  const taint = n.taints.find((t) => t.effect !== "PreferNoSchedule" && !tolerates(tolerations, t));
  if (taint) return `node(s) had untolerated taint ${taintText(taint)}`;
  const labels = n.metadata.labels;
  const terms = spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms;
  if (!matches(labels, spec?.nodeSelector ?? {}) || (terms && !terms.some((t) => termMatches(labels, t)))) {
    return "node(s) didn't match Pod's node affinity/selector";
  }
  return null;
}

/** Why the Pod cannot run on the node, as the scheduler's filter plugins report it (first failing plugin). */
function filter(c: Cluster, p: Pod, n: Node): string[] {
  const mismatch = nodeMismatch(p.spec, n);
  if (mismatch) return [mismatch];
  if (volumeNodeConflict(c, p, n)) return ["node(s) had volume node affinity conflict"];

  const others = podsOnNode(c, n.metadata.name).filter((q) => q !== p);
  const want = podRequests(p);
  const used = others.map(podRequests).reduce((a, b) => ({ cpu: a.cpu + b.cpu, memory: a.memory + b.memory }), { cpu: 0, memory: 0 });
  const short: string[] = [];
  if (others.length + 1 > n.allocatable.pods) short.push("Too many pods");
  if (want.cpu && used.cpu + want.cpu > parseCpu(n.allocatable.cpu)!) short.push("Insufficient cpu");
  if (want.memory && used.memory + want.memory > parseMemory(n.allocatable.memory)!) short.push("Insufficient memory");
  if (short.length) return short;

  if (antiAffinityConflict(c, p, n)) return ["node(s) didn't match pod anti-affinity rules"];
  return [];
}

/** Whether a scheduled Pod in the same topology domain as `n` rules out `p`, or `p` rules it out. */
function antiAffinityConflict(c: Cluster, p: Pod, n: Node): boolean {
  const ns = p.metadata.namespace;
  const sameDomain = (q: Pod, key: string) => {
    const value = n.metadata.labels[key];
    const other = q.node ? find(c, "Node", "", q.node) : undefined;
    return value !== undefined && other?.metadata.labels[key] === value;
  };
  const terms = (q: Pod) => q.spec?.affinity?.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution ?? [];
  const placed = list(c, "Pod", ns).filter((q) => q !== p && q.node && !isFinished(q));
  return placed.some(
    (q) =>
      terms(p).some((t) => selectorMatches(q.metadata.labels, t.labelSelector) && sameDomain(q, t.topologyKey)) ||
      terms(q).some((t) => selectorMatches(p.metadata.labels, t.labelSelector) && sameDomain(q, t.topologyKey)),
  );
}

function score(p: Pod, n: Node): number {
  const preferred = p.spec?.affinity?.nodeAffinity?.preferredDuringSchedulingIgnoredDuringExecution ?? [];
  return preferred.reduce((sum, t) => sum + (termMatches(n.metadata.labels, t.preference) ? t.weight : 0), 0);
}

const counted = (reasons: string[]) => {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts].map(([r, n]) => `${n} ${r}`).sort().join(", ");
};

/** Picks a node for the Pod, or returns the FailedScheduling message. */
export function place(c: Cluster, p: Pod): Node | string {
  const nodes = list(c, "Node");
  const blocked = claimProblem(c, p);
  if (blocked) return `0/${nodes.length} nodes are available: ${blocked}. preemption: 0/${nodes.length} nodes are available: ${nodes.length} Preemption is not helpful for scheduling.`;
  const results = nodes.map((n) => ({ n, reasons: filter(c, p, n) }));
  const feasible = results.filter((r) => !r.reasons.length).map((r) => r.n);
  if (feasible.length) {
    const load = (n: Node) => podsOnNode(c, n.metadata.name).length;
    return feasible.sort((a, b) => score(p, b) - score(p, a) || load(a) - load(b) || (a.metadata.name < b.metadata.name ? -1 : 1))[0];
  }
  const total = `0/${nodes.length} nodes are available`;
  const preemption = results.map((r) => (r.reasons.some((x) => RESOURCE_REASONS.includes(x)) ? "No preemption victims found for incoming pod" : "Preemption is not helpful for scheduling"));
  return `${total}: ${counted(results.flatMap((r) => r.reasons))}. preemption: ${total}: ${counted(preemption)}.`;
}

/** Binds every unscheduled Pod, oldest first; Pods that fit nowhere stay Pending with a FailedScheduling event. */
export function schedule(c: Cluster) {
  const waiting = list(c, "Pod").filter((p) => !p.node).sort((a, b) => Number(a.metadata.uid) - Number(b.metadata.uid));
  for (const p of waiting) {
    const wanted = p.spec?.nodeName;
    if (wanted) {
      // spec.nodeName skips the scheduler; the Pod waits if that node does not exist.
      if (find(c, "Node", "", wanted)) bind(c, p, wanted);
      continue;
    }
    const result = place(c, p);
    if (typeof result === "string") {
      p.status = "Pending";
      recordEvent(c, p, "Warning", "FailedScheduling", result, "default-scheduler");
    } else {
      bind(c, p, result.metadata.name);
      recordEvent(c, p, "Normal", "Scheduled", `Successfully assigned ${p.metadata.namespace}/${p.metadata.name} to ${result.metadata.name}`, "default-scheduler");
    }
  }
}

function bind(c: Cluster, p: Pod, node: string) {
  p.node = node;
  bindForPod(c, p, node);
  if (p.status === "Pending") p.status = "ContainerCreating";
}

// shortcut: tolerationSeconds is ignored, a matching toleration tolerates a NoExecute taint forever.
/** Deletes Pods running on a node with a NoExecute taint they do not tolerate; controllers replace them. */
export function evictUntolerated(c: Cluster) {
  const evicted = new Set<Pod>();
  for (const n of list(c, "Node")) {
    const noExecute = n.taints.filter((t) => t.effect === "NoExecute");
    if (!noExecute.length) continue;
    for (const p of podsOnNode(c, n.metadata.name)) {
      if (noExecute.every((t) => tolerates(p.spec?.tolerations, t))) continue;
      recordEvent(c, p, "Normal", "TaintManagerEviction", `Marking for deletion Pod ${p.metadata.namespace}/${p.metadata.name}`, "taint-eviction-controller");
      evicted.add(p);
    }
  }
  if (evicted.size) c.resources = c.resources.filter((r) => !evicted.has(r as Pod));
}
