import { parseAllDocuments, stringify } from "yaml";
import type { z } from "zod";
import { CONFIG_KEY_RE, LABEL_KEY_RE, LABEL_VALUE_RE, manifestSchema } from "../manifest-schema";
import {
  canonical,
  CHANGE_CAUSE,
  configError,
  containerName,
  crashes,
  currentReplicaSet,
  decodeBase64,
  encodeBase64,
  endpointsOf,
  find,
  HASH_LABEL,
  hash,
  isReady,
  list,
  meta,
  newPod,
  podIP,
  podsOf,
  probeFailure,
  pullError,
  reconcile,
  replicaSetsOf,
  revisionOf,
  settle,
} from "./cluster";
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
  RunResult,
  Secret,
  Service,
  ServicePort,
  ServiceType,
} from "./types";

type Manifest = z.infer<typeof manifestSchema>;

class CommandError extends Error {}

type ResourceType = Kind | "Namespace" | "Node" | "Endpoints";

const TYPES: Record<string, ResourceType> = {
  po: "Pod", pod: "Pod", pods: "Pod",
  rs: "ReplicaSet", replicaset: "ReplicaSet", replicasets: "ReplicaSet",
  deploy: "Deployment", deployment: "Deployment", deployments: "Deployment",
  svc: "Service", service: "Service", services: "Service",
  ep: "Endpoints", endpoints: "Endpoints",
  cm: "ConfigMap", configmap: "ConfigMap", configmaps: "ConfigMap",
  secret: "Secret", secrets: "Secret",
  ns: "Namespace", namespace: "Namespace", namespaces: "Namespace",
  no: "Node", node: "Node", nodes: "Node",
};

const PLURAL: Record<ResourceType, string> = {
  Pod: "pods", ReplicaSet: "replicasets", Deployment: "deployments", Namespace: "namespaces", Node: "nodes",
  Service: "services", Endpoints: "endpoints", ConfigMap: "configmaps", Secret: "secrets",
};

const GROUP: Record<ResourceType, string> = {
  Pod: "pod", ReplicaSet: "replicaset.apps", Deployment: "deployment.apps", Namespace: "namespace", Node: "node",
  Service: "service", Endpoints: "endpoints", ConfigMap: "configmap", Secret: "secret",
};

const NAME_RE = /^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/;
const IMAGE_RE = /^[a-z0-9./:_-]+$/;
const FILE_RE = /^[a-zA-Z0-9._-]+$/;
const PORT_NAME_RE = /^(?=.*[a-z])[a-z0-9]([-a-z0-9]{0,13}[a-z0-9])?$/;
const PROTECTED_NAMESPACES = ["default", "kube-system"];
const SERVICE_TYPES: ServiceType[] = ["ClusterIP", "NodePort", "LoadBalancer"];
const MAX_REPLICAS = 20;
const MAX_ANNOTATION = 1024;
const MANAGED_PREFIX = "deployment.kubernetes.io/";
const RESTARTED_AT = "kubectl.kubernetes.io/restartedAt";

export const HELP = `This is a simulated kubectl. No real cluster or shell is involved.

Supported commands:
  kubectl get <type> [name]
      types: pods, replicasets, deployments, services (svc), endpoints (ep),
             configmaps (cm), secrets, namespaces, nodes
  kubectl describe <pod|replicaset|deployment|service|configmap|secret> <name>
  kubectl create deployment <name> --image=<image> [--replicas=<n>]
  kubectl create namespace <name>
  kubectl create service <clusterip|nodeport|loadbalancer> <name> --tcp=<port>:<targetPort>
  kubectl create configmap <name> --from-literal=<key>=<value> ...
  kubectl create secret generic <name> --from-literal=<key>=<value> ...
  kubectl run <name> --image=<image>
  kubectl expose <deployment|replicaset|pod> <name> --port=<p> [--target-port=<p>]
                 [--type=ClusterIP|NodePort|LoadBalancer] [--name=<service>]
  kubectl set image deployment/<name> <container>=<image>
  kubectl scale <deployment|replicaset> <name> --replicas=<n>
  kubectl label <type> <name> <key>=<value>... [<key>-] [--overwrite]
  kubectl annotate <type> <name> <key>=<value>... [<key>-] [--overwrite]
  kubectl rollout status deployment/<name>
  kubectl rollout history deployment/<name> [--revision=<n>]
  kubectl rollout undo deployment/<name> [--to-revision=<n>]
  kubectl rollout restart deployment/<name>
  kubectl rollout pause deployment/<name>
  kubectl rollout resume deployment/<name>
  kubectl apply -f <file>
  kubectl delete <pod|deployment|service|configmap|secret|namespace> <name>
  kubectl delete -f <file>
  ls                       list files
  cat <file>               print a file
  <kubectl command> > <file>
                           write the output to a file instead of printing it
  clear

Quote values that contain spaces or brackets with '...' or "...".

Supported flags:
  -n, --namespace <ns>     use a namespace other than "default"
  -A, --all-namespaces     list across all namespaces (get only)
  -l, --selector <query>   filter by labels (get only): k=v, k!=v, k, !k,
                           'k in (a,b)', 'k notin (a,b)'; commas mean AND
  --show-labels            add a LABELS column (get only)
  -o, --output yaml|wide   print as YAML, or a table with more columns (get),
                           or YAML together with --dry-run=client
  -f, --filename <file>    manifest file (apply, delete)
  --image <image>          container image (create deployment, run)
  --replicas <n>           number of replicas (scale, create deployment)
  --port, --target-port    Service port and the container port it sends to (expose)
  --type <type>            Service type (expose)
  --name <name>            Service name (expose)
  --tcp <port>:<target>    Service port (create service)
  --from-literal <k>=<v>   a key and value (create configmap, create secret generic)
  --overwrite              allow changing an existing value (label, annotate)
  --revision <n>           show one revision (rollout history)
  --to-revision <n>        revision to go back to (rollout undo)
  --dry-run=client         print what would be created without changing anything
                           (create, run, expose, apply)`;

type Requirement = { key: string; op: "=" | "!=" | "exists" | "!exists" | "in" | "notin"; values: string[] };

