import { LABEL_KEY_RE, LABEL_VALUE_RE } from "../manifest-schema";
import { age, eventsSection, fail, table, type Parsed } from "./cli";
import { find, isFinished, list } from "./cluster";
import { eventsOf, recordEvent } from "./events";
import { formatCpu, formatMemory, parseCpu, parseMemory } from "./quantity";
import { nodeTaints, podsOnNode } from "./scheduler";
import type { Cluster, Node, Pod, Taint, TaintEffect } from "./types";

const VERSION = "v1.33.0";
const EFFECTS: TaintEffect[] = ["NoSchedule", "PreferNoSchedule", "NoExecute"];
const ROLE_PREFIX = "node-role.kubernetes.io/";

export const nodeRoles = (n: Node) =>
  Object.keys(n.metadata.labels).filter((k) => k.startsWith(ROLE_PREFIX)).map((k) => k.slice(ROLE_PREFIX.length)).sort().join(",") || "<none>";

const nodeStatus = (n: Node) => (n.unschedulable ? "Ready,SchedulingDisabled" : "Ready");

/** control-plane .2, worker-N .N+2, like a kind cluster's Docker network. */
export const nodeIP = (n: Node) => `172.18.0.${Number(n.metadata.name.match(/-(\d+)$/)?.[1] ?? 0) + 2}`;

export const NODE_HEADER = ["NAME", "STATUS", "ROLES", "AGE", "VERSION"];
export const NODE_WIDE_HEADER = ["INTERNAL-IP", "EXTERNAL-IP", "OS-IMAGE", "KERNEL-VERSION", "CONTAINER-RUNTIME"];

export function nodeRow(c: Cluster, n: Node, wide: boolean): string[] {
  const row = [n.metadata.name, nodeStatus(n), nodeRoles(n), age(c, n.metadata.createdAt), VERSION];
  return wide ? [...row, nodeIP(n), "<none>", "Debian GNU/Linux 12 (bookworm)", "6.8.0-generic", "containerd://2.0.3"] : row;
}

export const taintText = (t: Taint) => `${t.key}${t.value ? `=${t.value}` : ""}:${t.effect}`;

export function nodeManifest(n: Node, live: boolean) {
  const resources = { cpu: n.allocatable.cpu, memory: n.allocatable.memory, pods: String(n.allocatable.pods) };
  const spec = { taints: n.taints.length ? n.taints : undefined, unschedulable: n.unschedulable || undefined };
  return {
    apiVersion: "v1",
    kind: "Node",
    metadata: { name: n.metadata.name, labels: n.metadata.labels, annotations: Object.keys(n.metadata.annotations).length ? n.metadata.annotations : undefined },
    spec: live ? { ...spec, taints: nodeTaints(n).length ? nodeTaints(n) : undefined } : spec,
    ...(live && {
      status: {
        allocatable: resources,
        capacity: resources,
        addresses: [{ type: "InternalIP", address: nodeIP(n) }, { type: "Hostname", address: n.metadata.name }],
        nodeInfo: { kubeletVersion: VERSION, containerRuntimeVersion: "containerd://2.0.3", operatingSystem: "linux", architecture: "amd64" },
      },
    }),
  };
}

const indentList = (items: string[], width: number) => items.join(`\n${" ".repeat(width)}`) || "<none>";

