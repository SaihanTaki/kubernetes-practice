import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, run } from "@/lib/simulator";

const base = () =>
  createCluster({
    deployments: [{ name: "web", replicas: 1, image: "nginx:1.27", labels: { app: "web" } }],
    pods: [{ name: "solo", image: "busybox" }],
  });

describe("lab validators", () => {
  it("checks existence and absence", () => {
    const c = base();
    expect(check(c, { kind: "resource-exists", resourceType: "Pod", resourceName: "solo" })).toBe(true);
    expect(check(c, { kind: "resource-absent", resourceType: "Pod", resourceName: "solo" })).toBe(false);
    const after = run(c, "kubectl delete pod solo").cluster;
    expect(check(after, { kind: "resource-absent", resourceType: "Pod", resourceName: "solo" })).toBe(true);
  });

  it("separates desired replicas from ready pods", () => {
    const ready3 = { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 3 } as const;
    let c = run(base(), "kubectl scale deployment web --replicas=3").cluster;
    expect(check(c, { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 3 })).toBe(true);
    expect(check(c, ready3)).toBe(false);
    c = run(c, "kubectl get pods").cluster;
    expect(check(c, ready3)).toBe(true);
  });

  it("fails for a missing owner", () => {
    expect(check(base(), { kind: "ready-pod-count", ownerType: "ReplicaSet", ownerName: "nope", expectedValue: 0 })).toBe(false);
  });

  it("checks Services, endpoints and types, including new kinds", () => {
    let c = run(base(), "kubectl expose deployment web --port=80 --type=NodePort").cluster;
    expect(check(c, { kind: "resource-exists", resourceType: "Service", resourceName: "web" })).toBe(true);
    expect(check(c, { kind: "endpoint-count", serviceName: "web", expectedValue: 1 })).toBe(true);
    expect(check(c, { kind: "endpoint-count", serviceName: "nope", expectedValue: 0 })).toBe(false);
    expect(check(c, { kind: "service-type", serviceName: "web", expectedValue: "NodePort" })).toBe(true);
    expect(check(c, { kind: "service-type", serviceName: "web", expectedValue: "ClusterIP" })).toBe(false);
    c = run(c, "kubectl scale deploy web --replicas=3").cluster;
    expect(check(c, { kind: "endpoint-count", serviceName: "web", expectedValue: 1 })).toBe(true);
    c = run(c, "kubectl get pods").cluster;
    expect(check(c, { kind: "endpoint-count", serviceName: "web", expectedValue: 3 })).toBe(true);
  });

  it("checks labels and annotations, with null for absent", () => {
    const c = run(base(), "kubectl label pod solo tier=db").cluster;
    const label = (expectedValue: string | null, key = "tier") =>
      check(c, { kind: "label-equals", resourceType: "Pod", resourceName: "solo", key, expectedValue });
    expect(label("db")).toBe(true);
    expect(label("web")).toBe(false);
    expect(label(null)).toBe(false);
    expect(label(null, "other")).toBe(true);
    expect(check(c, { kind: "label-equals", resourceType: "Pod", resourceName: "nope", key: "x", expectedValue: null })).toBe(false);
    const annotated = run(c, "kubectl annotate deployment web 'kubernetes.io/change-cause=go live'").cluster;
    const cause = { kind: "annotation-equals", resourceType: "Deployment", resourceName: "web", key: "kubernetes.io/change-cause" } as const;
    expect(check(annotated, { ...cause, expectedValue: "go live" })).toBe(true);
    expect(check(c, { ...cause, expectedValue: null })).toBe(true);
  });

  it("checks the template image and rollout completion", () => {
    let c = run(base(), "kubectl set image deployment/web nginx=nginx:1.28").cluster;
    expect(check(c, { kind: "deployment-image", resourceName: "web", expectedValue: "nginx:1.28" })).toBe(true);
    expect(check(c, { kind: "rollout-complete", resourceName: "web" })).toBe(false);
    c = run(c, "kubectl get pods").cluster;
    c = run(c, "kubectl get pods").cluster;
    expect(check(c, { kind: "rollout-complete", resourceName: "web" })).toBe(true);
    expect(check(c, { kind: "rollout-complete", resourceName: "nope" })).toBe(false);
  });

  it("checks pod status and config values", () => {
    let c = run(base(), "kubectl run bad --image=nginx:1.99").cluster;
    expect(check(c, { kind: "pod-status", podName: "bad", expectedValue: "ContainerCreating" })).toBe(true);
    c = run(c, "kubectl create configmap app --from-literal=color=blue").cluster;
    expect(check(c, { kind: "pod-status", podName: "bad", expectedValue: "ImagePullBackOff" })).toBe(true);
    c = run(c, "kubectl create secret generic db --from-literal=password=s3cr3t").cluster;
    expect(check(c, { kind: "config-key", resourceType: "ConfigMap", resourceName: "app", key: "color", expectedValue: "blue" })).toBe(true);
    expect(check(c, { kind: "config-key", resourceType: "Secret", resourceName: "db", key: "password", expectedValue: "s3cr3t" })).toBe(true);
    expect(check(c, { kind: "config-key", resourceType: "Secret", resourceName: "db", key: "missing", expectedValue: "" })).toBe(false);
    expect(check(c, { kind: "resource-absent", resourceType: "Secret", resourceName: "other" })).toBe(true);
  });
});