type Parsed = {
  verb: string;
  args: string[];
  namespace: string;
  allNamespaces: boolean;
  selector?: Requirement[];
  showLabels: boolean;
  output?: "yaml" | "wide";
  replicas?: number;
  image?: string;
  filename?: string;
  dryRun: boolean;
  port?: number;
  targetPort?: PortRef;
  type?: ServiceType;
  name?: string;
  tcp: string[];
  literals: string[];
  overwrite: boolean;
  revision?: number;
  toRevision?: number;
};

function fail(message: string): never {
  throw new CommandError(message);
}

const checkKey = (key: string) => LABEL_KEY_RE.test(key) || fail(`error: invalid label key "${key}"`);
const checkValue = (value: string) => LABEL_VALUE_RE.test(value) || fail(`error: invalid label value "${value}"`);

function parseSelector(value: string): Requirement[] {
  const invalid = () => fail(`error: invalid selector "${value}", use e.g. app=web, app!=web, app, !app or 'app in (web,api)'`);
  // Split on commas outside parentheses.
  const parts = value.match(/(?:[^,(]|\([^)]*\))+/g) ?? invalid();
  return parts.map((raw): Requirement => {
    const part = raw.trim();
    const set = part.match(/^(\S+)\s+(in|notin)\s*\(([^)]*)\)$/);
    let req: Requirement;
    if (set) req = { key: set[1], op: set[2] as "in" | "notin", values: set[3].split(",").map((v) => v.trim()) };
    else if (part.startsWith("!")) req = { key: part.slice(1), op: "!exists", values: [] };
    else {
      const eq = part.match(/^([^=!]+)(!=|==|=)(.*)$/);
      req = eq ? { key: eq[1], op: eq[2] === "!=" ? "!=" : "=", values: [eq[3]] } : { key: part, op: "exists", values: [] };
    }
    if (!LABEL_KEY_RE.test(req.key) || !req.values.every((v) => LABEL_VALUE_RE.test(v))) invalid();
    return req;
  });
}

function selects(labels: Labels, reqs: Requirement[]): boolean {
  return reqs.every(({ key, op, values }) => {
    const has = Object.hasOwn(labels, key);
    if (op === "=") return has && labels[key] === values[0];
    if (op === "!=") return !has || labels[key] !== values[0];
    if (op === "exists") return has;
    if (op === "!exists") return !has;
    if (op === "in") return has && values.includes(labels[key]);
    return !has || !values.includes(labels[key]);
  });
}

function parsePort(value: string, flag: string): number {
  const n = /^\d+$/.test(value) ? Number(value) : 0;
  if (n < 1 || n > 65535) fail(`error: invalid ${flag} value "${value}", must be a port number from 1 to 65535`);
  return n;
}

