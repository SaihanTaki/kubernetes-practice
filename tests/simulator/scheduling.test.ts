import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, find, list, run, type Cluster, type Fixture } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const web = (extra: Fixture = {}) =>
  createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }], ...extra });

/** A Pod manifest with extra lines under spec (indented by 2). */
const pod = (name: string, spec = "", labels = `app: ${name}`) => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  labels:
    ${labels}
spec:
${spec ? `${spec.replace(/^/gm, "  ")}\n` : ""}  containers:
    - name: ${name}
      image: nginx:1.27
`;

const applied = (yaml: string, c: Cluster = createCluster()) =>
  exec({ ...c, files: { ...c.files, "p.yaml": yaml } }, "kubectl apply -f p.yaml");

const nodeOf = (c: Cluster, name: string) => find(c, "Pod", "default", name)!.node;

describe("nodes", () => {
  it("lists the three nodes with roles, and wide columns", () => {
    const out = exec(web(), "kubectl get nodes").output;
    expect(out).toMatch(/^NAME\s+STATUS\s+ROLES\s+AGE\s+VERSION$/m);
    expect(out).toMatch(/^control-plane\s+Ready\s+control-plane\s+10m\s+v1\.33\.0$/m);
    expect(out).toMatch(/^worker-2\s+Ready\s+<none>/m);
    const wide = exec(web(), "kubectl get nodes -o wide").output;
    expect(wide.split("\n")[0]).toMatch(/VERSION\s+INTERNAL-IP\s+EXTERNAL-IP\s+OS-IMAGE\s+KERNEL-VERSION\s+CONTAINER-RUNTIME$/);
    expect(wide).toMatch(/worker-1 .*172\.18\.0\.3/);
  });

  it("is cluster-scoped: ignores -n and adds no NAMESPACE column", () => {
    expect(exec(web(), "kubectl get nodes -n nowhere").output).toContain("worker-1");
    expect(exec(web(), "kubectl get nodes -A").output.split("\n")[0]).toMatch(/^NAME/);
    expect(exec(web(), "kubectl describe node worker-1 -n other").error).toBe(false);
  });

  it("has the documented labels, taint and allocatable", () => {
    const out = exec(web(), "kubectl get nodes --show-labels").output;
    expect(out).toMatch(/worker-2 .*kubernetes\.io\/hostname=worker-2,kubernetes\.io\/os=linux,topology\.kubernetes\.io\/zone=zone-b$/m);
    expect(out).toMatch(/control-plane .*node-role\.kubernetes\.io\/control-plane=$/m);
    expect(exec(web(), "kubectl get nodes -l topology.kubernetes.io/zone=zone-a").output.split("\n")).toHaveLength(3);
    const yaml = parseYaml(exec(web(), "kubectl get node control-plane -o yaml").output);
    expect(yaml.spec.taints).toEqual([{ key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule" }]);
    expect(yaml.status.allocatable).toEqual({ cpu: "2", memory: "2Gi", pods: "110" });
    expect(yaml.metadata.namespace).toBeUndefined();
  });

  it("describes a node with its Pods and allocated resources", () => {
    const yaml = pod("big", "", "app: big").replace("image: nginx:1.27", "image: nginx:1.27\n      resources:\n        requests:\n          cpu: 500m\n          memory: 1Gi");
    const r = exec(applied(yaml).c, "kubectl get pods");
    const node = nodeOf(r.c, "big");
    const out = exec(r.c, `kubectl describe node ${node}`).output;
    expect(out).toMatch(/^Taints:\s+<none>$/m);
    expect(out).toMatch(/^Unschedulable:\s+false$/m);
    expect(out).toMatch(/^ {2}memory:\s+4Gi$/m);
    expect(out).toMatch(/default\s+big\s+500m \(25%\)\s+0 \(0%\)\s+1Gi \(25%\)\s+0 \(0%\)/);
    expect(out).toMatch(/^ {2}cpu\s+500m \(25%\)\s+0 \(0%\)$/m);
    expect(exec(r.c, "kubectl describe node control-plane").output).toMatch(/^Taints:\s+node-role\.kubernetes\.io\/control-plane:NoSchedule$/m);
    expect(exec(r.c, "kubectl describe node nope").output).toBe('Error from server (NotFound): nodes "nope" not found');
  });

  it("labels, annotates and deletes nodes", () => {
    let r = exec(web(), "kubectl label node worker-2 disk=ssd");
    expect(r.output).toBe("node/worker-2 labeled");
    expect(find(r.c, "Node", "", "worker-2")!.metadata.labels.disk).toBe("ssd");
    r = exec(r.c, "kubectl annotate nodes worker-2 owner=ops");
    expect(r.output).toBe("node/worker-2 annotated");
    r = exec(r.c, "kubectl delete node worker-2");
    expect(r.output).toBe('node "worker-2" deleted');
    r = exec(r.c, "kubectl get pods -o wide");
    expect(list(r.c, "Pod").every((p) => p.node === "worker-1")).toBe(true);
  });

  it("applies and deletes Node manifests", () => {
    const node = `apiVersion: v1
