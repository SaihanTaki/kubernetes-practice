import { parseAllDocuments, stringify } from "yaml";
import type { z } from "zod";
import { CONFIG_KEY_RE, LABEL_KEY_RE, LABEL_VALUE_RE, manifestSchema } from "../manifest-schema";
import { admit, defaultLimitRangeItem, formatHard, parseHard, QUOTA_KEYS, quotaUsed, withDefaultRequests } from "./admission";
import {
  age,
  annotationText,
  CommandError,
  eventsSection,
  fail,
  labelText,
  pad,
  type Parsed,
  type Requirement,
  selects,
  table,
} from "./cli";
import {
  addResource,
  canonical,
  CHANGE_CAUSE,
  CLUSTER_SCOPED,
  containerName,
  currentReplicaSet,
  decodeBase64,
  encodeBase64,
  endpointsOf,
  find,
  HASH_LABEL,
  hash,
  isReady,
  lastTermination,
  qosClass,
  list,
  meta,
  newPod,
  podIP,
  podsOf,
  reconcile,
  removeResource,
  replicaSetsOf,
  revisionOf,
  settle,
  workerNode,
} from "./cluster";
import {
  CRONJOB_HEADER,
  cronJobManifest,
  cronJobRow,
  describeCronJob,
  describeJob,
  JOB_HEADER,
  jobManifest,
  jobRow,
  newJob,
  parseCron,
  validTimeZone,
} from "./batch";
import { eventsOf } from "./events";
import { exec } from "./exec";
import { timestamp } from "./images";
import { cordon, describeNode, drain, NODE_HEADER, NODE_WIDE_HEADER, nodeManifest, nodeRow, taint } from "./nodes";
import { getEvents, kubeletEvents, logs, top } from "./observe";
import { containerLines, volumeLines } from "./podtext";
import {
  DAEMONSET_HEADER,
  daemonSetManifest,
  daemonSetRow,
  describeDaemonSet,
  describeStatefulSet,
  setRolloutStatus,
  STATEFULSET_HEADER,
  statefulSetManifest,
  statefulSetRow,
} from "./sets";
import { claimClass, deleteClaim, deleteVolume, describeStorage, STORAGE_HEADERS, storageManifest, storageRow } from "./storage";
import { parseMemory } from "./quantity";
import type {
  Cluster,
  Container,
  DaemonSet,
  Deployment,
  Job,
  JobSpec,
  Kind,
  Labels,
  Node,
  PersistentVolumeClaim,
  Pod,
  PodSpec,
  PodTemplate,
  Probe,
  ReplicaSet,
  Resource,
  ResourceQuota,
  RunResult,
  Secret,
  Service,
  ServicePort,
  ServiceType,
  StatefulSet,
  StorageClass,
  PersistentVolume,
} from "./types";

type Manifest = z.infer<typeof manifestSchema>;

type ResourceType = Kind | "Namespace" | "Endpoints" | "Event";

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
  limits: "LimitRange", limitrange: "LimitRange", limitranges: "LimitRange",
  quota: "ResourceQuota", resourcequota: "ResourceQuota", resourcequotas: "ResourceQuota",
  ev: "Event", event: "Event", events: "Event",
  job: "Job", jobs: "Job",
  cj: "CronJob", cronjob: "CronJob", cronjobs: "CronJob",
  ds: "DaemonSet", daemonset: "DaemonSet", daemonsets: "DaemonSet",
  sts: "StatefulSet", statefulset: "StatefulSet", statefulsets: "StatefulSet",
  pv: "PersistentVolume", persistentvolume: "PersistentVolume", persistentvolumes: "PersistentVolume",
  pvc: "PersistentVolumeClaim", persistentvolumeclaim: "PersistentVolumeClaim", persistentvolumeclaims: "PersistentVolumeClaim",
  sc: "StorageClass", storageclass: "StorageClass", storageclasses: "StorageClass",
};

const PLURAL: Record<ResourceType, string> = {
  Pod: "pods", ReplicaSet: "replicasets", Deployment: "deployments", Namespace: "namespaces", Node: "nodes",
  Service: "services", Endpoints: "endpoints", ConfigMap: "configmaps", Secret: "secrets",
  LimitRange: "limitranges", ResourceQuota: "resourcequotas", Event: "events",
  Job: "jobs", CronJob: "cronjobs", DaemonSet: "daemonsets", StatefulSet: "statefulsets",
  PersistentVolume: "persistentvolumes", PersistentVolumeClaim: "persistentvolumeclaims", StorageClass: "storageclasses",
};

const GROUP: Record<ResourceType, string> = {
  Pod: "pod", ReplicaSet: "replicaset.apps", Deployment: "deployment.apps", Namespace: "namespace", Node: "node",
  Service: "service", Endpoints: "endpoints", ConfigMap: "configmap", Secret: "secret",
  LimitRange: "limitrange", ResourceQuota: "resourcequota", Event: "event",
  Job: "job.batch", CronJob: "cronjob.batch", DaemonSet: "daemonset.apps", StatefulSet: "statefulset.apps",
  PersistentVolume: "persistentvolume", PersistentVolumeClaim: "persistentvolumeclaim", StorageClass: "storageclass.storage.k8s.io",
};

/** `deployments.apps`, `jobs.batch`, `pods`: the resource name the API uses in errors. */
const apiName = (type: ResourceType) => {
  const dot = GROUP[type].indexOf(".");
  return dot === -1 ? PLURAL[type] : `${PLURAL[type]}${GROUP[type].slice(dot)}`;
};