function parse(tokens: string[]): Parsed {
  if (tokens[0] === "help") tokens.unshift("kubectl");
  if (tokens[0] !== "kubectl") fail(`command not found: ${tokens[0]}\nOnly kubectl commands are simulated. Type "kubectl help".`);
  const p: Parsed = {
    verb: tokens[1] ?? "help",
    args: [],
    namespace: "default",
    allNamespaces: false,
    showLabels: false,
    dryRun: false,
    tcp: [],
    literals: [],
    overwrite: false,
  };

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
    const takeCount = () => {
      const value = takeValue();
      if (!/^\d+$/.test(value)) fail(`error: invalid ${flag} value "${value}", must be a whole number`);
      return Number(value);
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
      case "--show-labels":
        p.showLabels = true;
        break;
      case "-o":
      case "--output": {
        const value = takeValue();
        if (value !== "yaml" && value !== "wide") fail(`error: output format "${value}" is not supported in this simulator, use -o yaml or -o wide`);
        p.output = value;
        break;
      }
      case "--replicas":
        p.replicas = takeCount();
        if (p.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
        break;
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
      case "--port":
        p.port = parsePort(takeValue(), flag);
        break;
      case "--target-port": {
        const value = takeValue();
        p.targetPort = PORT_NAME_RE.test(value) ? value : parsePort(value, flag);
        break;
      }
      case "--type": {
        const value = takeValue();
        p.type = SERVICE_TYPES.find((t) => t.toLowerCase() === value.toLowerCase()) ?? fail(`error: invalid --type "${value}", use ClusterIP, NodePort or LoadBalancer`);
        break;
      }
      case "--name":
        p.name = takeValue();
        if (!NAME_RE.test(p.name)) fail(`error: invalid --name "${p.name}"`);
        break;
      case "--tcp":
        p.tcp.push(takeValue());
        break;
      case "--from-literal":
        p.literals.push(takeValue());
        break;
      case "--overwrite":
        p.overwrite = true;
        break;
      case "--revision":
        p.revision = takeCount();
        break;
      case "--to-revision":
        p.toRevision = takeCount();
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
  const type = Object.hasOwn(TYPES, typeName.toLowerCase()) ? TYPES[typeName.toLowerCase()] : undefined;
  if (!type) {
    fail(`error: the server doesn't have a resource type "${typeName}"\nSupported types: ${[...new Set(Object.values(PLURAL))].join(", ")}.`);
  }
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

const annotationText = (annotations: Labels) =>
  Object.entries(annotations).map(([k, v]) => `${k}: ${v}`).join("\n                ") || "<none>";

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
  const current = currentReplicaSet(c, d);
  return { total: pods.length, ready: pods.filter(isReady).length, updated: current ? podsOf(c, current).length : 0 };
}

const portsText = (s: Service) =>
  s.ports.map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ""}/${p.protocol}`).join(",");

function endpointsText(c: Cluster, s: Service, limit = 3): string {
  const all = endpointsOf(c, s).flatMap((e) => e.ports.map((port) => `${e.ip}:${port}`));
  if (!all.length) return "<none>";
  return all.length > limit ? `${all.slice(0, limit).join(",")} + ${all.length - limit} more...` : all.join(",");
}

const containerYaml = (image: string, { name, ...rest }: Container) => [{ name, image, ...rest }];

const nonEmpty = (o: Labels) => (Object.keys(o).length ? o : undefined);

/** `live: false` leaves out what only the server sets (status, owners, node, IPs), as a dry run prints. */
function manifest(c: Cluster, r: Resource, live = true) {
  const metadata: Record<string, unknown> = {
    name: r.metadata.name,
    namespace: r.metadata.namespace,
    labels: r.metadata.labels,
    annotations: nonEmpty(r.metadata.annotations),
  };
  if (live && (r.kind === "Pod" || r.kind === "ReplicaSet") && r.owner) {
    metadata.ownerReferences = [{ kind: r.kind === "Pod" ? "ReplicaSet" : "Deployment", name: r.owner }];
  }
  if (r.kind === "Pod") {
    const containers = containerYaml(r.image, r.container);
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata,
      spec: live ? { nodeName: r.node, containers } : { containers },
      ...(live && {
        status: {
          phase: phase(r),
          podIP: r.status === "ContainerCreating" ? undefined : podIP(r),
          reason: r.status === "Running" ? undefined : r.status,
          ready: isReady(r),
          restartCount: r.restarts,
        },
      }),
    };
  }
  if (r.kind === "Service") {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata,
      spec: {
        type: r.type,
        clusterIP: live ? r.clusterIP : undefined,
        selector: nonEmpty(r.selector),
        ports: r.ports.map((p) => ({ ...p, nodePort: live ? p.nodePort : undefined })),
      },
      ...(live && { status: { loadBalancer: {} } }),
    };
  }
  if (r.kind === "ConfigMap") return { apiVersion: "v1", kind: "ConfigMap", metadata, data: r.data };
  if (r.kind === "Secret") return { apiVersion: "v1", kind: "Secret", metadata, type: r.type, data: r.data };
  const spec = {
    replicas: r.replicas,
    selector: { matchLabels: r.selector },
    template: {
      metadata: { labels: r.template.labels, annotations: r.template.annotations },
      spec: { containers: containerYaml(r.template.image, r.template.container) },
    },
  };
  if (r.kind === "ReplicaSet") {
    const pods = podsOf(c, r);
    return {
      apiVersion: "apps/v1", kind: "ReplicaSet", metadata, spec,
      ...(live && { status: { replicas: pods.length, readyReplicas: pods.filter(isReady).length } }),
    };
  }
  const s = deploymentStatus(c, r);
  const { type, maxSurge, maxUnavailable } = r.strategy;
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata,
    spec: {
      ...spec,
      strategy: type === "Recreate" ? { type } : { type, rollingUpdate: { maxSurge, maxUnavailable } },
      paused: r.paused || undefined,
    },
    ...(live && { status: { replicas: s.total, updatedReplicas: s.updated, readyReplicas: s.ready, availableReplicas: s.ready } }),
  };
}

function endpointsManifest(c: Cluster, s: Service) {
  const eps = endpointsOf(c, s);
  return {
    apiVersion: "v1",
    kind: "Endpoints",
    metadata: { name: s.metadata.name, namespace: s.metadata.namespace, labels: s.metadata.labels },
    subsets: eps.length
      ? [{ addresses: eps.map((e) => ({ ip: e.ip, targetRef: { kind: "Pod", name: e.pod.metadata.name } })), ports: s.ports.map((sp, i) => ({ name: sp.name, port: eps[0].ports[i], protocol: sp.protocol })) }]
      : undefined,
  };
}

function templateColumns(t: PodTemplate, selector: Labels) {
  return [t.container.name, t.image, labelText(selector)];
}

function get(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  const nsLabel = p.allNamespaces ? "" : ` in ${p.namespace} namespace`;

  if (type === "Namespace" || type === "Node") {
    if (p.showLabels || p.output === "wide") fail(`error: --show-labels and -o wide are not supported for ${PLURAL[type]} in this simulator`);
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
  // Endpoints are computed from Services, never stored.
  let items: Resource[] = list(c, type === "Endpoints" ? "Service" : type, p.allNamespaces ? undefined : p.namespace);
  if (name) {
    if (p.allNamespaces) fail("error: a resource cannot be retrieved by name across all namespaces");
    items = items.filter((r) => r.metadata.name === name);
    if (!items.length) notFound(type, name);
  }
  if (p.selector) items = items.filter((r) => selects(r.metadata.labels, p.selector!));
  if (!items.length) return `No resources found${nsLabel}.`;

  if (p.output === "yaml") {
    const docs = items.map((r) => (type === "Endpoints" ? endpointsManifest(c, r as Service) : manifest(c, r)));
    return stringify(name ? docs[0] : { apiVersion: "v1", kind: "List", items: docs }).trimEnd();
  }

  const wide = p.output === "wide";
  const rows = items.map((r): string[] => {
    const created = age(c, r.metadata.createdAt);
    if (type === "Endpoints") return [r.metadata.name, endpointsText(c, r as Service), created];
    switch (r.kind) {
      case "Pod": {
        const row = [r.metadata.name, `${isReady(r) ? 1 : 0}/1`, r.status, String(r.restarts), created];
        return wide ? [...row, r.status === "ContainerCreating" ? "<none>" : podIP(r), r.node] : row;
      }
      case "ReplicaSet": {
        const pods = podsOf(c, r);
        const row = [r.metadata.name, String(r.replicas), String(pods.length), String(pods.filter(isReady).length), created];
        return wide ? [...row, ...templateColumns(r.template, r.selector)] : row;
      }
      case "Deployment": {
        const s = deploymentStatus(c, r);
        const row = [r.metadata.name, `${s.ready}/${r.replicas}`, String(s.updated), String(s.ready), created];
        return wide ? [...row, ...templateColumns(r.template, r.selector)] : row;
      }
      case "Service": {
        const external = r.type === "LoadBalancer" ? "<pending>" : "<none>";
        const row = [r.metadata.name, r.type, r.clusterIP, external, portsText(r), created];
        return wide ? [...row, labelText(r.selector)] : row;
      }
      case "ConfigMap":
        return [r.metadata.name, String(Object.keys(r.data).length), created];
      case "Secret":
        return [r.metadata.name, r.type, String(Object.keys(r.data).length), created];
    }
  });
  const header = {
    Pod: ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE"] : [])],
    ReplicaSet: ["NAME", "DESIRED", "CURRENT", "READY", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    Deployment: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    Service: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])],
    Endpoints: ["NAME", "ENDPOINTS", "AGE"],
    ConfigMap: ["NAME", "DATA", "AGE"],
    Secret: ["NAME", "TYPE", "DATA", "AGE"],
  }[type];
  const all = [header, ...rows];
  if (p.showLabels) all.forEach((row, i) => row.push(i ? labelText(items[i - 1].metadata.labels) : "LABELS"));
  if (p.allNamespaces) all.forEach((row, i) => row.unshift(i ? items[i - 1].metadata.namespace : "NAMESPACE"));
  return table(all);
}

function probeText(probe?: Probe): string | undefined {
  if (!probe) return undefined;
  const handler = probe.httpGet
    ? `http-get http://:${probe.httpGet.port}${probe.httpGet.path ?? "/"}`
    : probe.tcpSocket
      ? `tcp-socket :${probe.tcpSocket.port}`
      : `exec [${probe.exec!.command.join(" ")}]`;
  return `${handler} delay=${probe.initialDelaySeconds ?? 0}s timeout=${probe.timeoutSeconds ?? 1}s period=${probe.periodSeconds ?? 10}s #success=${probe.successThreshold ?? 1} #failure=${probe.failureThreshold ?? 3}`;
}

