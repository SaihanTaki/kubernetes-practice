import { stringify } from "yaml";
import { find, isReady, list, matches, podsOf, reconcile, replicaSetsOf, settle } from "./cluster";
import type { Cluster, Deployment, Kind, Labels, Pod, ReplicaSet, RunResult } from "./types";

class CommandError extends Error {}

type ResourceType = Kind | "Namespace" | "Node";

const TYPES: Record<string, ResourceType> = {
  po: "Pod", pod: "Pod", pods: "Pod",
  rs: "ReplicaSet", replicaset: "ReplicaSet", replicasets: "ReplicaSet",
  deploy: "Deployment", deployment: "Deployment", deployments: "Deployment",
  ns: "Namespace", namespace: "Namespace", namespaces: "Namespace",
  no: "Node", node: "Node", nodes: "Node",
};

const PLURAL: Record<ResourceType, string> = {
  Pod: "pods", ReplicaSet: "replicasets", Deployment: "deployments", Namespace: "namespaces", Node: "nodes",
};

const GROUP: Record<ResourceType, string> = {
  Pod: "pod", ReplicaSet: "replicaset.apps", Deployment: "deployment.apps", Namespace: "namespace", Node: "node",
};

const NAME_RE = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;
const MAX_REPLICAS = 20;

export const HELP = `This is a simulated kubectl. No real cluster or shell is involved.

Supported commands:
  kubectl get <pods|replicasets|deployments|namespaces|nodes> [name]
  kubectl describe <pod|replicaset|deployment> <name>
  kubectl scale <deployment|replicaset> <name> --replicas=<n>
  kubectl delete <pod|deployment> <name>
  clear

Supported flags:
  -n, --namespace <ns>     use a namespace other than "default"
  -A, --all-namespaces     list across all namespaces (get only)
  -l, --selector <k=v>     filter by labels, e.g. -l app=web (get only)
  -o, --output yaml        print the resource as YAML (get only)`;

type Parsed = {
  verb: string;
  args: string[];
  namespace: string;
  allNamespaces: boolean;
  selector?: Labels;
  output?: "yaml";
  replicas?: number;
};

function fail(message: string): never {
  throw new CommandError(message);
}

function parseSelector(value: string): Labels {
  const labels: Labels = {};
  for (const pair of value.split(",")) {
    const [k, v, ...rest] = pair.split("=");
    if (!k || v === undefined || rest.length) fail(`error: invalid selector "${value}", use key=value`);
    labels[k] = v;
  }
  return labels;
}

function parse(input: string): Parsed {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] === "help") tokens.unshift("kubectl");
  if (tokens[0] !== "kubectl") fail(`command not found: ${tokens[0]}\nOnly kubectl commands are simulated. Type "kubectl help".`);
  const p: Parsed = { verb: tokens[1] ?? "help", args: [], namespace: "default", allNamespaces: false };

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("-")) {
      p.args.push(token);
      continue;
    }
    const eq = token.indexOf("=");
    const flag = eq === -1 ? token : token.slice(0, eq);
    const takeValue = () => {
      const value = eq === -1 ? tokens[++i] : token.slice(eq + 1);
      if (!value) fail(`error: flag needs an argument: ${flag}`);
      return value;
    };
    switch (flag) {
      case "-n":
      case "--namespace":
        p.namespace = takeValue();
        if (!NAME_RE.test(p.namespace)) fail(`error: invalid namespace "${p.namespace}"`);
        break;
      case "-A":
      case "--all-namespaces":
        p.allNamespaces = true;
        break;
      case "-l":
      case "--selector":
        p.selector = parseSelector(takeValue());
        break;
      case "-o":
      case "--output": {
        const value = takeValue();
        if (value !== "yaml") fail(`error: output format "${value}" is not supported in this simulator, use -o yaml`);
        p.output = "yaml";
        break;
      }
      case "--replicas": {
        const value = takeValue();
        if (!/^\d+$/.test(value)) fail(`error: invalid --replicas value "${value}", must be a whole number`);
        p.replicas = Number(value);
        break;
      }
      default:
        fail(`error: unknown flag: ${flag}\nType "kubectl help" for supported flags.`);
    }
  }
  return p;
}

/** Accepts both "pod web" and "pod/web" forms. */
function target(p: Parsed): { type: ResourceType; name?: string } {
  const [first, second] = p.args;
  if (!first) fail(`error: you must specify the type of resource to ${p.verb}`);
  const [typeName, slashName] = first.split("/");
  const type = TYPES[typeName.toLowerCase()];
  if (!type) fail(`error: the server doesn't have a resource type "${typeName}"\nSupported types: pods, replicasets, deployments, namespaces, nodes.`);
  const name = slashName ?? second;
  if (name !== undefined && !NAME_RE.test(name)) fail(`error: invalid resource name "${name}"`);
  if (p.args.length > (slashName ? 1 : 2)) fail(`error: unexpected argument "${p.args.at(-1)}"`);
  return { type, name };
}

