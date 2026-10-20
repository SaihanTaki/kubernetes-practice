import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, find, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const pod = (image: string, probes = "") => `apiVersion: v1
kind: Pod
metadata:
  name: app
  labels:
    app: app
spec:
  containers:
    - name: app
      image: ${image}
      ports:
        - containerPort: 8080
          name: http
${probes}`;

/** Applies the Pod and lets it start. */
const started = (image: string, probes = "") =>
  exec(createCluster({ files: { "pod.yaml": pod(image, probes) } }), "kubectl apply -f pod.yaml", "kubectl get pods");

const probe = (kind: string, handler: string) => `      ${kind}:\n${handler.replace(/^/gm, "        ")}\n`;
const http = (path: string, port: string | number) => `httpGet:\n  path: ${path}\n  port: ${port}`;

describe("images", () => {
  it.each([
    ["nginx:1.27", "Running"],
    ["nginx", "Running"],
    ["nginx:1.99", "ImagePullBackOff"],
    ["httpd:2.4", "Running"],
    ["redis:7.2", "Running"],
    ["busybox:1.36", "Running"],
    ["example/api:1.1", "Running"],
    ["example/api:2.0", "CrashLoopBackOff"],
    ["example/api:9.9", "ImagePullBackOff"],
    ["registry.example.com/anything:v3", "Running"],
  ])("%s starts as %s", (image, status) => {
    expect(find(started(image).c, "Pod", "default", "app")!.status).toBe(status);
  });

  it("explains a failed pull in describe events", () => {
    const out = exec(started("nginx:1.99").c, "kubectl describe pod app").output;
    expect(out).toMatch(/State:\s+Waiting \(reason: ImagePullBackOff\)/);
    expect(out).toMatch(/Warning\s+Failed\s+\S+\s+kubelet\s+Failed to pull image "nginx:1.99"/);
  });

  it("restarts a crashing image every command", () => {
    let r = started("example/api:2.0");
    const before = find(r.c, "Pod", "default", "app")!.restarts;
    r = exec(r.c, "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")!.restarts).toBe(before + 1);
    expect(r.output).toMatch(/app\s+0\/1\s+CrashLoopBackOff/);
  });
});

describe("readiness probes", () => {
  it.each([
    ["example/api:1.1", http("/ready", 8080), true],
    ["example/api:1.1", http("/ready", "http"), true],
    ["example/api:1.1", http("/missing", 8080), false],
    ["example/api:1.1", http("/ready", 80), false],
    ["nginx:1.27", http("/", 80), true],
    ["nginx:1.27", http("/healthz", 80), false],
    ["redis:7", "tcpSocket:\n  port: 6379", true],
    ["redis:7", "tcpSocket:\n  port: 6380", false],
    ["busybox:1.36", http("/", 80), false],
    ["busybox:1.36", "exec:\n  command: [cat, /tmp/ready]", true],
  ])("%s with %j ready=%s", (image, handler, ready) => {
    const r = started(image, probe("readinessProbe", handler as string));
    const p = find(r.c, "Pod", "default", "app")!;
    expect(p.status).toBe("Running");
    expect(p.ready).toBe(ready);
  });

  it("keeps a not-ready Pod Running and out of endpoints, and explains why", () => {
    let r = started("example/api:1.1", probe("readinessProbe", http("/missing", 8080)));
    r = exec(r.c, "kubectl expose pod app --port=80 --target-port=8080");
    expect(exec(r.c, "kubectl get pods").output).toMatch(/app\s+0\/1\s+Running\s+0/);
    expect(exec(r.c, "kubectl get ep app").output).toMatch(/app\s+<none>/);
    const out = exec(r.c, "kubectl describe pod app").output;
    expect(out).toContain("Readiness:      http-get http://:8080/missing delay=0s timeout=1s period=10s #success=1 #failure=3");
    expect(out).toContain("Readiness probe failed: HTTP probe failed with statuscode: 404");
    const wrongPort = exec(started("example/api:1.1", probe("readinessProbe", http("/ready", 9090))).c, "kubectl describe pod app").output;
    expect(wrongPort).toMatch(/Readiness probe failed: Get "http:\/\/10\.244\.\d+\.\d+:9090\/ready": dial tcp \S+: connect: connection refused/);
  });

  it("shows probes in -o yaml", () => {
    const r = started("example/api:1.1", probe("readinessProbe", `${http("/ready", 8080)}\nperiodSeconds: 5`));
    const doc = parseYaml(exec(r.c, "kubectl get pod app -o yaml").output);
    expect(doc.spec.containers[0].readinessProbe).toEqual({ httpGet: { path: "/ready", port: 8080 }, periodSeconds: 5 });
  });

  it("rejects probes without exactly one handler", () => {
    const bad = (p: string) => exec(createCluster({ files: { "pod.yaml": pod("nginx", p) } }), "kubectl apply -f pod.yaml").error;
    expect(bad(probe("readinessProbe", "periodSeconds: 5"))).toBe(true);
    expect(bad(probe("readinessProbe", `${http("/", 80)}\ntcpSocket:\n  port: 80`))).toBe(true);
    expect(bad(probe("readinessProbe", http("no-slash", 80)))).toBe(true);
    expect(bad(probe("livenessProbe", http("/", "NotAName")))).toBe(true);
  });
});

describe("liveness and startup probes", () => {
  it("restarts once per command and shows CrashLoopBackOff from 3 restarts", () => {
    let r = started("example/api:1.1", probe("livenessProbe", http("/nope", 8080)));
    expect(r.output).toMatch(/app\s+0\/1\s+ContainerCreating/);
    const statuses: string[] = [];
    for (let i = 0; i < 4; i++) {
      r = exec(r.c, "kubectl get pods");
      const p = find(r.c, "Pod", "default", "app")!;
      statuses.push(`${p.status}:${p.restarts}`);
    }
    expect(statuses).toEqual(["Running:1", "Running:2", "CrashLoopBackOff:3", "CrashLoopBackOff:4"]);
    const out = exec(r.c, "kubectl describe pod app").output;
    expect(out).toContain("Liveness probe failed: HTTP probe failed with statuscode: 404");
    expect(out).toContain("Container app failed liveness probe, will be restarted");
  });

  it("treats a failing startup probe like a failing liveness probe", () => {
    const r = exec(started("redis:7", probe("startupProbe", "tcpSocket:\n  port: 1234")).c, "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")).toMatchObject({ restarts: 1, ready: false });
  });

  it("leaves a healthy liveness probe alone", () => {
    const r = exec(started("example/api:1.1", probe("livenessProbe", http("/healthz", "http"))).c, "kubectl get pods", "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")).toMatchObject({ status: "Running", ready: true, restarts: 0 });
  });
});