function envLines(ctr: Container): string[] {
  const env = (ctr.env ?? []).map((e) => {
    const cm = e.valueFrom?.configMapKeyRef;
    const s = e.valueFrom?.secretKeyRef;
    const value = cm
      ? `<set to the key '${cm.key}' of config map '${cm.name}'>  Optional: false`
      : s
        ? `<set to the key '${s.key}' in secret '${s.name}'>  Optional: false`
        : (e.value ?? "");
    return `  ${e.name}:  ${value}`;
  });
  const from = (ctr.envFrom ?? []).map((e) =>
    e.configMapRef ? `  ${e.configMapRef.name}  ConfigMap  Optional: false` : `  ${e.secretRef!.name}  Secret  Optional: false`,
  );
  return [
    env.length ? "Environment:" : "Environment:    <none>",
    ...env,
    ...(from.length ? ["Environment Variables from:", ...from] : []),
  ];
}

/** Events the kubelet would have recorded for the Pod's current state. */
function podEvents(c: Cluster, p: Pod): string[][] {
  const events: string[][] = [];
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
  if (!events.length) return [];
  const when = age(c, p.metadata.createdAt);
  return [["Type", "Reason", "Age", "From", "Message"], ["----", "------", "----", "----", "-------"], ...events.map(([t, r, m]) => [t, r, when, "kubelet", m])];
}

const pad = (pairs: [string, string | undefined][]) =>
  pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `${(k + ":").padEnd(Math.max(16, k.length + 3))}${v}`.trimEnd()).join("\n");