function age(c: Cluster, createdAt: number): string {
  const s = c.clock - createdAt;
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function table(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((cell, i) => cell.padEnd(widths[i])).join("   ").trimEnd()).join("\n");
}

const labelText = (labels: Labels) =>
  Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(",") || "<none>";

function notFound(type: ResourceType, name: string): never {
  fail(`Error from server (NotFound): ${PLURAL[type]} "${name}" not found`);
}

function requireNamespace(c: Cluster, ns: string) {
  if (!c.namespaces.includes(ns)) fail(`Error from server (NotFound): namespaces "${ns}" not found`);
}

// A crash-looping Pod was started at least once, so Kubernetes keeps its phase at Running.
const phase = (p: Pod) => (p.status === "Running" || p.status === "CrashLoopBackOff" ? "Running" : "Pending");

function deploymentStatus(c: Cluster, d: Deployment) {
  const pods = replicaSetsOf(c, d).flatMap((rs) => podsOf(c, rs));
  return { total: pods.length, ready: pods.filter(isReady).length };
}

function manifest(c: Cluster, r: Pod | ReplicaSet | Deployment) {
  const metadata: Record<string, unknown> = {
    name: r.metadata.name,
    namespace: r.metadata.namespace,
    labels: r.metadata.labels,
  };
  if (r.kind !== "Deployment" && r.owner) {
    metadata.ownerReferences = [{ kind: r.kind === "Pod" ? "ReplicaSet" : "Deployment", name: r.owner }];
  }
  const containers = (image: string) => [{ name: image.split(":")[0], image }];
  if (r.kind === "Pod") {
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata,
      spec: { nodeName: r.node, containers: containers(r.image) },
      status: { phase: phase(r), reason: r.status === "Running" ? undefined : r.status, restartCount: r.restarts },
    };
  }
  const spec = {
    replicas: r.replicas,
    selector: { matchLabels: r.selector },
    template: { metadata: { labels: r.template.labels }, spec: { containers: containers(r.template.image) } },
  };
  if (r.kind === "ReplicaSet") {
    const pods = podsOf(c, r);
    return {
      apiVersion: "apps/v1", kind: "ReplicaSet", metadata, spec,
      status: { replicas: pods.length, readyReplicas: pods.filter(isReady).length },
    };
  }
  const s = deploymentStatus(c, r);
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata,
    spec: { ...spec, strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: "25%", maxUnavailable: "25%" } } },
    status: { replicas: s.total, readyReplicas: s.ready, availableReplicas: s.ready },
  };
}

function get(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  const nsLabel = p.allNamespaces ? "" : ` in ${p.namespace} namespace`;

  if (type === "Namespace" || type === "Node") {
    const names = type === "Namespace" ? c.namespaces : c.nodes;
    const picked = name ? names.filter((n) => n === name) : names;
    if (name && !picked.length) notFound(type, name);
    if (p.output) {
      const items = picked.map((n) => ({ apiVersion: "v1", kind: type, metadata: { name: n } }));
      return stringify(name ? items[0] : { apiVersion: "v1", kind: "List", items }).trimEnd();
    }
    if (type === "Namespace") return table([["NAME", "STATUS", "AGE"], ...picked.map((n) => [n, "Active", age(c, -600)])]);
    return table([
      ["NAME", "STATUS", "ROLES", "AGE", "VERSION"],
      ...picked.map((n) => [n, "Ready", n === "control-plane" ? "control-plane" : "<none>", age(c, -600), "v1.33.0"]),
    ]);
  }

  if (!p.allNamespaces && !name && !c.namespaces.includes(p.namespace)) return `No resources found${nsLabel}.`;
  let items = list(c, type, p.allNamespaces ? undefined : p.namespace);
  if (name) {
    if (p.allNamespaces) fail("error: a resource cannot be retrieved by name across all namespaces");
    items = items.filter((r) => r.metadata.name === name);
    if (!items.length) notFound(type, name);
  }
  if (p.selector) items = items.filter((r) => matches(r.metadata.labels, p.selector!));
  if (!items.length) return `No resources found${nsLabel}.`;

  if (p.output) {
    const docs = items.map((r) => manifest(c, r));
    return stringify(name ? docs[0] : { apiVersion: "v1", kind: "List", items: docs }).trimEnd();
  }

  const rows = items.map((r): string[] => {
    const created = age(c, r.metadata.createdAt);
    if (r.kind === "Pod") return [r.metadata.name, `${isReady(r) ? 1 : 0}/1`, r.status, String(r.restarts), created];
    if (r.kind === "ReplicaSet") {
      const pods = podsOf(c, r);
      return [r.metadata.name, String(r.replicas), String(pods.length), String(pods.filter(isReady).length), created];
    }
    const s = deploymentStatus(c, r);
    return [r.metadata.name, `${s.ready}/${r.replicas}`, String(s.total), String(s.ready), created];
  });
  const header = {
    Pod: ["NAME", "READY", "STATUS", "RESTARTS", "AGE"],
    ReplicaSet: ["NAME", "DESIRED", "CURRENT", "READY", "AGE"],
    Deployment: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"],
  }[type];
  if (p.allNamespaces) {
    return table([["NAMESPACE", ...header], ...rows.map((row, i) => [items[i].metadata.namespace, ...row])]);
  }
  return table([header, ...rows]);
}