export function describeNode(c: Cluster, n: Node): string {
  const head = (k: string, v: string) => `${(k + ":").padEnd(20)}${v}`;
  const pods = podsOnNode(c, n.metadata.name);
  const cpuAlloc = parseCpu(n.allocatable.cpu)!;
  const memAlloc = parseMemory(n.allocatable.memory)!;
  const cell = (v: number, total: number, fmt: (x: number) => string) => `${fmt(v)} (${Math.floor((v / total) * 100)}%)`;
  const amount = (p: Pod, field: "requests" | "limits", r: "cpu" | "memory") => {
    const q = p.container.resources?.[field]?.[r];
    return q ? (r === "cpu" ? parseCpu(q)! : parseMemory(q)!) : 0;
  };
  const sum = (field: "requests" | "limits", r: "cpu" | "memory") => pods.reduce((s, p) => s + amount(p, field, r), 0);
  const podRows = pods.map((p) => [
    p.metadata.namespace,
    p.metadata.name,
    cell(amount(p, "requests", "cpu"), cpuAlloc, formatCpu),
    cell(amount(p, "limits", "cpu"), cpuAlloc, formatCpu),
    cell(amount(p, "requests", "memory"), memAlloc, formatMemory),
    cell(amount(p, "limits", "memory"), memAlloc, formatMemory),
    age(c, p.metadata.createdAt),
  ]);
  const podTable = table([
    ["Namespace", "Name", "CPU Requests", "CPU Limits", "Memory Requests", "Memory Limits", "Age"],
    ["---------", "----", "------------", "----------", "---------------", "-------------", "---"],
    ...podRows,
  ]);
  const allocated = table([
    ["Resource", "Requests", "Limits"],
    ["--------", "--------", "------"],
    ["cpu", cell(sum("requests", "cpu"), cpuAlloc, formatCpu), cell(sum("limits", "cpu"), cpuAlloc, formatCpu)],
    ["memory", cell(sum("requests", "memory"), memAlloc, formatMemory), cell(sum("limits", "memory"), memAlloc, formatMemory)],
  ]);
  const indent = (text: string) => text.replace(/^/gm, "  ");
  return [
    head("Name", n.metadata.name),
    head("Roles", nodeRoles(n)),
    head("Labels", indentList(Object.entries(n.metadata.labels).map(([k, v]) => `${k}=${v}`), 20)),
    head("Annotations", indentList(Object.entries(n.metadata.annotations).map(([k, v]) => `${k}: ${v}`), 20)),
    head("Taints", indentList(nodeTaints(n).map(taintText), 20)),
    head("Unschedulable", String(n.unschedulable)),
    "Addresses:",
    `  InternalIP:  ${nodeIP(n)}`,
    `  Hostname:    ${n.metadata.name}`,
    "Allocatable:",
    `  cpu:     ${n.allocatable.cpu}`,
    `  memory:  ${n.allocatable.memory}`,
    `  pods:    ${n.allocatable.pods}`,
    `${"Non-terminated Pods:".padEnd(30)}(${pods.length} in total)`,
    indent(podTable),
    "Allocated resources:",
    "  (Total limits may be over 100 percent, i.e., overcommitted.)",
    indent(allocated),
    eventsSection(c, eventsOf(c, n)),
  ].join("\n");
}

/** The node named by `nodes <name>`, `node/<name>` or just `<name>` (cordon, drain). */
function nodeArg(c: Cluster, p: Parsed, typed: boolean): [Node, string[]] {
  let [first, ...rest] = p.args;
  if (typed) {
    if (first?.includes("/")) {
      const [type, name] = first.split("/");
      if (!["no", "node", "nodes"].includes(type)) fail(`error: ${p.verb} only works on nodes`);
      first = name;
    } else {
      if (!["no", "node", "nodes"].includes(first ?? "")) fail(`error: use kubectl ${p.verb} nodes <name> ...`);
      [first, ...rest] = rest;
    }
  } else if (first?.startsWith("node/")) first = first.slice(5);
  if (!first) fail(`error: specify the node, e.g. kubectl ${p.verb} ${typed ? "nodes " : ""}worker-1`);
  return [find(c, "Node", "", first) ?? fail(`Error from server (NotFound): nodes "${first}" not found`), rest];
}

type TaintChange = { remove: boolean; key: string; value?: string; effect?: TaintEffect };

function parseTaint(spec: string): TaintChange {
  const remove = spec.endsWith("-");
  const body = remove ? spec.slice(0, -1) : spec;
  const colon = body.lastIndexOf(":");
  const [kv, effect] = colon === -1 ? [body, undefined] : [body.slice(0, colon), body.slice(colon + 1)];
  const eq = kv.indexOf("=");
  const key = eq === -1 ? kv : kv.slice(0, eq);
  const value = eq === -1 ? undefined : kv.slice(eq + 1);
  if (!LABEL_KEY_RE.test(key)) fail(`error: invalid taint spec: ${spec}, invalid key "${key}"`);
  if (value !== undefined && !LABEL_VALUE_RE.test(value)) fail(`error: invalid taint spec: ${spec}, invalid value "${value}"`);
  if (effect !== undefined && !EFFECTS.includes(effect as TaintEffect)) {
    fail(`error: invalid taint effect: ${effect}, unsupported taint effect`);
  }
  if (!remove && effect === undefined) fail(`error: invalid taint spec: ${spec}, use key=value:Effect, key:Effect, key:Effect- or key-`);
  return { remove, key, value: value || undefined, effect: effect as TaintEffect | undefined };
}