function describe(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (!name) fail(`error: specify the ${type.toLowerCase()} name to describe`);
  if (type === "Namespace" || type === "Node" || type === "Endpoints") {
    fail(`error: describe ${PLURAL[type]} is not supported in this simulator`);
  }
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  const head: [string, string][] = [
    ["Name", r.metadata.name],
    ["Namespace", r.metadata.namespace],
    ["Labels", labelText(r.metadata.labels)],
    ["Annotations", annotationText(r.metadata.annotations)],
  ];

  if (r.kind === "Pod") {
    const ctr = r.container;
    const events = podEvents(c, r);
    return [
      pad([
        ["Name", r.metadata.name],
        ["Namespace", r.metadata.namespace],
        ["Node", r.node],
        ["Labels", labelText(r.metadata.labels)],
        ["Annotations", annotationText(r.metadata.annotations)],
        ["Status", phase(r)],
        ["IP", r.status === "ContainerCreating" ? "<none>" : podIP(r)],
        ["Controlled By", r.owner ? `ReplicaSet/${r.owner}` : "<none>"],
        ["Container", ctr.name],
        ["Image", r.image],
        ["Port", ctr.ports?.map((x) => `${x.containerPort}/${x.protocol ?? "TCP"}`).join(", ")],
        ["State", r.status === "Running" ? "Running" : `Waiting (reason: ${r.status})`],
        ["Ready", isReady(r) ? "True" : "False"],
        ["Restart Count", String(r.restarts)],
        ["Liveness", probeText(ctr.livenessProbe)],
        ["Readiness", probeText(ctr.readinessProbe)],
        ["Startup", probeText(ctr.startupProbe)],
      ]),
      ...envLines(ctr),
      events.length ? `Events:\n${table(events).replace(/^/gm, "  ")}` : "Events:         <none>",
    ].join("\n");
  }
  if (r.kind === "ReplicaSet") {
    const pods = podsOf(c, r);
    const ready = pods.filter(isReady).length;
    return pad([
      ...head,
      ["Selector", labelText(r.selector)],
      ["Controlled By", r.owner ? `Deployment/${r.owner}` : "<none>"],
      ["Replicas", `${pods.length} current / ${r.replicas} desired`],
      ["Pods Status", `${ready} Running / ${pods.length - ready} Waiting`],
      ["Image", r.template.image],
    ]);
  }
  if (r.kind === "Service") {
    const eps = endpointsText(c, r, Infinity);
    return pad([
      ...head,
      ["Selector", labelText(r.selector)],
      ["Type", r.type],
      ["IP", r.clusterIP],
      ...(r.type === "LoadBalancer" ? [["LoadBalancer Ingress", "<pending>"] as [string, string]] : []),
      ...r.ports.flatMap((x): [string, string][] => [
        ["Port", `${x.name ?? "<unset>"}  ${x.port}/${x.protocol}`],
        ["TargetPort", `${x.targetPort}/${x.protocol}`],
        ...(x.nodePort ? [["NodePort", `${x.name ?? "<unset>"}  ${x.nodePort}/${x.protocol}`] as [string, string]] : []),
        ["Endpoints", eps],
      ]),
    ]);
  }
  if (r.kind === "ConfigMap") {
    const data = Object.entries(r.data).map(([k, v]) => `${k}:\n----\n${v}\n`);
    return `${pad(head)}\n\nData\n====\n${data.join("\n")}`.trimEnd();
  }
  if (r.kind === "Secret") {
    const data = Object.entries(r.data).map(([k, v]) => `${k}:  ${new TextEncoder().encode(decodeBase64(v)).length} bytes`);
    return `${pad(head)}\n\nType:  ${r.type}\n\nData\n====\n${data.join("\n")}`.trimEnd();
  }
  const s = deploymentStatus(c, r);
  const current = currentReplicaSet(c, r);
  const rsText = (rs: ReplicaSet) => `${rs.metadata.name} (${podsOf(c, rs).length}/${rs.replicas} replicas created)`;
  const olds = replicaSetsOf(c, r).filter((rs) => rs !== current && (rs.replicas > 0 || podsOf(c, rs).length));
  const { type: strategy, maxSurge, maxUnavailable } = r.strategy;
  return pad([
    ...head,
    ["Selector", labelText(r.selector)],
    ["Replicas", `${r.replicas} desired | ${s.updated} updated | ${s.total} total | ${s.ready} available | ${s.total - s.ready} unavailable`],
    ["StrategyType", strategy],
    ["RollingUpdateStrategy", strategy === "RollingUpdate" ? `${maxUnavailable} max unavailable, ${maxSurge} max surge` : undefined],
    ["Paused", r.paused ? "true" : undefined],
    ["Image", r.template.image],
    ["OldReplicaSets", olds.map(rsText).join(", ") || "<none>"],
    ["NewReplicaSet", current ? rsText(current) : "<none>"],
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
  if (type === "ReplicaSet" || type === "Node" || type === "Endpoints") {
    fail(`error: delete ${PLURAL[type]} is not supported in this simulator, only pods, deployments, services, configmaps, secrets and namespaces`);
  }
  if (!name) fail("error: specify the name of the resource to delete");
  return type === "Namespace" ? deleteNamespace(c, name) : deleteResource(c, type, p.namespace, name);
}

const requireImage = (p: Parsed) => p.image ?? fail("error: required flag --image not set, e.g. --image=nginx:1.27");

/** Adds a new resource, or with --dry-run=client only prints it. */
function createResource(c: Cluster, p: Parsed, r: Resource, done = "created"): string {
  const ref = `${GROUP[r.kind]}/${r.metadata.name}`;
  if (p.dryRun) return p.output ? stringify(manifest(c, r, false)).trimEnd() : `${ref} ${done} (dry run)`;
  requireNamespace(c, r.metadata.namespace);
  if (find(c, r.kind, r.metadata.namespace, r.metadata.name)) {
    const plural = GROUP[r.kind].endsWith(".apps") ? `${PLURAL[r.kind]}.apps` : PLURAL[r.kind];
    fail(`Error from server (AlreadyExists): ${plural} "${r.metadata.name}" already exists`);
  }
  c.resources.push(r);
  return `${ref} ${done}`;
}

const DEFAULT_STRATEGY = { type: "RollingUpdate", maxSurge: "25%", maxUnavailable: "25%" } as const;

function encodeLiterals(p: Parsed, encode: (v: string) => string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const literal of p.literals) {
    const eq = literal.indexOf("=");
    const key = literal.slice(0, eq);
    if (eq < 1 || !CONFIG_KEY_RE.test(key)) fail(`error: invalid --from-literal "${literal}", use <key>=<value> with a key of letters, digits, - _ .`);
    if (Object.hasOwn(data, key)) fail(`error: cannot add key "${key}", another key by that name already exists`);
    data[key] = encode(literal.slice(eq + 1));
  }
  return data;
}

function allocateClusterIP(c: Cluster, s: Service) {
  const used = new Set(list(c, "Service").map((x) => x.clusterIP));
  for (let h = hash(`${s.metadata.namespace}/${s.metadata.name}`); !s.clusterIP || used.has(s.clusterIP); h = hash(String(h))) {
    s.clusterIP = `10.96.${1 + ((h >>> 8) % 254)}.${1 + (h % 254)}`;
  }
}

function allocateNodePorts(c: Cluster, s: Service) {
  const used = new Set(list(c, "Service").filter((x) => x !== s).flatMap((x) => x.ports.map((p) => p.nodePort)));
  for (const port of s.ports) {
    if (s.type === "ClusterIP") delete port.nodePort;
    else if (port.nodePort === undefined) {
      let h = hash(`${s.metadata.namespace}/${s.metadata.name}/${port.port}`);
      while (used.has(30000 + (h % 2768))) h = hash(String(h));
      port.nodePort = 30000 + (h % 2768);
    }
    used.add(port.nodePort);
  }
}

function newService(c: Cluster, name: string, ns: string, labels: Labels, type: ServiceType, selector: Labels, ports: ServicePort[]): Service {
  const s: Service = { kind: "Service", metadata: meta(c, name, ns, labels), type, clusterIP: "", selector: { ...selector }, ports };
  allocateClusterIP(c, s);
  allocateNodePorts(c, s);
  return s;
}

function createService(c: Cluster, p: Parsed, sub: string | undefined, name: string | undefined): string {
  const type = SERVICE_TYPES.find((t) => t.toLowerCase() === sub);
  if (!type) fail("error: use kubectl create service <clusterip|nodeport|loadbalancer> <name> --tcp=<port>:<targetPort>");
  if (!name || !NAME_RE.test(name)) fail(`error: invalid service name "${name ?? ""}"`);
  if (!p.tcp.length) fail("error: at least one tcp port specifier must be provided, e.g. --tcp=80:8080");
  const ports = p.tcp.map((spec): ServicePort => {
    const [port, targetPort = port, ...extra] = spec.split(":");
    if (extra.length) fail(`error: invalid --tcp "${spec}", use <port>:<targetPort>`);
    const target = parsePort(targetPort, "--tcp");
    return { name: `${port}-${target}`, protocol: "TCP", port: parsePort(port, "--tcp"), targetPort: target };
  });
  return createResource(c, p, newService(c, name, p.namespace, { app: name }, type, { app: name }, ports));
}

function create(c: Cluster, p: Parsed): string {
  const [kind, sub, subName] = p.args;
  const nested = TYPES[kind?.toLowerCase() ?? ""];
  if (nested === "Service" && p.args.length <= 3) return createService(c, p, sub?.toLowerCase(), subName);
  if (nested === "Secret" && p.args.length <= 3) {
    if (sub !== "generic") fail("error: only kubectl create secret generic is supported in this simulator");
    if (!subName || !NAME_RE.test(subName)) fail(`error: invalid secret name "${subName ?? ""}"`);
    const secret: Secret = { kind: "Secret", metadata: meta(c, subName, p.namespace, {}), type: "Opaque", data: encodeLiterals(p, encodeBase64) };
    return createResource(c, p, secret);
  }
  const { type, name } = target(p);
  if (type !== "Deployment" && type !== "Namespace" && type !== "ConfigMap") {
    fail(`error: create ${PLURAL[type]} is not supported in this simulator, only deployments, namespaces, services, configmaps and secrets`);
  }
  if (!name) fail(`error: specify the name of the ${type.toLowerCase()} to create`);
  if (type === "ConfigMap") {
    return createResource(c, p, { kind: "ConfigMap", metadata: meta(c, name, p.namespace, {}), data: encodeLiterals(p, (v) => v) });
  }
  if (type === "Namespace") {
    if (p.dryRun || p.image || p.replicas !== undefined) {
      fail("error: --dry-run, --image and --replicas are not supported with create namespace");
    }
    if (c.namespaces.includes(name)) fail(`Error from server (AlreadyExists): namespaces "${name}" already exists`);
    c.namespaces.push(name);
    return `namespace/${name} created`;
  }
  const labels = { app: name };
  const image = requireImage(p);
  return createResource(c, p, {
    kind: "Deployment",
    metadata: meta(c, name, p.namespace, labels),
    replicas: p.replicas ?? 1,
    selector: { ...labels },
    template: { labels: { ...labels }, image, container: { name: containerName(image) } },
    strategy: { ...DEFAULT_STRATEGY },
  });
}

function runPod(c: Cluster, p: Parsed): string {
  const [name, extra] = p.args;
  if (!name) fail("error: specify a name for the pod, e.g. kubectl run web --image=nginx:1.27");
  if (!NAME_RE.test(name)) fail(`error: invalid resource name "${name}"`);
  if (extra) fail(`error: unexpected argument "${extra}"`);
  const image = requireImage(p);
  return createResource(c, p, newPod(c, name, p.namespace, { labels: { run: name }, image, container: { name: containerName(image) } }));
}

function expose(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "Deployment" && type !== "ReplicaSet" && type !== "Pod") {
    fail(`error: cannot expose ${PLURAL[type]} in this simulator, only deployments, replicasets and pods`);
  }
  if (!name) fail("error: specify the name of the resource to expose");
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  const selector = r.kind === "Pod" ? r.metadata.labels : r.selector;
  if (!Object.keys(selector).length) fail("error: couldn't retrieve selectors via --selector flag or introspection");
  const container = r.kind === "Pod" ? r.container : r.template.container;
  const port = p.port ?? container.ports?.[0]?.containerPort ?? fail("error: couldn't find port via --port flag or introspection");
  const svc = newService(c, p.name ?? name, p.namespace, r.metadata.labels, p.type ?? "ClusterIP", selector, [
    { protocol: "TCP", port, targetPort: p.targetPort ?? port },
  ]);
  return createResource(c, p, svc, "exposed");
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
  const current = d.template.container.name;
  if (container !== current) fail(`error: unable to find container named "${container}", the container is named "${current}"`);
  d.template.image = image;
  return `deployment.apps/${name} image updated`;
}

