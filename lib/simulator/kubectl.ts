import { parseAllDocuments, stringify } from "yaml";
import type { z } from "zod";
import { manifestSchema } from "../manifest-schema";
import { currentReplicaSet, find, isReady, list, matches, meta, newPod, podsOf, reconcile, replicaSetsOf, settle } from "./cluster";
import type { Cluster, Deployment, Kind, Labels, Pod, Resource, RunResult } from "./types";

type Manifest = z.infer<typeof manifestSchema>;

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
const IMAGE_RE = /^[a-z0-9./:_-]+$/;
const FILE_RE = /^[a-zA-Z0-9._-]+$/;
const PROTECTED_NAMESPACES = ["default", "kube-system"];
const MAX_REPLICAS = 20;

export const HELP = `This is a simulated kubectl. No real cluster or shell is involved.

Supported commands:
  kubectl get <pods|replicasets|deployments|namespaces|nodes> [name]
  kubectl describe <pod|replicaset|deployment> <name>
  kubectl create deployment <name> --image=<image> [--replicas=<n>]
  kubectl create namespace <name>
  kubectl run <name> --image=<image>
  kubectl set image deployment/<name> <container>=<image>
  kubectl scale <deployment|replicaset> <name> --replicas=<n>
  kubectl apply -f <file>
  kubectl delete <pod|deployment|namespace> <name>
  kubectl delete -f <file>
  ls                       list files
  cat <file>               print a file
  <kubectl command> > <file>
                           write the output to a file instead of printing it
  clear

Supported flags:
  -n, --namespace <ns>     use a namespace other than "default"
  -A, --all-namespaces     list across all namespaces (get only)
  -l, --selector <k=v>     filter by labels, e.g. -l app=web (get only)
  -o, --output yaml        print as YAML (get, or with --dry-run=client)
  -f, --filename <file>    manifest file (apply, delete)
  --image <image>          container image (create deployment, run)
  --replicas <n>           number of replicas (scale, create deployment)
  --dry-run=client         print what would be created without changing anything
                           (create deployment, run, apply)`;

type Parsed = {
  verb: string;
  args: string[];
  namespace: string;
  allNamespaces: boolean;
  selector?: Labels;
  output?: "yaml";
  replicas?: number;
  image?: string;
  filename?: string;
  dryRun: boolean;
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

function parse(tokens: string[]): Parsed {
  if (tokens[0] === "help") tokens.unshift("kubectl");
  if (tokens[0] !== "kubectl") fail(`command not found: ${tokens[0]}\nOnly kubectl commands are simulated. Type "kubectl help".`);
  const p: Parsed = { verb: tokens[1] ?? "help", args: [], namespace: "default", allNamespaces: false, dryRun: false };

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
        if (p.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
        break;
      }
      case "--image":
        p.image = takeValue();
        if (!IMAGE_RE.test(p.image)) fail(`error: invalid image "${p.image}", use lowercase letters, digits and . / : _ -`);
        break;
      case "-f":
      case "--filename":
        p.filename = takeValue();
        break;
      case "--dry-run":
        if (takeValue() !== "client") fail("error: only --dry-run=client is supported in this simulator");
        p.dryRun = true;
        break;
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

const containerName = (image: string) => image.split(":")[0];

/** `live: false` leaves out what only the server sets (status, owners, node), as a dry run prints. */
function manifest(c: Cluster, r: Resource, live = true) {
  const metadata: Record<string, unknown> = {
    name: r.metadata.name,
    namespace: r.metadata.namespace,
    labels: r.metadata.labels,
  };
  if (live && r.kind !== "Deployment" && r.owner) {
    metadata.ownerReferences = [{ kind: r.kind === "Pod" ? "ReplicaSet" : "Deployment", name: r.owner }];
  }
  const containers = (image: string) => [{ name: containerName(image), image }];
  if (r.kind === "Pod") {
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata,
      spec: live ? { nodeName: r.node, containers: containers(r.image) } : { containers: containers(r.image) },
      ...(live && {
        status: { phase: phase(r), reason: r.status === "Running" ? undefined : r.status, restartCount: r.restarts },
      }),
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
      ...(live && { status: { replicas: pods.length, readyReplicas: pods.filter(isReady).length } }),
    };
  }
  const s = deploymentStatus(c, r);
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata,
    spec: { ...spec, strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: "25%", maxUnavailable: "25%" } } },
    ...(live && { status: { replicas: s.total, readyReplicas: s.ready, availableReplicas: s.ready } }),
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
  const current = currentReplicaSet(c, r);
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
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  r.replicas = p.replicas;
  return `${GROUP[type]}/${name} scaled`;
}

