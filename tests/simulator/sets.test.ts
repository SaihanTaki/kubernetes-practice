import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, find, list, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const wait = (c: Cluster, n: number) => exec(c, ...Array(n).fill("kubectl get pods")).c;

const daemonSet = (spec = "") => `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: agent
spec:
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:${spec}
      containers:
        - name: agent
          image: busybox:1.36
          command: ["sleep", "3600"]
`;

const tolerateControlPlane = `
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule`;

const web = (replicas: number, extra = "") => `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web
  replicas: ${replicas}${extra}
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
`;

const apply = (c: Cluster, text: string) => {
  c.files["x.yaml"] = text;
  return exec(c, "kubectl apply -f x.yaml");
};

const dsPods = (c: Cluster) => list(c, "Pod").filter((p) => p.ownerKind === "DaemonSet");

describe("DaemonSet", () => {
  it("runs one Pod per node it may run on, skipping the tainted control plane", () => {
    const c = wait(apply(createCluster(), daemonSet()).c, 1);
    expect(dsPods(c).map((p) => p.node).sort()).toEqual(["worker-1", "worker-2"]);
    expect(dsPods(c).every((p) => /^agent-[a-z0-9]{5}$/.test(p.metadata.name))).toBe(true);
    expect(exec(c, "kubectl get ds").output).toMatch(/^NAME\s+DESIRED\s+CURRENT\s+READY\s+UP-TO-DATE\s+AVAILABLE\s+NODE SELECTOR\s+AGE\nagent\s+2\s+2\s+2\s+2\s+2\s+<none>\s+\d+s$/);
    expect(check(c, { kind: "daemonset-pods", name: "agent", expectedValue: 2 })).toBe(true);
    expect(check(c, { kind: "ready-pod-count", ownerType: "DaemonSet", ownerName: "agent", expectedValue: 2 })).toBe(true);
  });

  it("follows nodeSelector, added nodes and removed taints", () => {
    let c = wait(apply(createCluster(), daemonSet("\n      nodeSelector:\n        topology.kubernetes.io/zone: zone-a")).c, 1);
    expect(dsPods(c).map((p) => p.node)).toEqual(["worker-1"]);
    expect(exec(c, "kubectl get ds").output).toMatch(/agent\s+1\s+1\s+1\s+1\s+1\s+topology\.kubernetes\.io\/zone=zone-a/);
    c = apply(createCluster(), daemonSet()).c;
    c = apply(c, "apiVersion: v1\nkind: Node\nmetadata:\n  name: worker-3\n").c;
    expect(dsPods(c).map((p) => p.node).sort()).toEqual(["worker-1", "worker-2", "worker-3"]);
    c = exec(c, "kubectl taint nodes control-plane node-role.kubernetes.io/control-plane:NoSchedule-").c;
    expect(dsPods(c)).toHaveLength(4);
    c = exec(c, "kubectl taint nodes worker-3 dedicated=db:NoSchedule").c;
    expect(dsPods(c)).toHaveLength(3);
  });

  it("stays on cordoned nodes and is skipped by drain --ignore-daemonsets", () => {
    const c = wait(apply(createCluster(), daemonSet()).c, 1);
    const r = exec(c, "kubectl drain worker-1 --ignore-daemonsets");
    expect(r.error).toBe(false);
    expect(dsPods(r.c)).toHaveLength(2);
    expect(exec(c, "kubectl drain worker-1").output).toMatch(/cannot delete DaemonSet-managed Pods/);
  });

  it("replaces Pods one node at a time after a template change", () => {
    let c = wait(apply(createCluster(), daemonSet()).c, 1);
    const old = dsPods(c).map((p) => p.metadata.name);
    c = apply(c, daemonSet(tolerateControlPlane)).c;
    expect(dsPods(c)).toHaveLength(3);
    expect(dsPods(c).filter((p) => old.includes(p.metadata.name))).toHaveLength(2);
    expect(exec(c, "kubectl rollout status daemonset/agent").output).toBe('Waiting for daemon set "agent" rollout to finish: 1 out of 3 new pods have been updated...');
    c = wait(c, 1);
    expect(dsPods(c).filter((p) => old.includes(p.metadata.name))).toHaveLength(1);
    c = wait(c, 3);
    expect(dsPods(c).some((p) => old.includes(p.metadata.name))).toBe(false);
    expect(exec(c, "kubectl rollout status ds/agent").output).toBe('daemon set "agent" successfully rolled out');
    expect(check(c, { kind: "daemonset-pods", name: "agent", expectedValue: 3 })).toBe(true);
  });

  it("restarts with rollout restart and describes itself", () => {
    const c = wait(apply(createCluster(), daemonSet()).c, 1);
    expect(exec(c, "kubectl rollout restart daemonset/agent").output).toBe("daemonset.apps/agent restarted");
    expect(exec(c, "kubectl rollout undo daemonset/agent").error).toBe(true);
    const d = exec(c, "kubectl describe ds agent").output;
    expect(d).toMatch(/Desired Number of Nodes Scheduled:\s+2/);
    expect(d).toMatch(/Pods Status:\s+2 Running \/ 0 Waiting/);
  });
});