describe("Part A validators", () => {
  const sized = (req: string, lim: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      nodeSelector:
        disk: ssd
      containers:
        - name: api
          image: example/api:1.1
          resources:
            requests:
              memory: ${req}
            limits:
              memory: ${lim}
`;
  const apiCluster = () => createCluster({ files: { "api.yaml": sized("512Mi", "1Gi") }, apply: ["api.yaml"] });

  it("checks Pending Pods and Pod nodes through a Deployment's ReplicaSets", () => {
    let c = apiCluster();
    const pending = (n: number) => check(c, { kind: "pending-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: n });
    const onNode = (node: string) => check(c, { kind: "pod-node", ownerType: "Deployment", ownerName: "api", expectedValue: node });
    expect(pending(2)).toBe(true);
    expect(onNode("worker-2")).toBe(false);
    c = run(c, "kubectl label node worker-2 disk=ssd").cluster;
    expect(pending(0)).toBe(true);
    expect(onNode("worker-2")).toBe(true);
    const rs = run(c, "kubectl get rs").output.split("\n")[1].split(/\s+/)[0];
    expect(check(c, { kind: "pod-node", ownerType: "ReplicaSet", ownerName: rs, expectedValue: "worker-2" })).toBe(true);
    expect(check(c, { kind: "pending-pod-count", ownerType: "Deployment", ownerName: "nope", expectedValue: 0 })).toBe(false);
    expect(check(c, { kind: "pod-node", ownerType: "Deployment", ownerName: "nope", expectedValue: "worker-2" })).toBe(false);
    expect(check(c, { kind: "pod-node", podName: "solo", expectedValue: "worker-2" })).toBe(false);
  });

  it("checks a single Pod's node", () => {
    const c = createCluster({ pods: [{ name: "solo", image: "busybox" }] });
    expect(check(c, { kind: "pod-node", podName: "solo", expectedValue: "worker-1" })).toBe(true);
    expect(check(c, { kind: "pod-node", podName: "solo", expectedValue: "worker-2" })).toBe(false);
  });

  it("checks node schedulability, taints and labels", () => {
    let c = base();
    expect(check(c, { kind: "node-schedulable", nodeName: "worker-1", expectedValue: true })).toBe(true);
    expect(check(c, { kind: "node-taint", nodeName: "control-plane", key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule", present: true })).toBe(true);
    expect(check(c, { kind: "node-label", nodeName: "worker-2", key: "topology.kubernetes.io/zone", expectedValue: "zone-b" })).toBe(true);
    expect(check(c, { kind: "node-label", nodeName: "worker-2", key: "disk", expectedValue: null })).toBe(true);
    c = run(c, "kubectl cordon worker-1").cluster;
    c = run(c, "kubectl taint nodes worker-2 dedicated=batch:NoExecute").cluster;
    c = run(c, "kubectl label node worker-2 disk=ssd").cluster;
    expect(check(c, { kind: "node-schedulable", nodeName: "worker-1", expectedValue: false })).toBe(true);
    expect(check(c, { kind: "node-taint", nodeName: "worker-1", key: "node.kubernetes.io/unschedulable", effect: "NoSchedule", present: true })).toBe(true);
    expect(check(c, { kind: "node-taint", nodeName: "worker-2", key: "dedicated", effect: "NoExecute", present: true })).toBe(true);
    expect(check(c, { kind: "node-taint", nodeName: "worker-2", key: "dedicated", effect: "NoSchedule", present: false })).toBe(true);
    expect(check(c, { kind: "node-label", nodeName: "worker-2", key: "disk", expectedValue: "ssd" })).toBe(true);
    expect(check(c, { kind: "node-label", nodeName: "nope", key: "disk", expectedValue: null })).toBe(false);
    expect(check(c, { kind: "resource-exists", resourceType: "Node", resourceName: "worker-2", namespace: "other" })).toBe(true);
    expect(check(c, { kind: "label-equals", resourceType: "Node", resourceName: "worker-2", key: "disk", expectedValue: "ssd" })).toBe(true);
  });

  it("compares container resources as quantities, with bounds", () => {
    const c = apiCluster();
    const res = (field: "requests.memory" | "limits.memory" | "requests.cpu", cond: { expectedValue?: string | null; atLeast?: string; atMost?: string }) =>
      check(c, { kind: "container-resource", ownerType: "Deployment", name: "api", field, ...cond });
    expect(res("requests.memory", { expectedValue: "512Mi" })).toBe(true);
    expect(res("limits.memory", { expectedValue: "1024Mi" })).toBe(true);
    expect(res("limits.memory", { expectedValue: "1G" })).toBe(false);
    expect(res("requests.cpu", { expectedValue: null })).toBe(true);
    expect(res("requests.memory", { expectedValue: null })).toBe(false);
    expect(res("requests.memory", { atLeast: "256Mi", atMost: "0.5Gi" })).toBe(true);
    expect(res("requests.memory", { atLeast: "1Gi" })).toBe(false);
    expect(res("requests.memory", { atMost: "100Mi" })).toBe(false);
    expect(res("requests.cpu", { atLeast: "0" })).toBe(false);
    expect(res("limits.memory", { expectedValue: "1Gi", atMost: "512Mi" })).toBe(false);
    expect(check(c, { kind: "container-resource", ownerType: "Deployment", name: "nope", field: "limits.memory", expectedValue: null })).toBe(false);
  });

  it("reads a Pod's resources after LimitRange defaults", () => {
    const lr = "apiVersion: v1\nkind: LimitRange\nmetadata:\n  name: lr\nspec:\n  limits:\n    - type: Container\n      default:\n        cpu: 500m\n";
    let c = createCluster({ files: { "lr.yaml": lr }, apply: ["lr.yaml"] });
    c = run(c, "kubectl run web --image=nginx").cluster;
    expect(check(c, { kind: "container-resource", ownerType: "Pod", name: "web", field: "limits.cpu", expectedValue: "0.5" })).toBe(true);
    expect(check(c, { kind: "container-resource", ownerType: "Pod", name: "web", field: "requests.cpu", expectedValue: "500m" })).toBe(true);
  });

  it("checks the QoS class of every matching Pod", () => {
    const c = apiCluster();
    expect(check(c, { kind: "qos-class", ownerType: "Deployment", ownerName: "api", expectedValue: "Burstable" })).toBe(true);
    expect(check(c, { kind: "qos-class", podName: "solo", expectedValue: "BestEffort" })).toBe(false);
    expect(check(base(), { kind: "qos-class", podName: "solo", expectedValue: "BestEffort" })).toBe(true);
    expect(check(base(), { kind: "qos-class", ownerType: "Deployment", ownerName: "web", expectedValue: "Guaranteed" })).toBe(false);
  });

  it("checks the new Pod statuses", () => {
    let c = createCluster({ files: { "p.yaml": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: x\nspec:\n  nodeSelector:\n    disk: ssd\n  containers:\n    - name: x\n      image: nginx\n" }, apply: ["p.yaml"] });
    expect(check(c, { kind: "pod-status", podName: "x", expectedValue: "Pending" })).toBe(true);
    c = run(c, "kubectl get pods").cluster;
    expect(check(c, { kind: "pod-status", podName: "x", expectedValue: "Pending" })).toBe(true);
  });
});

describe("Part B validators", () => {
  it("are false for missing objects", () => {
    const c = createCluster();
    expect(check(c, { kind: "job-status", jobName: "nope", expectedValue: "Running" })).toBe(false);
    expect(check(c, { kind: "job-succeeded", jobName: "nope", expectedValue: 0 })).toBe(false);
    expect(check(c, { kind: "cronjob-suspended", cronJobName: "nope", expectedValue: false })).toBe(false);
    expect(check(c, { kind: "daemonset-pods", name: "nope", expectedValue: 0 })).toBe(false);
    expect(check(c, { kind: "pvc-status", claimName: "nope", expectedValue: "Pending" })).toBe(false);
    expect(check(c, { kind: "pv-status", pvName: "nope", expectedValue: "Available" })).toBe(false);
    expect(check(c, { kind: "file-content", podName: "nope", path: "/x", expectedValue: null })).toBe(false);
    expect(check(c, { kind: "ready-pod-count", ownerType: "StatefulSet", ownerName: "nope", expectedValue: 0 })).toBe(false);
  });

  it("checks a file, trailing newline ignored, and its absence", () => {
    const c = run(run(base(), "kubectl get pods").cluster, "kubectl exec solo -- sh -c 'echo hello > /tmp/x'").cluster;
    expect(check(c, { kind: "file-content", podName: "solo", path: "/tmp/x", expectedValue: "hello" })).toBe(true);
    expect(check(c, { kind: "file-content", podName: "solo", path: "/tmp/x", expectedValue: "hello\n" })).toBe(false);
    expect(check(c, { kind: "file-content", podName: "solo", path: "/tmp/y", expectedValue: null })).toBe(true);
  });
});