/** The namespace a command acts in: "" for cluster-scoped kinds, which ignore -n. */
const nsOf = (type: ResourceType, p: Parsed) => (CLUSTER_SCOPED.has(type) ? "" : p.namespace);

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
             configmaps (cm), secrets, namespaces, nodes (no),
             limitranges (limits), resourcequotas (quota), events (ev),
             jobs, cronjobs (cj), daemonsets (ds), statefulsets (sts),
             persistentvolumes (pv), persistentvolumeclaims (pvc),
             storageclasses (sc)
  kubectl get events [--field-selector involvedObject.name=<name>]
  kubectl describe <type> <name>   (any type above except endpoints, events, namespaces)
  kubectl create deployment <name> --image=<image> [--replicas=<n>]
  kubectl create job <name> --image=<image> [-- <command> <args>...]
  kubectl create job <name> --from=cronjob/<cronjob>
  kubectl create cronjob <name> --image=<image> --schedule='<cron>' [-- <command> <args>...]
  kubectl create namespace <name>
  kubectl create service <clusterip|nodeport|loadbalancer> <name> --tcp=<port>:<targetPort>
  kubectl create configmap <name> --from-literal=<key>=<value> ...
  kubectl create secret generic <name> --from-literal=<key>=<value> ...
  kubectl create quota <name> --hard=pods=3,requests.cpu=1,limits.memory=2Gi
  kubectl run <name> --image=<image>
  kubectl expose <deployment|replicaset|pod> <name> --port=<p> [--target-port=<p>]
                 [--type=ClusterIP|NodePort|LoadBalancer] [--name=<service>]
  kubectl set image deployment/<name> <container>=<image>
  kubectl scale <deployment|replicaset|statefulset> <name> --replicas=<n>
  kubectl patch cronjob <name> -p '{"spec":{"suspend":true}}'   (or false)
  kubectl label <type> <name> <key>=<value>... [<key>-] [--overwrite]
  kubectl annotate <type> <name> <key>=<value>... [<key>-] [--overwrite]
  kubectl rollout status deployment/<name>
  kubectl rollout history deployment/<name> [--revision=<n>]
  kubectl rollout undo deployment/<name> [--to-revision=<n>]
  kubectl rollout restart deployment/<name>
  kubectl rollout status|restart daemonset/<name> | statefulset/<name>
  kubectl rollout pause deployment/<name>
  kubectl rollout resume deployment/<name>
  kubectl apply -f <file>
  kubectl delete <type> <name>     (any type above except replicasets, endpoints, events)
  kubectl delete -f <file>
  kubectl taint nodes <node> <key>=<value>:<effect> | <key>:<effect> | <key>:<effect>- | <key>-
      effects: NoSchedule, PreferNoSchedule, NoExecute
  kubectl cordon <node>
  kubectl uncordon <node>
  kubectl drain <node> [--ignore-daemonsets] [--force] [--delete-emptydir-data]
  kubectl top nodes|pods [name]
  kubectl logs <pod|deployment/<name>|replicaset/<name>|job/<name>|
               daemonset/<name>|statefulset/<name>> [-c <container>]
               [--previous] [--tail=<n>]
  kubectl exec <pod|<type>/<name>> [-c <container>] -- <command>
      commands: cat <file>..., ls [dir], echo <text>,
                sh -c '<commands separated by ; && ||, with > or >> file>'

  ls                       list files
  cat <file>               print a file
  <kubectl command> > <file>
                           write the output to a file instead of printing it
  clear

Quote values that contain spaces or brackets with '...' or "...".

Supported flags:
  -n, --namespace <ns>     use a namespace other than "default"
  -A, --all-namespaces     list across all namespaces (get, top pods)
  -l, --selector <query>   filter by labels (get only): k=v, k!=v, k, !k,
                           'k in (a,b)', 'k notin (a,b)'; commas mean AND
  --show-labels            add a LABELS column (get only)
  -o, --output yaml|wide   print as YAML, or a table with more columns (get),
                           or YAML together with --dry-run=client
  -f, --filename <file>    manifest file (apply, delete)
  --image <image>          container image (create deployment, job, cronjob, run)
  --schedule <cron>        5-field schedule, e.g. '*/5 * * * *' (create cronjob)
  --from cronjob/<name>    create a Job from a CronJob's template (create job)
  -- <command>...          the container command (exec, create job, create cronjob)
  -p, --patch <json>       the change to make (patch)
  -i, -t, -it              accepted and ignored (exec)
  --replicas <n>           number of replicas (scale, create deployment)
  --port, --target-port    Service port and the container port it sends to (expose)
  --type <type>            Service type (expose)
  --name <name>            Service name (expose)
  --tcp <port>:<target>    Service port (create service)
  --from-literal <k>=<v>   a key and value (create configmap, create secret generic)
  --overwrite              allow changing an existing value (label, annotate, taint)
  --revision <n>           show one revision (rollout history)
  --to-revision <n>        revision to go back to (rollout undo)
  --dry-run=client         print what would be created without changing anything
                           (create, run, expose, apply)
  --hard <key>=<value>,... quota limits (create quota)
  --field-selector <k>=<v> filter events by involvedObject.name, involvedObject.kind,
                           type or reason; also != (get events)
  -c, --container <name>   container to show logs of or run in (logs, exec)
  -p, --previous           logs of the previous, crashed container (logs)
  --tail <n>               only the last n log lines (logs)
  --ignore-daemonsets      leave DaemonSet Pods in place (drain)
  --force                  also delete Pods without a controller (drain)
  --delete-emptydir-data   also delete Pods with emptyDir data (drain)