function deleteResource(c: Cluster, type: Kind, namespace: string, name: string): string {
  requireNamespace(c, namespace);
  const r = find(c, type, namespace, name) ?? notFound(type, name);
  c.resources = c.resources.filter((x) => x !== r);
  return `${GROUP[type]} "${name}" deleted`;
}

function deleteNamespace(c: Cluster, name: string): string {
  if (PROTECTED_NAMESPACES.includes(name)) {
    fail(`Error from server (Forbidden): namespaces "${name}" is forbidden: this namespace may not be deleted`);
  }
  if (!c.namespaces.includes(name)) notFound("Namespace", name);
  c.namespaces = c.namespaces.filter((n) => n !== name);
  c.resources = c.resources.filter((r) => r.metadata.namespace !== name);
  return `namespace "${name}" deleted`;
}

function remove(c: Cluster, p: Parsed): string {
  if (p.filename) return deleteFromFile(c, p);
  const { type, name } = target(p);
  if (type === "ReplicaSet" || type === "Node") {
    fail(`error: delete ${PLURAL[type]} is not supported in this simulator, only pods, deployments and namespaces`);
  }
  if (!name) fail("error: specify the name of the resource to delete");
  return type === "Namespace" ? deleteNamespace(c, name) : deleteResource(c, type, p.namespace, name);
}

const requireImage = (p: Parsed) => p.image ?? fail("error: required flag --image not set, e.g. --image=nginx:1.27");

/** Adds a new resource, or with --dry-run=client only prints it. */
function createResource(c: Cluster, p: Parsed, r: Resource): string {
  const ref = `${GROUP[r.kind]}/${r.metadata.name}`;
  if (p.dryRun) return p.output ? stringify(manifest(c, r, false)).trimEnd() : `${ref} created (dry run)`;
  requireNamespace(c, r.metadata.namespace);
  if (find(c, r.kind, r.metadata.namespace, r.metadata.name)) {
    const plural = r.kind === "Pod" ? PLURAL.Pod : `${PLURAL[r.kind]}.apps`;
    fail(`Error from server (AlreadyExists): ${plural} "${r.metadata.name}" already exists`);
  }
  c.resources.push(r);
  return `${ref} created`;
}

function create(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "Deployment" && type !== "Namespace") {
    fail(`error: create ${PLURAL[type]} is not supported in this simulator, only deployments and namespaces`);
  }
  if (!name) fail(`error: specify the name of the ${type.toLowerCase()} to create`);
  if (type === "Namespace") {
    if (p.dryRun || p.image || p.replicas !== undefined) {
      fail("error: --dry-run, --image and --replicas are not supported with create namespace");
    }
    if (c.namespaces.includes(name)) fail(`Error from server (AlreadyExists): namespaces "${name}" already exists`);
    c.namespaces.push(name);
    return `namespace/${name} created`;
  }
  const labels = { app: name };
  return createResource(c, p, {
    kind: "Deployment",
    metadata: meta(c, name, p.namespace, labels),
    replicas: p.replicas ?? 1,
    selector: { ...labels },
    template: { labels: { ...labels }, image: requireImage(p) },
  });
}

function runPod(c: Cluster, p: Parsed): string {
  const [name, extra] = p.args;
  if (!name) fail("error: specify a name for the pod, e.g. kubectl run web --image=nginx:1.27");
  if (!NAME_RE.test(name)) fail(`error: invalid resource name "${name}"`);
  if (extra) fail(`error: unexpected argument "${extra}"`);
  return createResource(c, p, newPod(c, name, p.namespace, { run: name }, requireImage(p)));
}

