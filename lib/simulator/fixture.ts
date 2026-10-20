import { containerName, converge, crashes, defaultNodes, list, meta } from "./cluster";
import { defaultIngressClass } from "./ingress";
import { run } from "./kubectl";
import { builtinRbac } from "./rbac";
import { defaultStorageClass } from "./storage";
import type { Cluster, Fixture, Labels } from "./types";

const FIXTURE_AGE = 600;
// About how often a crashing container has restarted after 10 minutes of back-off.
const AGED_RESTARTS = 6;

const template = (labels: Labels, image: string) => ({ labels: { ...labels }, image, container: { name: containerName(image) } });

export function createCluster(fixture: Fixture = {}): Cluster {
  let c: Cluster = {
    clock: -FIXTURE_AGE,
    seq: 1,
    nodes: [],
    namespaces: ["default", "kube-system", ...(fixture.namespaces ?? [])],
    namespaceLabels: {},
    resources: [],
    events: [],
    files: { ...fixture.files },
    volumes: {},
    connections: {},
  };
  c.nodes = defaultNodes(c);
  c.resources.push(defaultStorageClass(c), defaultIngressClass(c), ...builtinRbac(c));
  const ns = (n?: string) => n ?? "default";
  for (const d of fixture.deployments ?? []) {
    c.resources.push({
      kind: "Deployment",
      metadata: meta(c, d.name, ns(d.namespace), d.labels),
      replicas: d.replicas,
      selector: { ...d.labels },
      template: template(d.labels, d.image),
      strategy: { type: "RollingUpdate", maxSurge: "25%", maxUnavailable: "25%" },
    });
  }
  for (const r of fixture.replicaSets ?? []) {
    c.resources.push({
      kind: "ReplicaSet",
      metadata: meta(c, r.name, ns(r.namespace), r.labels),
      replicas: r.replicas,
      selector: { ...r.labels },
      template: template(r.labels, r.image),
    });
  }
  for (const p of fixture.pods ?? []) {
    c.resources.push({
      kind: "Pod",
      metadata: meta(c, p.name, ns(p.namespace), p.labels ?? {}),
      image: p.image,
      container: { name: containerName(p.image) },
      node: "",
      status: p.status ?? "ContainerCreating",
      ready: p.status === "Running",
      restarts: p.restarts ?? 0,
    });
  }
  converge(c);
  for (const file of fixture.apply ?? []) {
    if (!Object.hasOwn(c.files, file)) throw new Error(`fixture.apply: no file "${file}" in fixture.files`);
    const r = run(c, `kubectl apply -f ${file}`);
    if (r.error) throw new Error(`fixture.apply ${file}: ${r.output}`);
    c = r.cluster;
    converge(c);
  }
  for (const p of list(c, "Pod")) {
    if ((p.status === "Running" || p.status === "CrashLoopBackOff" || p.status === "OOMKilled") && crashes(c, p)) {
      p.restarts = Math.max(p.restarts, AGED_RESTARTS);
      p.status = "CrashLoopBackOff";
    }
  }
  c.clock = 0;
  return c;
}