Cluster-scoped types (nodes, namespaces, persistentvolumes, storageclasses) ignore -n.`;

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
    previous: false,
    force: false,
    ignoreDaemonsets: false,
    deleteEmptydirData: false,
  };

  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--") {
      p.command = tokens.slice(i + 1);
      break;
    }
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
        if (p.verb === "patch") {
          if (value !== "merge" && value !== "strategic") fail(`error: --type "${value}" is not supported in this simulator, use merge or strategic`);
          break;
        }
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
      case "-c":
      case "--container":
        p.container = takeValue();
        if (!NAME_RE.test(p.container)) fail(`error: invalid container name "${p.container}"`);
        break;
      case "-p":
      case "--previous":
        if (p.verb === "patch" && flag === "-p") p.patch = takeValue();
        else p.previous = true;
        break;
      case "--patch":
        p.patch = takeValue();
        break;
      case "--schedule":
        p.schedule = takeValue();
        break;
      case "--from":
        p.from = takeValue();
        break;
      case "-i":
      case "-t":
      case "-it":
      case "-ti":
      case "--stdin":
      case "--tty":
        if (p.verb !== "exec") fail(`error: ${flag} is only supported with kubectl exec`);
        break;
      case "--tail":
        p.tail = takeCount();
        break;
      case "--field-selector":
        p.fieldSelector = takeValue();
        break;
      case "--hard":
        p.hard = takeValue();
        break;
      case "--force":
        p.force = true;
        break;
      case "--ignore-daemonsets":
        p.ignoreDaemonsets = true;
        break;
      case "--delete-emptydir-data":
        p.deleteEmptydirData = true;
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

function notFound(type: ResourceType, name: string): never {
  fail(`Error from server (NotFound): ${apiName(type)} "${name}" not found`);
}

function requireNamespace(c: Cluster, ns: string) {
  if (ns && !c.namespaces.includes(ns)) fail(`Error from server (NotFound): namespaces "${ns}" not found`);
}

// A crash-looping Pod was started at least once, so Kubernetes keeps its phase at Running.
const PHASES: Partial<Record<Pod["status"], string>> = { Running: "Running", CrashLoopBackOff: "Running", OOMKilled: "Running", Completed: "Succeeded", Error: "Failed" };
const phase = (p: Pod) => PHASES[p.status] ?? "Pending";

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

const templateYaml = (t: PodTemplate) => ({
  metadata: { labels: t.labels, annotations: t.annotations },
  spec: { ...t.spec, containers: containerYaml(t.image, t.container) },
});

/** Pods get an IP once their sandbox exists, after ContainerCreating. */
const hasIP = (p: Pod) => !!p.node && p.status !== "ContainerCreating" && p.status !== "Pending";

const nonEmpty = (o: Labels) => (Object.keys(o).length ? o : undefined);

/** `live: false` leaves out what only the server sets (status, owners, node, IPs), as a dry run prints. */
function manifest(c: Cluster, r: Resource, live = true) {
  const metadata: Record<string, unknown> = {
    name: r.metadata.name,
    namespace: r.metadata.namespace || undefined,
    labels: r.metadata.labels,
    annotations: nonEmpty(r.metadata.annotations),
  };
  if (live && (r.kind === "Pod" || r.kind === "ReplicaSet" || r.kind === "Job") && r.owner) {
    const owner = { Pod: r.kind === "Pod" ? (r.ownerKind ?? "ReplicaSet") : "", ReplicaSet: "Deployment", Job: "CronJob" }[r.kind];
    metadata.ownerReferences = [{ kind: owner, name: r.owner }];
  }
  if (r.kind === "Pod") {
    const containers = containerYaml(r.image, r.container);
    return {
      apiVersion: "v1",
      kind: "Pod",
      metadata,
      spec: { ...r.spec, ...(live && r.node && { nodeName: r.node }), containers },
      ...(live && {
        status: {
          phase: phase(r),
          podIP: hasIP(r) ? podIP(r) : undefined,
          reason: r.status === "Running" ? undefined : r.status,
          ready: isReady(r),
          restartCount: r.restarts,
          qosClass: qosClass(r.container),
        },
      }),
    };
  }
  if (r.kind === "Node") return nodeManifest(r, live);
  if (r.kind === "LimitRange") return { apiVersion: "v1", kind: "LimitRange", metadata, spec: { limits: r.limits } };
  if (r.kind === "ResourceQuota") {
    const used = Object.fromEntries(Object.keys(r.hard).sort().map((k) => [k, formatHard(k, quotaUsed(c, r, k))]));
    return { apiVersion: "v1", kind: "ResourceQuota", metadata, spec: { hard: r.hard }, ...(live && { status: { hard: r.hard, used } }) };
  }
  if (r.kind === "Service") {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata,
      spec: {
        type: r.type,
        clusterIP: live || r.clusterIP === "None" ? r.clusterIP : undefined,
        selector: nonEmpty(r.selector),
        ports: r.ports.map((p) => ({ ...p, nodePort: live ? p.nodePort : undefined })),
      },
      ...(live && { status: { loadBalancer: {} } }),
    };
  }
  if (r.kind === "ConfigMap") return { apiVersion: "v1", kind: "ConfigMap", metadata, data: r.data };
  if (r.kind === "Secret") return { apiVersion: "v1", kind: "Secret", metadata, type: r.type, data: r.data };
  if (r.kind === "StorageClass" || r.kind === "PersistentVolume" || r.kind === "PersistentVolumeClaim") return storageManifest(c, r, metadata, live);
  if (r.kind === "CronJob") return cronJobManifest(r, metadata, templateYaml(r.jobTemplate.template), live);
  const template = templateYaml(r.template);
  if (r.kind === "Job") return jobManifest(c, r, metadata, template, live);
  if (r.kind === "DaemonSet") return daemonSetManifest(c, r, metadata, template, live);
  if (r.kind === "StatefulSet") return statefulSetManifest(c, r, metadata, template, live);
  const spec = { replicas: r.replicas, selector: { matchLabels: r.selector }, template };
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
  if (type === "Event") {
    if (name || p.selector || p.output || p.showLabels) fail("error: get events supports only -n, -A and --field-selector in this simulator");
    return getEvents(c, p);
  }
  if (p.fieldSelector) fail("error: --field-selector is only supported with kubectl get events in this simulator");
  const clusterScoped = CLUSTER_SCOPED.has(type);
  const allNamespaces = p.allNamespaces && !clusterScoped;
  const nsLabel = allNamespaces || clusterScoped ? "" : ` in ${p.namespace} namespace`;

  if (type === "Namespace") {
    if (p.showLabels || p.output === "wide") fail(`error: --show-labels and -o wide are not supported for ${PLURAL[type]} in this simulator`);
    const picked = name ? c.namespaces.filter((n) => n === name) : c.namespaces;
    if (name && !picked.length) notFound(type, name);
    if (p.output) {
      const items = picked.map((n) => ({ apiVersion: "v1", kind: type, metadata: { name: n } }));
      return stringify(name ? items[0] : { apiVersion: "v1", kind: "List", items }).trimEnd();
    }
    return table([["NAME", "STATUS", "AGE"], ...picked.map((n) => [n, "Active", age(c, -600)])]);
  }

  if (!allNamespaces && !clusterScoped && !name && !c.namespaces.includes(p.namespace)) return `No resources found${nsLabel}.`;
  // Endpoints are computed from Services, never stored.
  let items: Resource[] = list(c, type === "Endpoints" ? "Service" : type, allNamespaces ? undefined : nsOf(type, p));
  if (name) {
    if (allNamespaces) fail("error: a resource cannot be retrieved by name across all namespaces");
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
        return wide ? [...row, hasIP(r) ? podIP(r) : "<none>", r.node || "<none>"] : row;
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
      case "Node":
        return nodeRow(c, r, wide);
      case "LimitRange":
        return [r.metadata.name, timestamp(r.metadata.createdAt)];
      case "ResourceQuota": {
        const keys = Object.keys(r.hard).sort();
        const usage = (ks: string[]) => ks.map((k) => `${k}: ${formatHard(k, quotaUsed(c, r, k))}/${r.hard[k]}`).join(", ");
        return [r.metadata.name, created, usage(keys.filter((k) => !k.startsWith("limits."))), usage(keys.filter((k) => k.startsWith("limits.")))];
      }
      case "Job":
        return jobRow(c, r, wide);
      case "CronJob":
        return cronJobRow(c, r, wide);
      case "DaemonSet":
        return daemonSetRow(c, r, wide);
      case "StatefulSet":
        return statefulSetRow(c, r, wide);
      case "StorageClass":
      case "PersistentVolume":
      case "PersistentVolumeClaim":
        return storageRow(c, r);
    }
  });
  const workloadWide = wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [];
  const header = {
    Pod: ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE"] : [])],
    ReplicaSet: ["NAME", "DESIRED", "CURRENT", "READY", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    Deployment: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    Service: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])],
    Endpoints: ["NAME", "ENDPOINTS", "AGE"],
    ConfigMap: ["NAME", "DATA", "AGE"],
    Secret: ["NAME", "TYPE", "DATA", "AGE"],
    Node: [...NODE_HEADER, ...(wide ? NODE_WIDE_HEADER : [])],
    LimitRange: ["NAME", "CREATED AT"],
    ResourceQuota: ["NAME", "AGE", "REQUEST", "LIMIT"],
    Job: [...JOB_HEADER, ...workloadWide],
    CronJob: [...CRONJOB_HEADER, ...workloadWide],
    DaemonSet: [...DAEMONSET_HEADER, ...workloadWide],
    StatefulSet: [...STATEFULSET_HEADER, ...workloadWide.slice(0, 2)],
    ...STORAGE_HEADERS,
  }[type];
  const all = [header, ...rows];
  if (p.showLabels) all.forEach((row, i) => row.push(i ? labelText(items[i - 1].metadata.labels) : "LABELS"));
  if (allNamespaces) all.forEach((row, i) => row.unshift(i ? items[i - 1].metadata.namespace : "NAMESPACE"));
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

const resourceLines = (ctr: Container): string[] =>
  (["limits", "requests"] as const).flatMap((field) => {
    const values = Object.entries(ctr.resources?.[field] ?? {});
    if (!values.length) return [];
    return [`${field[0].toUpperCase()}${field.slice(1)}:`, ...values.map(([k, v]) => `  ${`${k}:`.padEnd(8)} ${v}`)];
  });

const TERMINATED: Pod["status"][] = ["OOMKilled", "Completed", "Error"];

function podState(p: Pod): string | undefined {
  if (p.status === "Pending") return undefined;
  if (p.status === "Running") return "Running";
  return `${TERMINATED.includes(p.status) ? "Terminated" : "Waiting"} (reason: ${p.status})`;
}

const tolerationText = (t: NonNullable<PodSpec["tolerations"]>[number]) =>
  `${t.key ?? ""}${t.operator === "Exists" ? "" : `=${t.value ?? ""}`}:${t.effect ?? ""}${t.operator === "Exists" ? " op=Exists" : ""}${t.tolerationSeconds !== undefined ? ` for ${t.tolerationSeconds}s` : ""}`;

function describePod(c: Cluster, r: Pod): string {
  const ctr = r.container;
  const last = lastTermination(r);
  const multi = (items: string[]) => items.join("\n                ") || "<none>";
  return [
    pad([
      ["Name", r.metadata.name],
      ["Namespace", r.metadata.namespace],
      ["Node", r.node || "<none>"],
      ["Labels", labelText(r.metadata.labels)],
      ["Annotations", annotationText(r.metadata.annotations)],
      ["Status", phase(r)],
      ["IP", hasIP(r) ? podIP(r) : "<none>"],
      ["Controlled By", r.owner ? `${r.ownerKind ?? "ReplicaSet"}/${r.owner}` : "<none>"],
      ["Container", ctr.name],
      ["Image", r.image],
      ["Port", ctr.ports?.map((x) => `${x.containerPort}/${x.protocol ?? "TCP"}`).join(", ")],
      ["State", podState(r)],
      ...(last ? ([["Last State", "Terminated"], ["  Reason", last.reason], ["  Exit Code", String(last.exitCode)]] as [string, string][]) : []),
      ["Ready", isReady(r) ? "True" : "False"],
      ["Restart Count", String(r.restarts)],
    ]),
    ...resourceLines(ctr),
    pad([
      ["Liveness", probeText(ctr.livenessProbe)],
      ["Readiness", probeText(ctr.readinessProbe)],
      ["Startup", probeText(ctr.startupProbe)],
    ]),
    ...envLines(ctr),
    ...containerLines(ctr),
    ...volumeLines(r.spec?.volumes),
    pad([
      ["QoS Class", qosClass(ctr)],
      ["Node-Selectors", labelText(r.spec?.nodeSelector ?? {})],
      ["Tolerations", multi((r.spec?.tolerations ?? []).map(tolerationText))],
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function describeQuota(c: Cluster, q: ResourceQuota): string {
  const rows = Object.keys(q.hard).sort().map((k) => [k, formatHard(k, quotaUsed(c, q, k)), q.hard[k]]);
  return `${pad([["Name", q.metadata.name], ["Namespace", q.metadata.namespace]])}\n${table([["Resource", "Used", "Hard"], ["--------", "----", "----"], ...rows])}`;
}

function describe(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (!name) fail(`error: specify the ${type.toLowerCase()} name to describe`);
  if (type === "Namespace" || type === "Endpoints" || type === "Event") {
    fail(`error: describe ${PLURAL[type]} is not supported in this simulator`);
  }
  const ns = nsOf(type, p);
  requireNamespace(c, ns);
  const r = find(c, type, ns, name) ?? notFound(type, name);
  if (r.kind === "Node") return describeNode(c, r);
  if (r.kind === "StorageClass" || r.kind === "PersistentVolume" || r.kind === "PersistentVolumeClaim") return describeStorage(c, r);
  const events = [...eventsOf(c, r), ...(r.kind === "Pod" ? kubeletEvents(c, r) : [])];
  return `${describeBody(c, r)}\n${eventsSection(c, events)}`;
}

function describeBody(c: Cluster, r: Exclude<Resource, Node | StorageClass | PersistentVolume | PersistentVolumeClaim>): string {
  const head: [string, string][] = [
    ["Name", r.metadata.name],
    ["Namespace", r.metadata.namespace],
    ["Labels", labelText(r.metadata.labels)],
    ["Annotations", annotationText(r.metadata.annotations)],
  ];

  if (r.kind === "Pod") return describePod(c, r);
  if (r.kind === "ResourceQuota") return describeQuota(c, r);
  if (r.kind === "Job") return describeJob(c, r);
  if (r.kind === "CronJob") return describeCronJob(c, r);
  if (r.kind === "DaemonSet") return describeDaemonSet(c, r);
  if (r.kind === "StatefulSet") return describeStatefulSet(c, r);
  if (r.kind === "LimitRange") {
    const rows = r.limits.flatMap((item) =>
      (["cpu", "memory"] as const)
        .filter((res) => [item.min, item.max, item.defaultRequest, item.default].some((l) => l?.[res] !== undefined))
        .map((res) => [item.type, res, item.min?.[res] ?? "-", item.max?.[res] ?? "-", item.defaultRequest?.[res] ?? "-", item.default?.[res] ?? "-", "-"]),
    );
    const header = ["Type", "Resource", "Min", "Max", "Default Request", "Default Limit", "Max Limit/Request Ratio"];
    return `${pad([["Name", r.metadata.name], ["Namespace", r.metadata.namespace]])}\n${table([header, header.map((h) => "-".repeat(h.length)), ...rows])}`;
  }
  if (r.kind === "ReplicaSet") {
    const pods = podsOf(c, r);
    const ready = pods.filter(isReady).length;
    return [
      pad([
        ...head,
        ["Selector", labelText(r.selector)],
        ["Controlled By", r.owner ? `Deployment/${r.owner}` : "<none>"],
        ["Replicas", `${pods.length} current / ${r.replicas} desired`],
        ["Pods Status", `${ready} Running / ${pods.length - ready} Waiting`],
        ["Image", r.template.image],
      ]),
      ...resourceLines(r.template.container),
    ].join("\n");
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
  return [pad([
    ...head,
    ["Selector", labelText(r.selector)],
    ["Replicas", `${r.replicas} desired | ${s.updated} updated | ${s.total} total | ${s.ready} available | ${s.total - s.ready} unavailable`],
    ["StrategyType", strategy],
    ["RollingUpdateStrategy", strategy === "RollingUpdate" ? `${maxUnavailable} max unavailable, ${maxSurge} max surge` : undefined],
    ["Paused", r.paused ? "true" : undefined],
    ["Image", r.template.image],
    ["OldReplicaSets", olds.map(rsText).join(", ") || "<none>"],
    ["NewReplicaSet", current ? rsText(current) : "<none>"],
  ]), ...resourceLines(r.template.container)].join("\n");
}

function scale(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "Deployment" && type !== "ReplicaSet" && type !== "StatefulSet") fail(`error: cannot scale ${PLURAL[type]}, only deployments, replicasets and statefulsets`);
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
  if (r.kind === "PersistentVolumeClaim") deleteClaim(c, r);
  else if (r.kind === "PersistentVolume") deleteVolume(c, r);
  else removeResource(c, r);
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
  if (type === "ReplicaSet" || type === "Endpoints" || type === "Event") {
    fail(`error: delete ${PLURAL[type]} is not supported in this simulator; delete the Deployment that owns them, or another type`);
  }
  if (!name) fail("error: specify the name of the resource to delete");
  return type === "Namespace" ? deleteNamespace(c, name) : deleteResource(c, type, nsOf(type, p), name);
}

const requireImage = (p: Parsed) => p.image ?? fail("error: required flag --image not set, e.g. --image=nginx:1.27");

/** Adds a new resource, or with --dry-run=client only prints it. */
function createResource(c: Cluster, p: Parsed, r: Resource, done = "created"): string {
  const ref = `${GROUP[r.kind]}/${r.metadata.name}`;
  if (p.dryRun) return p.output ? stringify(manifest(c, r, false)).trimEnd() : `${ref} ${done} (dry run)`;
  requireNamespace(c, r.metadata.namespace);
  if (find(c, r.kind, r.metadata.namespace, r.metadata.name)) {
    fail(`Error from server (AlreadyExists): ${apiName(r.kind)} "${r.metadata.name}" already exists`);
  }
  const denied = admit(c, r);
  if (denied) fail(`Error from server (Forbidden): ${apiName(r.kind)} "${r.metadata.name}" is forbidden: ${denied}`);
  addResource(c, r);
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

function parseHardFlag(value?: string): Record<string, string> {
  if (!value) fail("error: required flag --hard not set, e.g. --hard=pods=3,requests.cpu=1");
  const hard: Record<string, string> = {};
  for (const part of value.split(",")) {
    const eq = part.indexOf("=");
    const [key, q] = [part.slice(0, eq), part.slice(eq + 1)];
    if (eq < 1 || !QUOTA_KEYS.includes(key)) fail(`error: invalid --hard "${part}", use <key>=<value> with a key from ${QUOTA_KEYS.join(", ")}`);
    if (parseHard(key, q) === null) fail(`error: invalid --hard "${part}": quantities must look like 3, 500m, 1 or 2Gi`);
    hard[key] = q;
  }
  return hard;
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
  if (!["Deployment", "Namespace", "ConfigMap", "ResourceQuota", "Job", "CronJob"].includes(type)) {
    fail(`error: create ${PLURAL[type]} is not supported in this simulator, only deployments, namespaces, services, configmaps, secrets, quotas, jobs and cronjobs`);
  }
  if (!name) fail(`error: specify the name of the ${type.toLowerCase()} to create`);
  if (p.command && type !== "Job" && type !== "CronJob") fail("error: a command after -- is only supported with kubectl create job and create cronjob");
  if (p.from !== undefined && type !== "Job") fail("error: --from is only supported with kubectl create job");
  if (p.schedule !== undefined && type !== "CronJob") fail("error: --schedule is only supported with kubectl create cronjob");
  if (type === "Job") return createJob(c, p, name);
  if (type === "CronJob") return createCronJob(c, p, name);
  if (p.hard !== undefined && type !== "ResourceQuota") fail("error: --hard is only supported with kubectl create quota");
  if (type === "ResourceQuota") return createResource(c, p, { kind: "ResourceQuota", metadata: meta(c, name, p.namespace, {}), hard: parseHardFlag(p.hard) });
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

/** The Job spec `kubectl create job|cronjob` builds: one container named after the object. */
const cliJobSpec = (name: string, image: string, command: string[] | undefined, restartPolicy: "Never" | "OnFailure"): JobSpec => ({
  completions: 1,
  parallelism: 1,
  backoffLimit: 6,
  template: { labels: {}, image, container: { name, ...(command?.length && { command: [...command] }) }, spec: { restartPolicy } },
});

function createJob(c: Cluster, p: Parsed, name: string): string {
  if (p.from === undefined) return createResource(c, p, newJob(c, name, p.namespace, cliJobSpec(name, requireImage(p), p.command, "Never")));
  if (p.image || p.command) fail("error: --from cannot be used together with --image or a command");
  const [kind, cronName, extra] = p.from.split("/");
  if (!["cj", "cronjob", "cronjobs"].includes(kind.toLowerCase()) || !cronName || extra !== undefined) fail(`error: --from must name a cronjob, e.g. --from=cronjob/nightly`);
  requireNamespace(c, p.namespace);
  const cj = find(c, "CronJob", p.namespace, cronName) ?? notFound("CronJob", cronName);
  return createResource(c, p, newJob(c, name, p.namespace, cj.jobTemplate, {}, { "cronjob.kubernetes.io/instantiate": "manual" }, cj.metadata.name));
}

function checkSchedule(name: string, schedule: string, timeZone?: string) {
  const cron = parseCron(schedule);
  if (typeof cron === "string") fail(`The CronJob "${name}" is invalid: spec.schedule: Invalid value: "${schedule}": ${cron}`);
  if (timeZone !== undefined && !validTimeZone(timeZone)) fail(`The CronJob "${name}" is invalid: spec.timeZone: Invalid value: "${timeZone}": unknown time zone ${timeZone}`);
}

function createCronJob(c: Cluster, p: Parsed, name: string): string {
  const image = requireImage(p);
  const schedule = p.schedule ?? fail("error: required flag --schedule not set, e.g. --schedule='*/5 * * * *'");
  checkSchedule(name, schedule);
  return createResource(c, p, {
    kind: "CronJob",
    metadata: meta(c, name, p.namespace, {}),
    schedule,
    suspend: false,
    concurrencyPolicy: "Allow",
    successfulJobsHistoryLimit: 3,
    failedJobsHistoryLimit: 1,
    jobTemplate: cliJobSpec(name, image, p.command, "OnFailure"),
    checkedAt: c.clock,
  });
}

const PATCH_USAGE = `error: the simulator only supports kubectl patch cronjob <name> -p '{"spec":{"suspend":true}}' (or false)`;

function patch(c: Cluster, p: Parsed): string {
  const { type, name } = target(p);
  if (type !== "CronJob" || !name) fail(PATCH_USAGE);
  if (p.patch === undefined) fail("error: must specify --patch or -p, e.g. -p '{\"spec\":{\"suspend\":true}}'");
  let body: unknown;
  try {
    body = JSON.parse(p.patch);
  } catch {
    fail(`error: unable to parse "${p.patch}": the patch must be JSON, e.g. '{"spec":{"suspend":true}}'`);
  }
  const suspend = (body as { spec?: { suspend?: unknown } } | null)?.spec?.suspend;
  if (typeof suspend !== "boolean" || canonical(body) !== canonical({ spec: { suspend } })) fail(PATCH_USAGE);
  requireNamespace(c, p.namespace);
  const cj = find(c, "CronJob", p.namespace, name) ?? notFound("CronJob", name);
  const changed = cj.suspend !== suspend;
  cj.suspend = suspend;
  return `cronjob.batch/${name} patched${changed ? "" : " (no change)"}`;
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
  if (type === "Namespace" || type === "Endpoints" || type === "Event") fail(`error: ${p.verb} ${PLURAL[type]} is not supported in this simulator`);
  if (!name) fail(`error: specify the name of the resource to ${p.verb}`);
  const noun = field === "labels" ? "label" : "annotation";
  if (!changes.length) fail(`error: at least one ${noun} update is required, e.g. key=value or key-`);
  const ns = nsOf(type, p);
  requireNamespace(c, ns);
  const r = find(c, type, ns, name) ?? notFound(type, name);
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
  if (type === "DaemonSet" || type === "StatefulSet") return rolloutSet(c, p, sub, type, name);
  if (type !== "Deployment") fail("error: rollout is only supported for deployments, daemonsets and statefulsets in this simulator");
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
      d.template.annotations = { ...d.template.annotations, [RESTARTED_AT]: timestamp(c.clock) };
      return `${ref} restarted`;
    default: {
      const pause = sub === "pause";
      if (!!d.paused === pause) fail(`error: deployments.apps "${name}" is ${pause ? "already" : "not"} paused`);
      d.paused = pause || undefined;
      return `${ref} ${pause ? "paused" : "resumed"}`;
    }
  }
}

function rolloutSet(c: Cluster, p: Parsed, sub: string, type: "DaemonSet" | "StatefulSet", name?: string): string {
  if (sub !== "status" && sub !== "restart") fail(`error: only kubectl rollout status and rollout restart are supported for ${PLURAL[type]} in this simulator`);
  if (!name) fail(`error: specify the ${type.toLowerCase()}, e.g. kubectl rollout ${sub} ${type.toLowerCase()}/web`);
  if (p.revision !== undefined || p.toRevision !== undefined) fail("error: --revision and --to-revision are only supported for deployments");
  requireNamespace(c, p.namespace);
  const r = find(c, type, p.namespace, name) ?? notFound(type, name);
  if (sub === "status") return setRolloutStatus(c, r).message;
  r.template.annotations = { ...r.template.annotations, [RESTARTED_AT]: timestamp(c.clock) };
  return `${GROUP[type]}/${name} restarted`;
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

type ManifestPodSpec = Extract<Manifest, { kind: "Pod" }>["spec"];
type ManifestContainer = ManifestPodSpec["containers"][number];

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
    case "Node":
      return { taints: r.taints, unschedulable: r.unschedulable };
    case "LimitRange":
      return { limits: r.limits };
    case "ResourceQuota":
      return { hard: r.hard };
    case "Job": {
      const { completions, parallelism, backoffLimit, activeDeadlineSeconds, ttlSecondsAfterFinished, template } = r;
      return { completions, parallelism, backoffLimit, activeDeadlineSeconds, ttlSecondsAfterFinished, template };
    }
    case "CronJob": {
      const { schedule, timeZone, suspend, concurrencyPolicy, successfulJobsHistoryLimit, failedJobsHistoryLimit, jobTemplate } = r;
      return { schedule, timeZone, suspend, concurrencyPolicy, successfulJobsHistoryLimit, failedJobsHistoryLimit, jobTemplate };
    }
    case "DaemonSet":
      return { selector: r.selector, template: r.template, updateStrategy: r.updateStrategy };
    case "StatefulSet": {
      const { serviceName, replicas, selector, template, volumeClaimTemplates, podManagementPolicy } = r;
      return { serviceName, replicas, selector, template, volumeClaimTemplates, podManagementPolicy };
    }
    case "StorageClass":
      return { provisioner: r.provisioner, reclaimPolicy: r.reclaimPolicy, volumeBindingMode: r.volumeBindingMode, allowVolumeExpansion: r.allowVolumeExpansion };
    case "PersistentVolume":
      return { capacity: r.capacity, accessModes: r.accessModes, reclaimPolicy: r.reclaimPolicy, storageClassName: r.storageClassName, hostPath: r.hostPath };
    case "PersistentVolumeClaim":
      return { accessModes: r.accessModes, storage: r.storage, storageClassName: r.storageClassName, defaultedClass: r.defaultedClass };
  }
}

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Why the API server rejects changing `existing` into `r`, or null. */
function immutableChange(c: Cluster, existing: Resource, r: Resource): string | null {
  const name = existing.metadata.name;
  const invalid = (kind: string, rest: string) => `The ${kind} "${name}" is invalid: ${rest}`;
  switch (existing.kind) {
    case "Job": {
      const j = r as Job;
      if (!same(existing.template, j.template)) return invalid("Job", "spec.template: Invalid value: core.PodTemplateSpec{...}: field is immutable");
      if (existing.completions !== j.completions) return invalid("Job", `spec.completions: Invalid value: ${j.completions}: field is immutable`);
      return null;
    }
    case "DaemonSet":
      return same(existing.selector, (r as DaemonSet).selector) ? null : invalid("DaemonSet", "spec.selector: Invalid value: v1.LabelSelector{...}: field is immutable");
    case "StatefulSet": {
      const fixed = (x: StatefulSet) => [x.selector, x.serviceName, x.volumeClaimTemplates, x.podManagementPolicy];
      if (same(fixed(existing), fixed(r as StatefulSet))) return null;
      return invalid("StatefulSet", "spec: Forbidden: updates to statefulset spec for fields other than 'replicas', 'ordinals', 'template', 'updateStrategy', 'persistentVolumeClaimRetentionPolicy' and 'minReadySeconds' are forbidden");
    }
    case "StorageClass": {
      const sc = r as StorageClass;
      const field = (["provisioner", "reclaimPolicy", "volumeBindingMode"] as const).find((f) => existing[f] !== sc[f]);
      return field ? invalid("StorageClass", `${field}: Forbidden: updates to ${field} are forbidden.`) : null;
    }
    case "PersistentVolumeClaim": {
      const pvc = r as PersistentVolumeClaim;
      const fixed = (x: PersistentVolumeClaim) => [x.accessModes, x.storageClassName ?? null];
      if (!same(fixed(existing), fixed(pvc)) || (existing.phase !== "Bound" && existing.storage !== pvc.storage)) {
        return invalid("PersistentVolumeClaim", "spec: Forbidden: spec is immutable after creation except resources.requests and volumeAttributesClassName for bound claims");
      }
      if (existing.storage === pvc.storage) return null;
      if (parseMemory(pvc.storage)! < parseMemory(existing.storage)!) return invalid("PersistentVolumeClaim", "spec.resources.requests.storage: Forbidden: field can not be less than previous value");
      const sc = existing.storageClassName ? find(c, "StorageClass", "", existing.storageClassName) : undefined;
      const pv = existing.volumeName ? find(c, "PersistentVolume", "", existing.volumeName) : undefined;
      if (!sc?.allowVolumeExpansion || !pv?.metadata.annotations["pv.kubernetes.io/provisioned-by"]) {
        return `Error from server (Forbidden): persistentvolumeclaims "${name}" is forbidden: only dynamically provisioned pvc can be resized and the storageclass that provisions the pvc must support resize`;
      }
      return null;
    }
    default:
      return null;
  }
}

const compared = (r: Resource) => ({ labels: r.metadata.labels, annotations: userAnnotations(r.metadata.annotations), ...applied(r) });

// shortcut: only the first container is modelled; further containers and resources are validated but ignored.
function toContainer(m: ManifestContainer): Container {
  const { name, command, args, ports, env, envFrom, readinessProbe, livenessProbe, startupProbe, resources, volumeMounts } = m;
  return withDefaultRequests(structuredClone({ name, command, args, ports, env, envFrom, readinessProbe, livenessProbe, startupProbe, resources, volumeMounts }));
}

/** The modelled pod-level fields, or undefined when none is set (keeps template hashes stable). */
function toPodSpec(m: ManifestPodSpec): PodSpec | undefined {
  const { nodeName, nodeSelector, tolerations, affinity, volumes, serviceAccountName } = m;
  // Always is the default; leaving it out keeps the hashes of existing templates.
  const restartPolicy = m.restartPolicy === "Always" ? undefined : m.restartPolicy;
  const fields = { restartPolicy, volumes, serviceAccountName, nodeName, nodeSelector, tolerations, affinity };
  const spec = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return Object.keys(spec).length ? structuredClone(spec) : undefined;
}

type ManifestTemplate = { metadata?: { labels?: Labels; annotations?: Labels }; spec: ManifestPodSpec };

function toTemplate(t: ManifestTemplate): PodTemplate {
  const template: PodTemplate = {
    labels: { ...t.metadata?.labels },
    ...(t.metadata?.annotations && { annotations: { ...t.metadata.annotations } }),
    image: t.spec.containers[0].image,
    container: toContainer(t.spec.containers[0]),
  };
  const spec = toPodSpec(t.spec);
  if (spec) template.spec = spec;
  return template;
}

/** Every volumeMount must name a Pod volume (or, in a StatefulSet, a claim template). */
function checkMounts(kind: string, name: string, spec: ManifestPodSpec, path: string, extra: string[] = []) {
  const names = new Set([...(spec.volumes ?? []).map((v) => v.name), ...extra]);
  spec.containers.forEach((ctr, i) =>
    ctr.volumeMounts?.forEach((m, j) => {
      if (!names.has(m.name)) fail(`The ${kind} "${name}" is invalid: ${path}containers[${i}].volumeMounts[${j}].name: Not found: "${m.name}"`);
    }),
  );
}

type ManifestJobSpec = Extract<Manifest, { kind: "Job" }>["spec"];
const MAX_COMPLETIONS = 100;

function toJobSpec(kind: string, name: string, s: ManifestJobSpec, path: string): JobSpec {
  const policy = s.template.spec.restartPolicy;
  if (policy !== "Never" && policy !== "OnFailure") {
    const why = policy ? `Unsupported value: "${policy}": supported values: "OnFailure", "Never"` : `Required value: valid values: "OnFailure", "Never"`;
    fail(`The ${kind} "${name}" is invalid: ${path}template.spec.restartPolicy: ${why}`);
  }
  checkMounts(kind, name, s.template.spec, `${path}template.spec.`);
  if ((s.parallelism ?? 1) > MAX_REPLICAS) fail(`error: this simulator supports a parallelism of at most ${MAX_REPLICAS}`);
  if ((s.completions ?? 1) > MAX_COMPLETIONS) fail(`error: this simulator supports at most ${MAX_COMPLETIONS} completions`);
  return {
    completions: s.completions ?? 1,
    parallelism: s.parallelism ?? 1,
    backoffLimit: s.backoffLimit ?? 6,
    activeDeadlineSeconds: s.activeDeadlineSeconds,
    ttlSecondsAfterFinished: s.ttlSecondsAfterFinished,
    template: toTemplate(s.template),
  };
}

function toNode(c: Cluster, m: Extract<Manifest, { kind: "Node" }>): Node {
  const n = workerNode(c, m.metadata.name);
  n.metadata = meta(c, m.metadata.name, "", { ...n.metadata.labels, ...m.metadata.labels }, m.metadata.annotations);
  n.taints = structuredClone(m.spec?.taints ?? []);
  n.unschedulable = m.spec?.unschedulable ?? false;
  return n;
}

const namespaceOf = (m: Exclude<Manifest, { kind: "Namespace" }>, fallback: string) =>
  CLUSTER_SCOPED.has(m.kind) ? "" : ((m.metadata as { namespace?: string }).namespace ?? fallback);

function toResource(c: Cluster, m: Exclude<Manifest, { kind: "Namespace" }>, namespace: string): Resource {
  const labels = m.metadata.labels ?? {};
  const annotations = m.metadata.annotations ?? {};
  const metadata = () => meta(c, m.metadata.name, namespace, labels, annotations);
  switch (m.kind) {
    case "Pod": {
      const [first] = m.spec.containers;
      checkMounts("Pod", m.metadata.name, m.spec, "spec.");
      const spec = toPodSpec(m.spec);
      const pod = newPod(c, m.metadata.name, namespace, { labels, annotations, image: first.image, container: toContainer(first), ...(spec && { spec }) });
      pod.specKey = podSpecKey(m.spec);
      return pod;
    }
    case "Node":
      return toNode(c, m);
    case "LimitRange":
      return { kind: "LimitRange", metadata: meta(c, m.metadata.name, namespace, labels, annotations), limits: m.spec.limits.map((l) => defaultLimitRangeItem(structuredClone(l))) };
    case "ResourceQuota":
      return { kind: "ResourceQuota", metadata: meta(c, m.metadata.name, namespace, labels, annotations), hard: { ...m.spec.hard } };
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
    case "Job":
      return newJob(c, m.metadata.name, namespace, toJobSpec("Job", m.metadata.name, m.spec, "spec."), labels, annotations);
    case "CronJob": {
      const s = m.spec;
      checkSchedule(m.metadata.name, s.schedule, s.timeZone);
      return {
        kind: "CronJob",
        metadata: metadata(),
        schedule: s.schedule,
        ...(s.timeZone !== undefined && { timeZone: s.timeZone }),
        suspend: s.suspend ?? false,
        concurrencyPolicy: s.concurrencyPolicy ?? "Allow",
        successfulJobsHistoryLimit: s.successfulJobsHistoryLimit ?? 3,
        failedJobsHistoryLimit: s.failedJobsHistoryLimit ?? 1,
        jobTemplate: toJobSpec("CronJob", m.metadata.name, s.jobTemplate.spec, "spec.jobTemplate.spec."),
        checkedAt: c.clock,
      };
    }
    case "DaemonSet": {
      const s = m.spec;
      checkMounts("DaemonSet", m.metadata.name, s.template.spec, "spec.template.spec.");
      const strategy = s.updateStrategy;
      return {
        kind: "DaemonSet",
        metadata: metadata(),
        selector: { ...s.selector.matchLabels },
        template: toTemplate(s.template),
        updateStrategy: { type: strategy?.type ?? "RollingUpdate", maxUnavailable: strategy?.rollingUpdate?.maxUnavailable ?? 1 },
      };
    }
    case "StatefulSet": {
      const s = m.spec;
      if ((s.replicas ?? 1) > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
      const claims = (s.volumeClaimTemplates ?? []).map((t) => ({
        name: t.metadata.name,
        ...(t.metadata.labels && { labels: { ...t.metadata.labels } }),
        accessModes: [...t.spec.accessModes],
        storage: t.spec.resources.requests.storage,
        ...(t.spec.storageClassName !== undefined && { storageClassName: t.spec.storageClassName }),
      }));
      checkMounts("StatefulSet", m.metadata.name, s.template.spec, "spec.template.spec.", claims.map((x) => x.name));
      return {
        kind: "StatefulSet",
        metadata: metadata(),
        serviceName: s.serviceName ?? "",
        replicas: s.replicas ?? 1,
        selector: { ...s.selector.matchLabels },
        template: toTemplate(s.template),
        volumeClaimTemplates: claims,
        podManagementPolicy: s.podManagementPolicy ?? "OrderedReady",
      };
    }
    case "StorageClass":
      return {
        kind: "StorageClass",
        metadata: metadata(),
        provisioner: m.provisioner,
        reclaimPolicy: m.reclaimPolicy ?? "Delete",
        volumeBindingMode: m.volumeBindingMode ?? "Immediate",
        allowVolumeExpansion: m.allowVolumeExpansion ?? false,
      };
    case "PersistentVolume":
      return {
        kind: "PersistentVolume",
        metadata: metadata(),
        capacity: m.spec.capacity.storage,
        accessModes: [...m.spec.accessModes],
        reclaimPolicy: m.spec.persistentVolumeReclaimPolicy ?? "Retain",
        storageClassName: m.spec.storageClassName ?? "",
        hostPath: { path: m.spec.hostPath.path },
        phase: "Available",
      };
    case "PersistentVolumeClaim":
      return {
        kind: "PersistentVolumeClaim",
        metadata: metadata(),
        accessModes: [...m.spec.accessModes],
        storage: m.spec.resources.requests.storage,
        ...claimClass(c, m.spec.storageClassName),
        phase: "Pending",
      };
  }
  if (m.spec.replicas > MAX_REPLICAS) fail(`error: this simulator supports at most ${MAX_REPLICAS} replicas`);
  checkMounts(m.kind, m.metadata.name, m.spec.template.spec, "spec.template.spec.");
  const base = { metadata: metadata(), replicas: m.spec.replicas, selector: { ...m.spec.selector.matchLabels }, template: toTemplate(m.spec.template) };
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
  else if (s.clusterIP !== "None" && list(c, "Service").some((x) => x.clusterIP === s.clusterIP)) {
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
    const r = toResource(draft, m, namespaceOf(m, p.namespace));
    const { name, namespace } = r.metadata;
    requireNamespace(draft, namespace);
    const existing = find(draft, r.kind, namespace, name);
    if (r.kind === "Service") assignServiceFields(draft, r, existing as Service | undefined);
    // Node labels set by the kubelet stay, like a three-way merge would keep them.
    if (r.kind === "Node" && existing) r.metadata.labels = { ...existing.metadata.labels, ...m.metadata.labels };
    let result = "created";
    if (!existing) {
      const denied = p.dryRun ? null : admit(draft, r);
      if (denied) fail(`Error from server (Forbidden): error when creating "${p.filename}": ${apiName(r.kind)} "${name}" is forbidden: ${denied}`);
      addResource(draft, r);
    } else if (canonical(compared(existing)) === canonical(compared(r))) {
      result = "unchanged";
    } else {
      if (existing.kind === "Pod" && specKeyOf(existing) !== specKeyOf(r as Pod)) {
        fail(`The Pod "${name}" is invalid: spec: Forbidden: pod updates may not change fields other than \`spec.containers[*].image\``);
      }
      if (existing.kind === "PersistentVolumeClaim" && (r as PersistentVolumeClaim).defaultedClass && existing.defaultedClass) {
        // An omitted class keeps the defaulted one, as kubectl's three-way merge would.
        (r as PersistentVolumeClaim).storageClassName = existing.storageClassName;
      }
      const rejected = immutableChange(draft, existing, r);
      if (rejected) fail(rejected);
      if (existing.kind === "Pod" && existing.image !== (r as Pod).image) existing.status = "ContainerCreating";
      const managed = Object.fromEntries(Object.entries(existing.metadata.annotations).filter(([k]) => k.startsWith(MANAGED_PREFIX)));
      existing.metadata.labels = r.metadata.labels;
      existing.metadata.annotations = { ...managed, ...r.metadata.annotations };
      Object.assign(existing, applied(r));
      if (existing.kind === "PersistentVolumeClaim" && existing.volumeName) {
        // The resizer grows the volume to the new request.
        const pv = find(draft, "PersistentVolume", "", existing.volumeName);
        if (pv) pv.capacity = existing.storage;
      }
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
          : deleteResource(c, m.kind, namespaceOf(m, p.namespace), m.metadata.name),
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
  if (p.allNamespaces) only(p.verb === "get" || p.verb === "top", "-A is only supported with kubectl get and top");
  if (p.selector) only(p.verb === "get", "-l is only supported with kubectl get");
  if (p.showLabels) only(p.verb === "get", "--show-labels is only supported with kubectl get");
  if (p.dryRun) only(["create", "run", "expose", "apply"].includes(p.verb), "--dry-run=client is only supported with kubectl create, run, expose and apply");
  if (p.output === "wide") only(p.verb === "get", "-o wide is only supported with kubectl get");
  if (p.output) only(p.verb === "get" || p.dryRun, "-o is only supported with kubectl get, or together with --dry-run=client");
  if (p.replicas !== undefined) only(p.verb === "scale" || p.verb === "create", "--replicas is only supported with kubectl scale and create deployment");
  if (p.image) only(p.verb === "create" || p.verb === "run", "--image is only supported with kubectl create deployment, job, cronjob and run");
  if (p.filename) only(p.verb === "apply" || p.verb === "delete", "-f is only supported with kubectl apply and delete");
  if (p.port || p.targetPort || p.type || p.name) only(p.verb === "expose", "--port, --target-port, --type and --name are only supported with kubectl expose");
  if (p.tcp.length) only(p.verb === "create", "--tcp is only supported with kubectl create service");
  if (p.literals.length) only(p.verb === "create", "--from-literal is only supported with kubectl create configmap and create secret generic");
  if (p.overwrite) only(["label", "annotate", "taint"].includes(p.verb), "--overwrite is only supported with kubectl label, annotate and taint");
  if (p.container !== undefined) only(p.verb === "logs" || p.verb === "exec", "-c is only supported with kubectl logs and exec");
  if (p.previous || p.tail !== undefined) only(p.verb === "logs", "--previous and --tail are only supported with kubectl logs");
  if (p.command) only(p.verb === "exec" || p.verb === "create", "a command after -- is only supported with kubectl exec, create job and create cronjob");
  if (p.schedule !== undefined || p.from !== undefined) only(p.verb === "create", "--schedule and --from are only supported with kubectl create cronjob and create job");
  if (p.patch !== undefined) only(p.verb === "patch", "-p is only supported with kubectl patch, or as --previous with kubectl logs");
  if (p.fieldSelector) only(p.verb === "get", "--field-selector is only supported with kubectl get events");
  if (p.force || p.ignoreDaemonsets || p.deleteEmptydirData) only(p.verb === "drain", "--force, --ignore-daemonsets and --delete-emptydir-data are only supported with kubectl drain");
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
    case "taint":
      return taint(c, p);
    case "cordon":
    case "uncordon":
      return cordon(c, p, p.verb === "cordon");
    case "drain":
      return drain(c, p);
    case "top":
      return top(c, p);
    case "logs":
      return logs(c, p);
    case "exec":
      return exec(c, p);
    case "patch":
      return patch(c, p);
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