export function taint(c: Cluster, p: Parsed): string {
  const [n, specs] = nodeArg(c, p, true);
  if (!specs.length) fail("error: at least one taint update is required, e.g. dedicated=batch:NoSchedule or dedicated-");
  const changes = specs.map(parseTaint);
  let added = false;
  let removed = false;
  for (const ch of changes) {
    const same = (t: Taint) => t.key === ch.key && (!ch.effect || t.effect === ch.effect);
    if (ch.remove) {
      if (!n.taints.some(same)) fail(`error: taint "${ch.key}${ch.effect ? `:${ch.effect}` : ""}" not found`);
      n.taints = n.taints.filter((t) => !same(t));
      removed = true;
      continue;
    }
    if (n.taints.some(same) && !p.overwrite) {
      fail(`error: node ${n.metadata.name} already has ${ch.key} taint(s) with same effect(s) and --overwrite is false`);
    }
    n.taints = [...n.taints.filter((t) => !same(t)), { key: ch.key, ...(ch.value && { value: ch.value }), effect: ch.effect! }];
    added = true;
  }
  return `node/${n.metadata.name} ${added && removed ? "modified" : added ? "tainted" : "untainted"}`;
}

export function cordon(c: Cluster, p: Parsed, on: boolean): string {
  const [n, rest] = nodeArg(c, p, false);
  if (rest.length) fail(`error: unexpected argument "${rest[0]}"`);
  return setUnschedulable(c, n, on);
}

function setUnschedulable(c: Cluster, n: Node, on: boolean): string {
  const word = on ? "cordoned" : "uncordoned";
  if (n.unschedulable === on) return `node/${n.metadata.name} already ${word}`;
  n.unschedulable = on;
  const status = on ? "NodeNotSchedulable" : "NodeSchedulable";
  recordEvent(c, n, "Normal", status, `Node ${n.metadata.name} status is now: ${status}`, "kubelet");
  return `node/${n.metadata.name} ${word}`;
}

/** Owner kinds whose Pods drain leaves alone with --ignore-daemonsets. Part B adds DaemonSet Pods. */
const DAEMON_OWNERS: string[] = ["DaemonSet"];

// Pod volumes arrive in Part B; this reads them without depending on that type yet.
const hasLocalStorage = (p: Pod): boolean => (p as { spec?: { volumes?: { emptyDir?: object }[] } }).spec?.volumes?.some((v) => v.emptyDir) ?? false;

export function drain(c: Cluster, p: Parsed): string {
  const [n, rest] = nodeArg(c, p, false);
  if (rest.length) fail(`error: unexpected argument "${rest[0]}"`);
  const name = n.metadata.name;
  const lines = [setUnschedulable(c, n, true)];
  const pods = list(c, "Pod").filter((x) => x.node === name).sort((a, b) => (`${a.metadata.namespace}/${a.metadata.name}` < `${b.metadata.namespace}/${b.metadata.name}` ? -1 : 1));
  const ref = (x: Pod) => `${x.metadata.namespace}/${x.metadata.name}`;
  const daemon = pods.filter((x) => x.owner && DAEMON_OWNERS.includes(x.ownerKind ?? ""));
  const local = pods.filter((x) => !daemon.includes(x) && !isFinished(x) && hasLocalStorage(x));
  const unmanaged = pods.filter((x) => !x.owner && !isFinished(x));
  const fatal: string[] = [];
  const warnings: string[] = [];
  const check = (group: Pod[], allowed: boolean, error: string, warning: string) => {
    if (!group.length) return;
    if (allowed) warnings.push(`${warning}: ${group.map(ref).join(", ")}`);
    else fatal.push(`${error}: ${group.map(ref).join(", ")}`);
  };
  check(daemon, p.ignoreDaemonsets, "cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore)", "ignoring DaemonSet-managed Pods");
  check(local, p.deleteEmptydirData, "cannot delete Pods with local storage (use --delete-emptydir-data to override)", "deleting Pods with local storage");
  check(unmanaged, p.force, "cannot delete Pods that declare no controller (use --force to override)", "deleting Pods that declare no controller");
  if (fatal.length) {
    const error = fatal.length === 1 ? fatal[0] : `[${fatal.join(", ")}]`;
    fail([...lines, `error: unable to drain node "${name}" due to error: ${error}, continuing command...`, "There are pending nodes to be drained:", ` ${name}`, `error: ${error}`].join("\n"));
  }
  if (warnings.length) lines.push(`Warning: ${warnings.join("; ")}`);
  const evict = pods.filter((x) => !daemon.includes(x));
  lines.push(...evict.map((x) => `evicting pod ${ref(x)}`), ...evict.map((x) => `pod/${x.metadata.name} evicted`));
  c.resources = c.resources.filter((r) => !evict.includes(r as Pod));
  lines.push(`node/${name} drained`);
  return lines.join("\n");
}