describe("StatefulSet", () => {
  it("creates Pods <sts>-0, -1, ... one at a time, each with its own claim", () => {
    const created = apply(createCluster(), web(3));
    expect(created.output).toBe("service/web created\nstatefulset.apps/web created");
    let c = created.c;
    expect(list(c, "Pod").map((p) => p.metadata.name)).toEqual(["web-0"]);
    expect(exec(c, "kubectl get svc web").output).toMatch(/web\s+ClusterIP\s+None\s+<none>\s+80\/TCP/);
    c = wait(c, 1);
    expect(list(c, "Pod").map((p) => p.metadata.name)).toEqual(["web-0", "web-1"]);
    c = wait(c, 2);
    expect(exec(c, "kubectl get sts").output).toMatch(/^NAME\s+READY\s+AGE\nweb\s+3\/3\s+\d+s$/);
    expect(list(c, "PersistentVolumeClaim").map((p) => [p.metadata.name, p.phase])).toEqual([
      ["data-web-0", "Bound"],
      ["data-web-1", "Bound"],
      ["data-web-2", "Bound"],
    ]);
    expect(check(c, { kind: "ready-pod-count", ownerType: "StatefulSet", ownerName: "web", expectedValue: 3 })).toBe(true);
    expect(check(c, { kind: "replica-count", resourceType: "StatefulSet", resourceName: "web", expectedValue: 3 })).toBe(true);
    expect(exec(c, "kubectl rollout status statefulset/web").output).toMatch(/^statefulset rolling update complete 3 pods at revision web-\w+\.\.\.$/);
  });

  it("starts all Pods at once with podManagementPolicy Parallel", () => {
    const { c } = apply(createCluster(), web(3, "\n  podManagementPolicy: Parallel"));
    expect(list(c, "Pod")).toHaveLength(3);
  });

  it("scales down from the highest ordinal and keeps the claims", () => {
    let c = wait(apply(createCluster(), web(3)).c, 3);
    const r = exec(c, "kubectl scale statefulset web --replicas=1");
    expect(r.output).toBe("statefulset.apps/web scaled");
    expect(list(r.c, "Pod").map((p) => p.metadata.name)).toEqual(["web-0", "web-1"]);
    c = wait(r.c, 1);
    expect(list(c, "Pod").map((p) => p.metadata.name)).toEqual(["web-0"]);
    expect(list(c, "PersistentVolumeClaim")).toHaveLength(3);
    expect(exec(c, "kubectl describe sts web").output).toMatch(/delete Pod web-2 in StatefulSet web successful/);
  });

  it("recreates a deleted Pod with the same name, node and data", () => {
    let c = wait(apply(createCluster(), web(1)).c, 1);
    const node = find(c, "Pod", "default", "web-0")!.node;
    c = exec(c, "kubectl exec web-0 -- sh -c 'echo hello from web-0 > /usr/share/nginx/html/index.html'").c;
    c = exec(c, "kubectl delete pod web-0").c;
    expect(find(c, "Pod", "default", "web-0")!.node).toBe(node);
    c = wait(c, 1);
    expect(exec(c, "kubectl exec web-0 -- cat /usr/share/nginx/html/index.html").output).toBe("hello from web-0");
    expect(check(c, { kind: "file-content", ownerType: "StatefulSet", ownerName: "web", path: "/usr/share/nginx/html/index.html", expectedValue: "hello from web-0" })).toBe(true);
  });

  it("keeps claims when the StatefulSet is deleted and rejects changes to fixed fields", () => {
    const { c } = apply(createCluster(), web(1));
    const r = exec(c, "kubectl delete sts web");
    expect(r.output).toBe('statefulset.apps "web" deleted');
    expect(list(r.c, "Pod")).toHaveLength(0);
    expect(list(r.c, "PersistentVolumeClaim")).toHaveLength(1);
    expect(apply(c, web(1).replace("storage: 1Gi", "storage: 2Gi")).output).toMatch(/^The StatefulSet "web" is invalid: spec: Forbidden: updates to statefulset spec for fields other than 'replicas'/);
    expect(apply(c, web(1).replace("serviceName: web\n", "")).error).toBe(true);
  });

  it("replaces outdated Pods from the highest ordinal on rollout restart", () => {
    let c = wait(apply(createCluster(), web(2)).c, 2);
    const uid = (n: string) => find(c, "Pod", "default", n)!.metadata.uid;
    const before = [uid("web-0"), uid("web-1")];
    expect(exec(c, "kubectl rollout restart sts/web").output).toBe("statefulset.apps/web restarted");
    c = exec(c, "kubectl rollout restart sts/web").c;
    expect(find(c, "Pod", "default", "web-1")?.metadata.uid).not.toBe(before[1]);
    expect(uid("web-0")).toBe(before[0]);
    c = wait(c, 4);
    expect(uid("web-0")).not.toBe(before[0]);
  });

  it("rejects mounts that match neither a volume nor a claim template", () => {
    expect(apply(createCluster(), web(1).replace("- name: data\n              mountPath", "- name: other\n              mountPath")).output).toBe(
      'The StatefulSet "web" is invalid: spec.template.spec.containers[0].volumeMounts[0].name: Not found: "other"',
    );
  });
});