kind: Node
metadata:
  name: worker-3
  labels:
    disk: ssd
spec:
  taints:
    - key: gpu
      value: "true"
      effect: NoSchedule
`;
    let r = applied(node);
    expect(r.output).toBe("node/worker-3 created");
    const n = find(r.c, "Node", "", "worker-3")!;
    expect(n.metadata.labels).toMatchObject({ disk: "ssd", "kubernetes.io/hostname": "worker-3" });
    expect(n.taints).toEqual([{ key: "gpu", value: "true", effect: "NoSchedule" }]);
    r = exec({ ...r.c, files: { "n.yaml": node.replace("disk: ssd", "disk: hdd") } }, "kubectl apply -f n.yaml");
    expect(r.output).toBe("node/worker-3 configured");
    expect(find(r.c, "Node", "", "worker-3")!.metadata.labels["kubernetes.io/hostname"]).toBe("worker-3");
    expect(exec(r.c, "kubectl delete -f n.yaml").output).toBe('node "worker-3" deleted');
  });
});

describe("taints and cordon", () => {
  it("adds, overwrites and removes taints with real messages", () => {
    let r = exec(web(), "kubectl taint nodes worker-1 dedicated=batch:NoSchedule");
    expect(r.output).toBe("node/worker-1 tainted");
    expect(exec(r.c, "kubectl taint nodes worker-1 dedicated=other:NoSchedule").output).toBe(
      "error: node worker-1 already has dedicated taint(s) with same effect(s) and --overwrite is false",
    );
    r = exec(r.c, "kubectl taint nodes worker-1 dedicated=other:NoSchedule --overwrite");
    expect(find(r.c, "Node", "", "worker-1")!.taints).toEqual([{ key: "dedicated", value: "other", effect: "NoSchedule" }]);
    r = exec(r.c, "kubectl taint node worker-1 dedicated:NoSchedule-");
    expect(r.output).toBe("node/worker-1 untainted");
    expect(exec(r.c, "kubectl taint nodes worker-1 dedicated-").output).toBe('error: taint "dedicated" not found');
    r = exec(r.c, "kubectl taint nodes worker-1 a:PreferNoSchedule b=1:NoSchedule", "kubectl taint nodes worker-1 a- c:NoSchedule");
    expect(r.output).toBe("node/worker-1 modified");
  });

  it.each([
    ["kubectl taint nodes worker-1 k=v:Bogus", "error: invalid taint effect: Bogus, unsupported taint effect"],
    ["kubectl taint nodes worker-1 k=v", "error: invalid taint spec: k=v"],
    ["kubectl taint nodes worker-1 'bad key=v:NoSchedule'", "error: invalid taint spec"],
    ["kubectl taint nodes nope k=v:NoSchedule", 'Error from server (NotFound): nodes "nope" not found'],
    ["kubectl taint pods web k=v:NoSchedule", "error: use kubectl taint nodes"],
    ["kubectl taint nodes worker-1", "error: at least one taint update is required"],
  ])("rejects %s", (cmd, message) => {
    const r = exec(web(), cmd);
    expect(r.error).toBe(true);
    expect(r.output).toContain(message);
  });

  it("keeps new Pods off a NoSchedule node", () => {
    const r = exec(web(), "kubectl taint nodes worker-1 dedicated=batch:NoSchedule", "kubectl scale deploy web --replicas=4");
    const fresh = list(r.c, "Pod").slice(2);
    expect(fresh.map((p) => p.node)).toEqual(["worker-2", "worker-2"]);
  });

  it("evicts Pods that do not tolerate a NoExecute taint, and controllers replace them", () => {
    const before = list(web(), "Pod");
    expect(before.map((p) => p.node).sort()).toEqual(["worker-1", "worker-2"]);
    const r = exec(web(), "kubectl taint nodes worker-1 maintenance=now:NoExecute");
    const pods = list(r.c, "Pod");
    expect(pods).toHaveLength(2);
    expect(pods.every((p) => p.node === "worker-2")).toBe(true);
    expect(exec(r.c, "kubectl get events").output).toMatch(/TaintManagerEviction\s+pod\/web-\S+\s+Marking for deletion Pod default\/web-/);
  });

  it("cordons and uncordons", () => {
    let r = exec(web(), "kubectl cordon worker-2");
    expect(r.output).toBe("node/worker-2 cordoned");
    expect(exec(r.c, "kubectl get nodes").output).toMatch(/^worker-2\s+Ready,SchedulingDisabled\s/m);
    expect(exec(r.c, "kubectl cordon worker-2").output).toBe("node/worker-2 already cordoned");
    expect(exec(r.c, "kubectl describe node worker-2").output).toMatch(/^Taints:\s+node\.kubernetes\.io\/unschedulable:NoSchedule\nUnschedulable:\s+true$/m);
    r = exec(r.c, "kubectl scale deploy web --replicas=4");
    expect(list(r.c, "Pod").slice(2).every((p) => p.node === "worker-1")).toBe(true);
    r = exec(r.c, "kubectl uncordon node/worker-2");
    expect(r.output).toBe("node/worker-2 uncordoned");
    expect(exec(r.c, "kubectl uncordon worker-2").output).toBe("node/worker-2 already uncordoned");
    expect(exec(r.c, "kubectl get events").output).toMatch(/NodeNotSchedulable\s+node\/worker-2\s+Node worker-2 status is now: NodeNotSchedulable/);
  });
});

describe("drain", () => {
  const mixed = () => web({ pods: [{ name: "solo", image: "busybox" }] });
  const soloNode = (c: Cluster) => nodeOf(c, "solo");

  it("refuses unmanaged Pods without --force but stays cordoned", () => {
    const c = mixed();
    const node = soloNode(c);
    const r = exec(c, `kubectl drain ${node}`);
    expect(r.error).toBe(true);
    expect(r.output).toBe(
      [
        `node/${node} cordoned`,
        `error: unable to drain node "${node}" due to error: cannot delete Pods that declare no controller (use --force to override): default/solo, continuing command...`,
        "There are pending nodes to be drained:",
        ` ${node}`,
        "error: cannot delete Pods that declare no controller (use --force to override): default/solo",
      ].join("\n"),
    );
    expect(find(r.c, "Node", "", node)!.unschedulable).toBe(true);
    expect(find(r.c, "Pod", "default", "solo")).toBeDefined();
  });

  it("evicts everything with --force, and controllers reschedule elsewhere", () => {
    const c = mixed();
    const node = soloNode(c);
    const r = exec(c, `kubectl drain ${node} --force --ignore-daemonsets`);
    expect(r.error).toBe(false);
    expect(r.output).toContain("node/" + node + " cordoned\nWarning: deleting Pods that declare no controller: default/solo\nevicting pod default/solo");
    expect(r.output).toMatch(/pod\/solo evicted/);
    expect(r.output.endsWith(`node/${node} drained`)).toBe(true);
    expect(find(r.c, "Pod", "default", "solo")).toBeUndefined();
    expect(list(r.c, "Pod").every((p) => p.node !== node)).toBe(true);
    expect(list(r.c, "Pod")).toHaveLength(2);
  });

  it("refuses DaemonSet Pods without --ignore-daemonsets and leaves them with it", () => {
    const c = web();
    const victim = list(c, "Pod").find((p) => p.node === "worker-1")!;
    // DaemonSets arrive in Part B; fake an owner kind to exercise the check.
    Object.assign(victim, { ownerKind: "DaemonSet", owner: "agent" });
    const name = victim.metadata.name;
    const r = exec(c, "kubectl drain worker-1");
    expect(r.error).toBe(true);
    expect(r.output).toContain(`cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore): default/${name}`);
    const ok = run(c, "kubectl drain worker-1 --ignore-daemonsets");
    expect(ok.output).toContain(`Warning: ignoring DaemonSet-managed Pods: default/${name}`);
    expect(ok.output).not.toContain(`evicting pod default/${name}`);
  });

  it("validates arguments", () => {
    expect(exec(web(), "kubectl drain").error).toBe(true);
    expect(exec(web(), "kubectl drain nope").output).toBe('Error from server (NotFound): nodes "nope" not found');
    expect(exec(web(), "kubectl get pods --force").output).toContain("only supported with kubectl drain");
  });
});

describe("scheduler", () => {
  it("leaves a Pod Pending with a FailedScheduling event, and retries after every command", () => {
    let r = applied(pod("fast", "nodeSelector:\n  disk: ssd"));
    expect(find(r.c, "Pod", "default", "fast")).toMatchObject({ status: "Pending", node: "" });
    expect(exec(r.c, "kubectl get pods").output).toMatch(/fast\s+0\/1\s+Pending\s+0/);
    const described = exec(r.c, "kubectl describe pod fast").output;
    expect(described).toMatch(/^Node:\s+<none>$/m);
    expect(described).toContain(
      "default-scheduler   0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 node(s) didn't match Pod's node affinity/selector. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.",
    );
    r = exec(r.c, "kubectl get pods", "kubectl describe pod fast");
    expect(r.output).toMatch(/FailedScheduling\s+0s \(x\d over \d+s\)/);
    r = exec(r.c, "kubectl label node worker-2 disk=ssd");
    expect(find(r.c, "Pod", "default", "fast")).toMatchObject({ status: "ContainerCreating", node: "worker-2" });
    r = exec(r.c, "kubectl get pods");
    expect(find(r.c, "Pod", "default", "fast")!.status).toBe("Running");
    expect(exec(r.c, "kubectl describe pod fast").output).toContain("Successfully assigned default/fast to worker-2");
  });

  it("counts Insufficient resources per node and sorts the reasons", () => {
    const big = pod("big").replace("image: nginx:1.27", "image: nginx:1.27\n      resources:\n        requests:\n          memory: 5Gi");
    const r = exec(applied(big).c, "kubectl describe pod big");
    expect(r.output).toContain(
      "0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory. preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod.",
    );
  });

  it("sums requests of Pods already on the node", () => {
    const deploy = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api:1.1
          resources:
            requests:
              memory: 3Gi
              cpu: "1"
`;
    const r = exec(applied(deploy).c, "kubectl get pods");
    const pods = list(r.c, "Pod");
    expect(pods.map((p) => p.node).sort()).toEqual(["", "worker-1", "worker-2"]);
    expect(pods.filter((p) => p.status === "Pending")).toHaveLength(1);
  });

  it("matches tolerations: Equal, Exists, and empty effect", () => {
    const onControlPlane = (tolerations: string) =>
      nodeOf(applied(pod("x", `nodeSelector:\n  node-role.kubernetes.io/control-plane: ""\ntolerations:\n${tolerations}`)).c, "x");
    expect(onControlPlane("  - key: node-role.kubernetes.io/control-plane\n    operator: Exists\n    effect: NoSchedule")).toBe("control-plane");
    expect(onControlPlane("  - key: node-role.kubernetes.io/control-plane\n    operator: Exists")).toBe("control-plane");
    expect(onControlPlane("  - operator: Exists")).toBe("control-plane");
    expect(onControlPlane("  - key: node-role.kubernetes.io/control-plane\n    operator: Equal\n    value: \"\"\n    effect: NoSchedule")).toBe("control-plane");
    expect(onControlPlane("  - key: node-role.kubernetes.io/control-plane\n    operator: Exists\n    effect: NoExecute")).toBe("");
    expect(onControlPlane("  - key: other\n    operator: Exists")).toBe("");
  });

  it("ignores PreferNoSchedule when filtering", () => {
    let c = exec(createCluster(), "kubectl taint nodes worker-1 soft=yes:PreferNoSchedule", "kubectl taint nodes worker-2 hard=yes:NoSchedule").c;
    c = applied(pod("x"), c).c;
    expect(nodeOf(c, "x")).toBe("worker-1");
  });

  it("supports required node affinity operators", () => {
    const affinity = (expr: string) => `affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
${expr.replace(/^/gm, "            ")}`;
    const place = (expr: string) => nodeOf(applied(pod("x", affinity(expr))).c, "x");
    expect(place("- key: topology.kubernetes.io/zone\n  operator: In\n  values: [zone-b]")).toBe("worker-2");
    expect(place("- key: kubernetes.io/hostname\n  operator: NotIn\n  values: [worker-1]")).toBe("worker-2");
    expect(place("- key: node-role.kubernetes.io/control-plane\n  operator: DoesNotExist\n- key: kubernetes.io/hostname\n  operator: In\n  values: [worker-1]")).toBe("worker-1");
    expect(place("- key: disk\n  operator: Exists")).toBe("");
  });

  it("scores preferred node affinity before spreading", () => {
    const yaml = pod("x", `affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 10
        preference:
          matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values: [worker-1]
      - weight: 50
        preference:
          matchExpressions:
            - key: topology.kubernetes.io/zone
              operator: In
              values: [zone-b]`);
    expect(nodeOf(applied(yaml).c, "x")).toBe("worker-2");
  });

  it("spreads to the worker with fewest Pods, ties by name", () => {
    const c = createCluster({ deployments: [{ name: "web", replicas: 3, image: "nginx", labels: { app: "web" } }] });
    expect(list(c, "Pod").map((p) => p.node)).toEqual(["worker-1", "worker-2", "worker-1"]);
  });

  it("honours required pod anti-affinity per hostname and per zone", () => {
    const deploy = (topologyKey: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      tolerations:
        - operator: Exists
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: api
              topologyKey: ${topologyKey}
      containers:
        - name: api
          image: example/api:1.1
`;
    // The Pods tolerate every taint, so all three nodes are candidates.
    const byHost = list(applied(deploy("kubernetes.io/hostname")).c, "Pod");
    expect(byHost.map((p) => p.node).sort()).toEqual(["control-plane", "worker-1", "worker-2"]);
    // worker-1 and the control plane share zone-a; worker-2 is zone-b.
    const byZone = applied(deploy("topology.kubernetes.io/zone")).c;
    expect(list(byZone, "Pod").map((p) => p.node).sort()).toEqual(["", "control-plane", "worker-2"]);
    const pending = list(byZone, "Pod").find((p) => !p.node)!;
    expect(exec(byZone, `kubectl describe pod ${pending.metadata.name}`).output).toContain(
      "0/3 nodes are available: 3 node(s) didn't match pod anti-affinity rules.",
    );
  });

  it("binds spec.nodeName directly, skipping taints", () => {
    const r = applied(pod("pinned", "nodeName: control-plane"));
    expect(nodeOf(r.c, "pinned")).toBe("control-plane");
    expect(exec(r.c, "kubectl get pods").output).not.toContain("FailedScheduling");
    expect(nodeOf(applied(pod("lost", "nodeName: worker-9")).c, "lost")).toBe("");
  });

  it("gives Pods IPs from their node's range", () => {
    const r = exec(applied(pod("pinned", "nodeName: control-plane")).c, "kubectl get pods", "kubectl get pods -o wide");
    expect(r.output).toMatch(/pinned\s+1\/1\s+Running\s+0\s+\S+\s+10\.244\.0\.\d+\s+control-plane/);
  });

  it("rejects invalid scheduling fields on apply", () => {
    const bad = (spec: string) => applied(pod("x", spec));
    expect(bad("tolerations:\n  - key: a\n    operator: Exists\n    value: b").output).toMatch(/value must be empty/);
    expect(bad("tolerations:\n  - effect: Sometimes").error).toBe(true);
    expect(bad("affinity:\n  nodeAffinity:\n    requiredDuringSchedulingIgnoredDuringExecution:\n      nodeSelectorTerms:\n        - matchExpressions:\n            - key: a\n              operator: In").output).toMatch(/values must be non-empty/);
    expect(bad("nodeSelector:\n  'bad key': x").error).toBe(true);
  });
});