function setImage(c: Cluster, p: Parsed): string {
  const [sub, ...rest] = p.args;
  if (sub !== "image") fail(`error: "kubectl set ${sub ?? ""}" is not supported in this simulator, only kubectl set image`);
  const pair = rest.pop() ?? "";
  const [container, image, ...extra] = pair.split("=");
  if (!container || !image || extra.length) fail("error: specify the new image as <container>=<image>, e.g. nginx=nginx:1.28");
  if (!IMAGE_RE.test(image)) fail(`error: invalid image "${image}", use lowercase letters, digits and . / : _ -`);
  const { type, name } = target({ ...p, args: rest });
  if (type !== "Deployment") fail("error: set image is only supported for deployments in this simulator");
  if (!name) fail("error: specify the deployment, e.g. kubectl set image deployment/web nginx=nginx:1.28");
  requireNamespace(c, p.namespace);
  const d = find(c, "Deployment", p.namespace, name) ?? notFound("Deployment", name);
  const current = containerName(d.template.image);
  if (container !== current) fail(`error: unable to find container named "${container}", the container is named "${current}"`);
  d.template.image = image;
  return `deployment.apps/${name} image updated`;
}

function readManifests(c: Cluster, p: Parsed): Manifest[] {
  const file = p.filename ?? fail(`error: must specify -f <file>, e.g. kubectl ${p.verb} -f web.yaml`);
  if (p.args.length) fail(`error: unexpected argument "${p.args[0]}"`);
  if (!Object.hasOwn(c.files, file)) fail(`error: the path "${file}" does not exist`);
  const manifests: Manifest[] = [];
  for (const doc of parseAllDocuments(c.files[file])) {
    const [syntax] = doc.errors;
    if (syntax) fail(`error: error parsing ${file}: ${syntax.message.split("\n")[0]}`);
    const value: unknown = doc.toJS();
    if (value == null) continue;
    const result = manifestSchema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      fail(`error: ${file}: ${issue.path.join(".") || "document"}: ${issue.message}`);
    }
    manifests.push(result.data);
  }
  if (!manifests.length) fail(`error: no objects passed to ${p.verb}`);
  return manifests;
}

/** JSON with sorted object keys, so label order does not count as a change. */
const canonical = (value: unknown) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );

function podSpecKey(spec: { containers: { name: string; image: string }[] }) {
  const [first, ...rest] = spec.containers;
  return canonical({ ...spec, containers: [{ ...first, image: "" }, ...rest] });
}

const specKeyOf = (p: Pod) => p.specKey ?? podSpecKey({ containers: [{ name: containerName(p.image), image: p.image }] });

/** The fields apply compares and updates. */
const applied = (r: Resource) =>
  r.kind === "Pod"
    ? { labels: r.metadata.labels, image: r.image, specKey: specKeyOf(r) }
    : { labels: r.metadata.labels, replicas: r.replicas, selector: r.selector, template: r.template };