/** kubectl label and kubectl annotate. */
function setMetadata(c: Cluster, p: Parsed, field: "labels" | "annotations"): string {
  const [first, ...rest] = p.args;
  const changes = first?.includes("/") ? rest : rest.slice(1);
  const { type, name } = target({ ...p, args: first?.includes("/") ? [first] : [first, rest[0]].filter(Boolean) });
  if (type === "Namespace" || type === "Node" || type === "Endpoints") fail(`error: ${p.verb} ${PLURAL[type]} is not supported in this simulator`);
  if (!name) fail(`error: specify the name of the resource to ${p.verb}`);
  const noun = field === "labels" ? "label" : "annotation";
  if (!changes.length) fail(`error: at least one ${noun} update is required, e.g. key=value or key-`);
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  const values = r.metadata[field];
  for (const change of changes) {
    if (change.endsWith("-") && !change.includes("=")) {
      const key = change.slice(0, -1);
      checkKey(key);
      delete values[key];
      continue;
    }
    const eq = change.indexOf("=");
    if (eq === -1) fail(`error: invalid ${noun} "${change}", use key=value to set or key- to remove`);
    const key = change.slice(0, eq);
    const value = change.slice(eq + 1);
    checkKey(key);
    if (field === "labels") checkValue(value);
    else if (value.length > MAX_ANNOTATION) fail(`error: annotation values in this simulator are limited to ${MAX_ANNOTATION} characters`);
    if (Object.hasOwn(values, key) && !p.overwrite) fail(`error: '${key}' already has a value (${values[key]}), and --overwrite is false`);
    values[key] = value;
  }
  return `${GROUP[type]}/${name} ${field === "labels" ? "labeled" : "annotated"}`;
}

/** A clock-derived RFC 3339 time, so restarts are deterministic. */
const timestamp = (c: Cluster) => new Date(Date.UTC(2026, 0, 1) + c.clock * 1000).toISOString().replace(/\.\d+Z$/, "Z");

const withoutHash = (labels: Labels) => Object.fromEntries(Object.entries(labels).filter(([k]) => k !== HASH_LABEL));

/** Whether a rollout can no longer progress: the new ReplicaSet has Pods that started and are not ready. */
function stuck(c: Cluster, d: Deployment) {
  const rs = currentReplicaSet(c, d);
  return !!rs && podsOf(c, rs).some((p) => p.status !== "ContainerCreating" && !isReady(p));
}

function rolloutStatus(c: Cluster, d: Deployment): string {
  const name = d.metadata.name;
  const s = deploymentStatus(c, d);
  const waiting = `Waiting for deployment "${name}" rollout to finish: `;
  let message = `deployment "${name}" successfully rolled out`;
  if (s.updated < d.replicas) message = `${waiting}${s.updated} out of ${d.replicas} new replicas have been updated...`;
  else if (s.total > s.updated) message = `${waiting}${s.total - s.updated} old replicas are pending termination...`;
  else if (s.ready < s.updated) message = `${waiting}${s.ready} of ${s.updated} updated replicas are available...`;
  // shortcut: no progress deadline timer; a rollout that cannot progress fails at once instead of after 10 minutes.
  if (message.startsWith(waiting) && stuck(c, d)) fail(`${message}\nerror: deployment "${name}" exceeded its progress deadline`);
  return message;
}

