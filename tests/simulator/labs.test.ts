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
});