// shortcut: only the first container is modelled; further containers, ports and env are validated but ignored.
function toResource(c: Cluster, m: Exclude<Manifest, { kind: "Namespace" }>, namespace: string): Resource {
  const labels = m.metadata.labels ?? {};
  if (m.kind === "Pod") {
    const pod = newPod(c, m.metadata.name, namespace, labels, m.spec.containers[0].image);
    pod.specKey = podSpecKey(m.spec);
    return pod;
  }
  if (m.spec.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
  return {
    kind: m.kind,
    metadata: meta(c, m.metadata.name, namespace, labels),
    replicas: m.spec.replicas,
    selector: { ...m.spec.selector.matchLabels },
    template: { labels: { ...m.spec.template.metadata.labels }, image: m.spec.template.spec.containers[0].image },
  };
}

function apply(c: Cluster, p: Parsed): string {
  const manifests = readManifests(c, p);
  // Work on a draft so a failing document leaves the cluster untouched.
  const draft = structuredClone(c);
  const results = manifests.map((m) => {
    if (m.kind === "Namespace") {
      const name = m.metadata.name;
      const exists = draft.namespaces.includes(name);
      if (!exists) draft.namespaces.push(name);
      return { ref: `namespace/${name}`, result: exists ? "unchanged" : "created", yaml: { apiVersion: "v1", kind: "Namespace", metadata: { name } } };
    }
    const r = toResource(draft, m, m.metadata.namespace ?? p.namespace);
    const { name, namespace } = r.metadata;
    requireNamespace(draft, namespace);
    const existing = find(draft, r.kind, namespace, name);
    let result = "created";
    if (!existing) {
      draft.resources.push(r);
    } else if (canonical(applied(existing)) === canonical(applied(r))) {
      result = "unchanged";
    } else {
      if (existing.kind === "Pod" && specKeyOf(existing) !== specKeyOf(r as Pod)) {
        fail(`The Pod "${name}" is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\``);
      }
      const { labels, ...fields } = applied(r);
      existing.metadata.labels = labels;
      Object.assign(existing, fields);
      result = "configured";
    }
    return { ref: `${GROUP[r.kind]}/${name}`, result, yaml: manifest(draft, existing ?? r, false) };
  });
  if (p.dryRun) {
    if (p.output) return results.map((r) => stringify(r.yaml).trimEnd()).join("\n---\n");
    return results.map((r) => `${r.ref} ${r.result} (dry run)`).join("\n");
  }
  Object.assign(c, draft);
  return results.map((r) => `${r.ref} ${r.result}`).join("\n");
}

/** Like kubectl, deletes what exists and reports every missing resource. */
function deleteFromFile(c: Cluster, p: Parsed): string {
  const lines: string[] = [];
  let failed = false;
  for (const m of readManifests(c, p)) {
    try {
      lines.push(
        m.kind === "Namespace"
          ? deleteNamespace(c, m.metadata.name)
          : deleteResource(c, m.kind, m.metadata.namespace ?? p.namespace, m.metadata.name),
      );
    } catch (e) {
      if (!(e instanceof CommandError)) throw e;
      lines.push(e.message);
      failed = true;
    }
  }
  if (failed) fail(lines.join("\n"));
  return lines.join("\n");
}

function execute(c: Cluster, p: Parsed): string {
  const only = (allowed: boolean, message: string) => allowed || fail(`error: ${message}`);
  if (p.allNamespaces) only(p.verb === "get", "-A is only supported with kubectl get");
  if (p.selector) only(p.verb === "get", "-l is only supported with kubectl get");
  if (p.dryRun) only(["create", "run", "apply"].includes(p.verb), "--dry-run=client is only supported with kubectl create deployment, run and apply");
  if (p.output) only(p.verb === "get" || p.dryRun, "-o is only supported with kubectl get, or together with --dry-run=client");
  if (p.replicas !== undefined) only(p.verb === "scale" || p.verb === "create", "--replicas is only supported with kubectl scale and create deployment");
  if (p.image) only(p.verb === "create" || p.verb === "run", "--image is only supported with kubectl create deployment and run");
  if (p.filename) only(p.verb === "apply" || p.verb === "delete", "-f is only supported with kubectl apply and delete");
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
    case "create":
      return create(c, p);
    case "run":
      return runPod(c, p);
    case "set":
      return setImage(c, p);
    case "apply":
      return apply(c, p);
    default:
      fail(`error: "kubectl ${p.verb}" is not supported in this simulator.\nType "kubectl help" for the supported commands.`);
  }
}

function shell(c: Cluster, input: string, redirected: boolean): string {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) fail("error: missing command before >");
  const [cmd, ...args] = tokens;
  if (cmd !== "ls" && cmd !== "cat") return execute(c, parse(tokens));
  if (redirected) fail("error: output redirect is only supported for kubectl commands");
  if (cmd === "ls") {
    if (args.length) fail("ls: options and arguments are not supported in this simulator");
    return Object.keys(c.files).sort().join("\n");
  }
  if (args.length !== 1) fail("cat: specify exactly one file, e.g. cat web.yaml");
  const [file] = args;
  if (!Object.hasOwn(c.files, file)) fail(`cat: ${file}: No such file or directory`);
  return c.files[file].replace(/\n$/, "");
}

function command(c: Cluster, input: string): string {
  const redirect = input.lastIndexOf(">");
  if (redirect === -1) return shell(c, input, false);
  const file = input.slice(redirect + 1).trim();
  // Names like "__proto__" would hit Object.prototype instead of a file.
  if (!FILE_RE.test(file) || file in Object.prototype) fail(`error: invalid file name "${file}", use letters, digits and . _ -`);
  c.files[file] = `${shell(c, input.slice(0, redirect), true)}\n`;
  return "";
}

/** Runs one command against a copy of the cluster. The input is never executed, only parsed. */
export function run(cluster: Cluster, input: string): RunResult {
  if (!input.trim()) return { cluster, output: "", error: false };
  const c = structuredClone(cluster);
  const seq = c.seq;
  let output: string;
  let error = false;
  try {
    output = command(c, input);
  } catch (e) {
    if (!(e instanceof CommandError)) throw e;
    output = e.message;
    error = true;
  }
  // Settle only older Pods, and before reconciling, so Pods created by this command stay ContainerCreating until the next one.
  settle(c, seq);
  reconcile(c);
  return { cluster: c, output, error };
}