function rolloutHistory(c: Cluster, p: Parsed, d: Deployment): string {
  const sets = replicaSetsOf(c, d).sort((a, b) => revisionOf(a) - revisionOf(b));
  const ref = `deployment.apps/${d.metadata.name}`;
  if (p.revision) {
    const rs = sets.find((s) => revisionOf(s) === p.revision) ?? fail(`error: unable to find the specified revision`);
    const t = rs.template;
    const body = pad([
      ["Labels", labelText(t.labels)],
      ["Annotations", annotationText({ ...t.annotations, ...(rs.metadata.annotations[CHANGE_CAUSE] && { [CHANGE_CAUSE]: rs.metadata.annotations[CHANGE_CAUSE] }) })],
      ["Container", t.container.name],
      ["Image", t.image],
      ["Port", t.container.ports?.map((x) => `${x.containerPort}/${x.protocol ?? "TCP"}`).join(", ")],
    ]);
    return `${ref} with revision #${p.revision}\nPod Template:\n${body.replace(/^/gm, "  ")}`;
  }
  return `${ref}\n${table([["REVISION", "CHANGE-CAUSE"], ...sets.map((s) => [String(revisionOf(s)), s.metadata.annotations[CHANGE_CAUSE] ?? "<none>"])])}`;
}

function rolloutUndo(c: Cluster, p: Parsed, d: Deployment): string {
  const name = d.metadata.name;
  if (d.paused) fail(`error: you cannot rollback a paused deployment; resume it first with 'kubectl rollout resume deployment/${name}' and try again`);
  const current = currentReplicaSet(c, d);
  const sets = replicaSetsOf(c, d).sort((a, b) => revisionOf(b) - revisionOf(a));
  const goal = p.toRevision
    ? (sets.find((s) => revisionOf(s) === p.toRevision) ?? fail(`error: unable to find specified revision ${p.toRevision} in history`))
    : (sets.find((s) => s !== current && (!current || revisionOf(s) < revisionOf(current))) ?? fail(`error: no rollout history found for deployment "${name}"`));
  if (goal === current) return `deployment.apps/${name} skipped rollback (current template already matches revision ${revisionOf(goal)})`;
  d.template = { ...structuredClone(goal.template), labels: withoutHash(goal.template.labels) };
  const cause = goal.metadata.annotations[CHANGE_CAUSE];
  if (cause === undefined) delete d.metadata.annotations[CHANGE_CAUSE];
  else d.metadata.annotations[CHANGE_CAUSE] = cause;
  return `deployment.apps/${name} rolled back`;
}

function rollout(c: Cluster, p: Parsed): string {
  const [sub, ...rest] = p.args;
  const subs = ["status", "history", "undo", "restart", "pause", "resume"];
  if (!subs.includes(sub)) fail(`error: use kubectl rollout <${subs.join("|")}> deployment/<name>`);
  const { type, name } = target({ ...p, args: rest });
  if (type !== "Deployment") fail("error: rollout is only supported for deployments in this simulator");
  if (!name) fail(`error: specify the deployment, e.g. kubectl rollout ${sub} deployment/web`);
  if (p.revision !== undefined && sub !== "history") fail("error: --revision is only supported with kubectl rollout history");
  if (p.toRevision !== undefined && sub !== "undo") fail("error: --to-revision is only supported with kubectl rollout undo");
  requireNamespace(c, p.namespace);
  const d = find(c, "Deployment", p.namespace, name) ?? notFound("Deployment", name);
  const ref = `deployment.apps/${name}`;
  switch (sub) {
    case "status":
      return rolloutStatus(c, d);
    case "history":
      return rolloutHistory(c, p, d);
    case "undo":
      return rolloutUndo(c, p, d);
    case "restart":
      if (d.paused) fail(`error: deployments.apps "${name}" can't restart paused deployment (run rollout resume first)`);
      d.template.annotations = { ...d.template.annotations, [RESTARTED_AT]: timestamp(c) };
      return `${ref} restarted`;
    default: {
      const pause = sub === "pause";
      if (!!d.paused === pause) fail(`error: deployments.apps "${name}" is ${pause ? "already" : "not"} paused`);
      d.paused = pause || undefined;
      return `${ref} ${pause ? "paused" : "resumed"}`;
    }
  }
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

type ManifestContainer = Extract<Manifest, { kind: "Pod" }>["spec"]["containers"][number];

function podSpecKey(spec: { containers: { name: string; image: string }[] }) {
  const [first, ...rest] = spec.containers;
  return canonical({ ...spec, containers: [{ ...first, image: "" }, ...rest] });
}

const specKeyOf = (p: Pod) => p.specKey ?? podSpecKey({ containers: [{ ...p.container, image: p.image }] });

const userAnnotations = (a: Labels) => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith(MANAGED_PREFIX)));

/** The fields apply compares and updates, besides labels and annotations. */
function applied(r: Resource) {
  switch (r.kind) {
    case "Pod":
      return { image: r.image, specKey: specKeyOf(r) };
    case "ReplicaSet":
      return { replicas: r.replicas, selector: r.selector, template: r.template };
    case "Deployment":
      return { replicas: r.replicas, selector: r.selector, template: r.template, strategy: r.strategy };
    case "Service":
      return { type: r.type, clusterIP: r.clusterIP, selector: r.selector, ports: r.ports };
    case "ConfigMap":
      return { data: r.data };
    case "Secret":
      return { type: r.type, data: r.data };
  }
}

const compared = (r: Resource) => ({ labels: r.metadata.labels, annotations: userAnnotations(r.metadata.annotations), ...applied(r) });

// shortcut: only the first container is modelled; further containers and resources are validated but ignored.
function toContainer(m: ManifestContainer): Container {
  const { name, ports, env, envFrom, readinessProbe, livenessProbe, startupProbe } = m;
  return structuredClone({ name, ports, env, envFrom, readinessProbe, livenessProbe, startupProbe });
}