function describe(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (!name) fail(`error: specify the ${type.toLowerCase()} name to describe`);
  if (type !== "Pod" && type !== "ReplicaSet" && type !== "Deployment") {
    fail(`error: describe ${PLURAL[type]} is not supported in this simulator`);
  }
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  const lines = (pairs: [string, string][]) => pairs.map(([k, v]) => `${(k + ":").padEnd(16)}${v}`).join("\n");

  if (r.kind === "Pod") {
    return lines([
      ["Name", r.metadata.name],
      ["Namespace", r.metadata.namespace],
      ["Node", r.node],
      ["Labels", labelText(r.metadata.labels)],
      ["Status", phase(r)],
      ["Controlled By", r.owner ? `ReplicaSet/${r.owner}` : "<none>"],
      ["Image", r.image],
      ["State", r.status === "Running" ? "Running" : `Waiting (reason: ${r.status})`],
      ["Ready", isReady(r) ? "True" : "False"],
      ["Restart Count", String(r.restarts)],
    ]);
  }
  if (r.kind === "ReplicaSet") {
    const pods = podsOf(c, r);
    const ready = pods.filter(isReady).length;
    return lines([
      ["Name", r.metadata.name],
      ["Namespace", r.metadata.namespace],
      ["Selector", labelText(r.selector)],
      ["Labels", labelText(r.metadata.labels)],
      ["Controlled By", r.owner ? `Deployment/${r.owner}` : "<none>"],
      ["Replicas", `${pods.length} current / ${r.replicas} desired`],
      ["Pods Status", `${ready} Running / ${pods.length - ready} Waiting`],
      ["Image", r.template.image],
    ]);
  }
  const s = deploymentStatus(c, r);
  const current = replicaSetsOf(c, r)[0];
  return lines([
    ["Name", r.metadata.name],
    ["Namespace", r.metadata.namespace],
    ["Labels", labelText(r.metadata.labels)],
    ["Selector", labelText(r.selector)],
    ["Replicas", `${r.replicas} desired | ${s.total} total | ${s.ready} available | ${s.total - s.ready} unavailable`],
    ["StrategyType", "RollingUpdate"],
    ["Image", r.template.image],
    ["NewReplicaSet", current ? `${current.metadata.name} (${podsOf(c, current).length}/${current.replicas} replicas created)` : "<none>"],
  ]);
}

function scale(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "Deployment" && type !== "ReplicaSet") fail(`error: cannot scale ${PLURAL[type]}, only deployments and replicasets`);
  if (!name) fail("error: specify the name of the resource to scale");
  if (p.replicas === undefined) fail("error: required flag --replicas not set, e.g. --replicas=3");
  if (p.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  r.replicas = p.replicas;
  return `${GROUP[type]}/${name} scaled`;
}

function remove(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "Pod" && type !== "Deployment") fail(`error: delete ${PLURAL[type]} is not supported in this simulator, only pods and deployments`);
  if (!name) fail("error: specify the name of the resource to delete");
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  c.resources = c.resources.filter((x) => x !== r);
  return `${GROUP[type]} "${name}" deleted`;
}

function execute(c: Cluster, p: Parsed): string {
  if (p.allNamespaces && p.verb !== "get") fail("error: -A is only supported with kubectl get");
  if ((p.selector || p.output) && p.verb !== "get") fail("error: -l and -o are only supported with kubectl get");
  if (p.replicas !== undefined && p.verb !== "scale") fail("error: --replicas is only supported with kubectl scale");
  switch (p.verb) {
    case "help":
    case "--help":
      return HELP;
    case "get":
      return get(c, p);
    case "describe":
      return describe(c, p);
    case "scale":
      return scale(c, p);
    case "delete":
      return remove(c, p);
    default:
      fail(`error: "kubectl ${p.verb}" is not supported in this simulator.\nType "kubectl help" for the supported commands.`);
  }
}

/** Runs one command against a copy of the cluster. The input is never executed, only parsed. */
export function run(cluster: Cluster, input: string): RunResult {
  if (!input.trim()) return { cluster, output: "", error: false };
  const c = structuredClone(cluster);
  let output: string;
  let error = false;
  try {
    output = execute(c, parse(input));
  } catch (e) {
    if (!(e instanceof CommandError)) throw e;
    output = e.message;
    error = true;
  }
  // Settle before reconciling so Pods created by this command stay ContainerCreating until the next one.
  settle(c);
  reconcile(c);
  return { cluster: c, output, error };
}
