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