function toResource(c: Cluster, m: Exclude<Manifest, { kind: "Namespace" }>, namespace: string): Resource {
  const labels = m.metadata.labels ?? {};
  const annotations = m.metadata.annotations ?? {};
  switch (m.kind) {
    case "Pod": {
      const [first] = m.spec.containers;
      const pod = newPod(c, m.metadata.name, namespace, { labels, annotations, image: first.image, container: toContainer(first) });
      pod.specKey = podSpecKey(m.spec);
      return pod;
    }
    case "Service": {
      const ports = m.spec.ports.map((x) => ({ ...x, protocol: x.protocol ?? "TCP", targetPort: x.targetPort ?? x.port }));
      const s: Service = { kind: "Service", metadata: meta(c, m.metadata.name, namespace, labels, annotations), type: m.spec.type ?? "ClusterIP", clusterIP: m.spec.clusterIP ?? "", selector: { ...m.spec.selector }, ports };
      return s;
    }
    case "ConfigMap":
      return { kind: "ConfigMap", metadata: meta(c, m.metadata.name, namespace, labels, annotations), data: { ...m.data } };
    case "Secret": {
      const data = { ...m.data };
      for (const [k, v] of Object.entries(m.stringData ?? {})) data[k] = encodeBase64(v);
      return { kind: "Secret", metadata: meta(c, m.metadata.name, namespace, labels, annotations), type: m.type ?? "Opaque", data };
    }
  }
  if (m.spec.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
  const t = m.spec.template;
  const template: PodTemplate = {
    labels: { ...t.metadata.labels },
    ...(t.metadata.annotations && { annotations: { ...t.metadata.annotations } }),
    image: t.spec.containers[0].image,
    container: toContainer(t.spec.containers[0]),
  };
  const base = { metadata: meta(c, m.metadata.name, namespace, labels, annotations), replicas: m.spec.replicas, selector: { ...m.spec.selector.matchLabels }, template };
  if (m.kind === "ReplicaSet") return { kind: "ReplicaSet", ...base };
  const s = m.spec.strategy;
  return {
    kind: "Deployment",
    ...base,
    strategy: {
      type: s?.type ?? "RollingUpdate",
      maxSurge: s?.rollingUpdate?.maxSurge ?? "25%",
      maxUnavailable: s?.rollingUpdate?.maxUnavailable ?? "25%",
    },
  };
}

/** Server-assigned Service fields: keep the existing ones, allocate what is missing. */
function assignServiceFields(c: Cluster, s: Service, existing?: Service) {
  if (existing) {
    if (s.clusterIP && s.clusterIP !== existing.clusterIP) {
      fail(`The Service "${s.metadata.name}" is invalid: spec.clusterIP: Invalid value: "${s.clusterIP}": field is immutable`);
    }
    s.clusterIP = existing.clusterIP;
    for (const port of s.ports) port.nodePort ??= existing.ports.find((x) => x.port === port.port)?.nodePort;
  } else if (!s.clusterIP) allocateClusterIP(c, s);
  else if (list(c, "Service").some((x) => x.clusterIP === s.clusterIP)) {
    fail(`The Service "${s.metadata.name}" is invalid: spec.clusterIP: Invalid value: "${s.clusterIP}": provided IP is already allocated`);
  }
  allocateNodePorts(c, s);
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
    if (r.kind === "Service") assignServiceFields(draft, r, existing as Service | undefined);
    let result = "created";
    if (!existing) {
      draft.resources.push(r);
    } else if (canonical(compared(existing)) === canonical(compared(r))) {
      result = "unchanged";
    } else {
      if (existing.kind === "Pod" && specKeyOf(existing) !== specKeyOf(r as Pod)) {
        fail(`The Pod "${name}" is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\``);
      }
      if (existing.kind === "Pod" && existing.image !== (r as Pod).image) existing.status = "ContainerCreating";
      const managed = Object.fromEntries(Object.entries(existing.metadata.annotations).filter(([k]) => k.startsWith(MANAGED_PREFIX)));
      existing.metadata.labels = r.metadata.labels;
      existing.metadata.annotations = { ...managed, ...r.metadata.annotations };
      Object.assign(existing, applied(r));
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
  if (p.showLabels) only(p.verb === "get", "--show-labels is only supported with kubectl get");
  if (p.dryRun) only(["create", "run", "expose", "apply"].includes(p.verb), "--dry-run=client is only supported with kubectl create, run, expose and apply");
  if (p.output === "wide") only(p.verb === "get", "-o wide is only supported with kubectl get");
  if (p.output) only(p.verb === "get" || p.dryRun, "-o is only supported with kubectl get, or together with --dry-run=client");
  if (p.replicas !== undefined) only(p.verb === "scale" || p.verb === "create", "--replicas is only supported with kubectl scale and create deployment");
  if (p.image) only(p.verb === "create" || p.verb === "run", "--image is only supported with kubectl create deployment and run");
  if (p.filename) only(p.verb === "apply" || p.verb === "delete", "-f is only supported with kubectl apply and delete");
  if (p.port || p.targetPort || p.type || p.name) only(p.verb === "expose", "--port, --target-port, --type and --name are only supported with kubectl expose");
  if (p.tcp.length) only(p.verb === "create", "--tcp is only supported with kubectl create service");
  if (p.literals.length) only(p.verb === "create", "--from-literal is only supported with kubectl create configmap and create secret generic");
  if (p.overwrite) only(p.verb === "label" || p.verb === "annotate", "--overwrite is only supported with kubectl label and annotate");
  if (p.revision !== undefined || p.toRevision !== undefined) only(p.verb === "rollout", "--revision and --to-revision are only supported with kubectl rollout");
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
    case "expose":
      return expose(c, p);
    case "set":
      return setImage(c, p);
    case "label":
      return setMetadata(c, p, "labels");
    case "annotate":
      return setMetadata(c, p, "annotations");
    case "rollout":
      return rollout(c, p);
    case "apply":
      return apply(c, p);
    default:
      fail(`error: "kubectl ${p.verb}" is not supported in this simulator.\nType "kubectl help" for the supported commands.`);
  }
}

/** Splits like a shell: whitespace separates words, '...' and "..." group them. Nothing is expanded. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let word = "";
  let inWord = false;
  let quote = "";
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = "";
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) tokens.push(word);
      word = "";
      inWord = false;
    } else {
      word += ch;
      inWord = true;
    }
  }
  if (quote) fail(`error: unterminated quote (${quote}), close it with a matching ${quote}`);
  if (inWord) tokens.push(word);
  return tokens;
}

/** Index of the last `>` outside quotes, or -1. */
function redirectIndex(input: string): number {
  let quote = "";
  let index = -1;
  [...input].forEach((ch, i) => {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === ">") index = i;
  });
  return index;
}

function shell(c: Cluster, input: string, redirected: boolean): string {
  const tokens = tokenize(input);
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
  const redirect = redirectIndex(input);
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
