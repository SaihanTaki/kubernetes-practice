import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, currentReplicaSet, find, isReady, list, podsOf, replicaSetsOf, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const deployment = (image: string, strategy = "", replicas = 4, extra = "") => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: ${replicas}
${strategy}  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: ${image}
${extra}`;

const fromFiles = (...versions: string[]) =>
  createCluster({
    files: Object.fromEntries(versions.map((text, i) => [`v${i + 1}.yaml`, text])),
    apply: versions.map((_, i) => `v${i + 1}.yaml`),
  });

/** Per command: Pods per ReplicaSet (oldest first) and ready Pods in total. */
function steps(c: Cluster, n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    c = run(c, "kubectl get pods").cluster;
    const d = find(c, "Deployment", "default", "web")!;
    const sets = replicaSetsOf(c, d);
    out.push(`${sets.map((rs) => podsOf(c, rs).length).join("/")} ready=${list(c, "Pod").filter(isReady).length}`);
  }
  return { c, out };
}

describe("rolling update", () => {
  it("moves one step per command within maxSurge and maxUnavailable", () => {
    let c = fromFiles(deployment("nginx:1.27"));
    c = run(c, "kubectl set image deployment/web web=nginx:1.28").cluster;
    // 4 replicas: maxSurge 25% -> 1, maxUnavailable 25% -> 1, so at least 3 ready and at most 5 Pods.
    const { c: done, out } = steps(c, 5);
    expect(out).toEqual(["1/4 ready=3", "0/4 ready=4", "0/4 ready=4", "0/4 ready=4", "0/4 ready=4"]);
    expect(exec(done, "kubectl rollout status deployment/web").output).toBe('deployment "web" successfully rolled out');
  });

  it("honours integer maxSurge and maxUnavailable", () => {
    const strategy = "  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 0\n      maxUnavailable: 1\n";
    let c = fromFiles(deployment("nginx:1.27", strategy));
    c = run(c, "kubectl set image deployment/web web=nginx:1.28").cluster;
    const { out } = steps(c, 5);
    expect(out).toEqual(["2/2 ready=3", "1/3 ready=3", "0/4 ready=3", "0/4 ready=4", "0/4 ready=4"]);
  });

  it("reports progress with rollout status", () => {
    let r = exec(fromFiles(deployment("nginx:1.27")), "kubectl set image deployment/web web=nginx:1.28");
    r = exec(r.c, "kubectl rollout status deployment/web");
    expect(r.output).toMatch(/^Waiting for deployment "web" rollout to finish: /);
    expect(r.error).toBe(false);
  });

  it.each([
    ["an image that cannot be pulled", "nginx:1.99", ""],
    ["a crashing image", "example/api:2.0", ""],
    ["a failing readiness probe", "nginx:1.27", "          readinessProbe:\n            httpGet:\n              path: /ready\n              port: 80\n"],
  ])("gets stuck on %s while old Pods keep serving", (_, image, extra) => {
    let c = fromFiles(deployment("nginx:1.26"));
    c.files["bad.yaml"] = deployment(image, "", 4, extra);
    c = run(c, "kubectl apply -f bad.yaml").cluster;
    const { c: after, out } = steps(c, 6);
    expect(out.at(-1)).toBe("3/2 ready=3");
    const r = exec(after, "kubectl rollout status deploy/web");
    expect(r.error).toBe(true);
    expect(r.output).toContain('error: deployment "web" exceeded its progress deadline');
    expect(exec(after, "kubectl rollout undo deployment/web", "kubectl get pods", "kubectl get pods", "kubectl get pods").c.resources.filter((x) => x.kind === "Pod" && x.image === "nginx:1.26")).toHaveLength(4);
  });

  it("removes all old Pods before creating new ones with Recreate", () => {
    let c = fromFiles(deployment("nginx:1.27", "  strategy:\n    type: Recreate\n"));
    c = run(c, "kubectl set image deployment/web web=nginx:1.28").cluster;
    expect(list(c, "Pod")).toHaveLength(0);
    const { out } = steps(c, 2);
    expect(out).toEqual(["0/4 ready=0", "0/4 ready=4"]);
  });

  it("rejects invalid strategies", () => {
    const bad = (s: string) => exec(createCluster({ files: { "d.yaml": deployment("nginx", s) } }), "kubectl apply -f d.yaml").output;
    expect(bad("  strategy:\n    type: Recreate\n    rollingUpdate:\n      maxSurge: 1\n")).toMatch(/may not be specified when strategy type is 'Recreate'/);
    expect(bad("  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 0\n      maxUnavailable: 0%\n")).toMatch(/may not be 0/);
    expect(bad("  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1.5\n")).toMatch(/^error: /);
  });

  it("shows the strategy in describe and -o yaml", () => {
    const c = fromFiles(deployment("nginx:1.27", "  strategy:\n    type: Recreate\n"));
    expect(exec(c, "kubectl describe deploy web").output).toMatch(/StrategyType:\s+Recreate/);
    expect(parseYaml(exec(c, "kubectl get deploy web -o yaml").output).spec.strategy).toEqual({ type: "Recreate" });
    expect(exec(c, "kubectl get deploy web -o yaml > web.yaml", "kubectl apply -f web.yaml").output).toBe("deployment.apps/web unchanged");
  });
});

describe("revisions", () => {
  const annotated = (image: string, cause: string) =>
    deployment(image).replace("  name: web\n", `  name: web\n  annotations:\n    kubernetes.io/change-cause: ${cause}\n`);

  it("numbers revisions, copies change-cause and lists history", () => {
    const c = fromFiles(annotated("nginx:1.25", "first"), annotated("nginx:1.26", "second"), deployment("nginx:1.27"));
    const d = find(c, "Deployment", "default", "web")!;
    expect(replicaSetsOf(c, d).map((rs) => rs.metadata.annotations["deployment.kubernetes.io/revision"])).toEqual(["1", "2", "3"]);
    expect(d.metadata.annotations["deployment.kubernetes.io/revision"]).toBe("3");
    expect(list(c, "Pod").every((p) => p.image === "nginx:1.27" && isReady(p))).toBe(true);
    const history = exec(c, "kubectl rollout history deployment/web").output.split("\n");
    expect(history[0]).toBe("deployment.apps/web");
    expect(history.slice(1).map((l) => l.split(/\s{2,}/))).toEqual([["REVISION", "CHANGE-CAUSE"], ["1", "first"], ["2", "second"], ["3", "<none>"]]);
    const two = exec(c, "kubectl rollout history deployment/web --revision=2").output;
    expect(two).toContain("deployment.apps/web with revision #2");
    expect(two).toMatch(/Image:\s+nginx:1.26/);
    expect(two).toContain("kubernetes.io/change-cause: second");
    expect(exec(c, "kubectl rollout history deployment/web --revision=9").output).toBe("error: unable to find the specified revision");
  });

  it("copies a change-cause annotated after the rollout to the current ReplicaSet", () => {
    const r = exec(fromFiles(deployment("nginx:1.27")), `kubectl annotate deployment web kubernetes.io/change-cause="initial release"`);
    expect(exec(r.c, "kubectl rollout history deploy/web").output).toMatch(/1\s+initial release/);
  });

  it("undoes to the previous revision, which becomes the newest", () => {
    let r = exec(fromFiles(deployment("nginx:1.25"), deployment("nginx:1.26"), deployment("nginx:1.27")), "kubectl rollout undo deployment/web");
    expect(r.output).toBe("deployment.apps/web rolled back");
    const d = find(r.c, "Deployment", "default", "web")!;
    expect(d.template.image).toBe("nginx:1.26");
    expect(d.template.labels).toEqual({ app: "web" });
    expect(currentReplicaSet(r.c, d)!.metadata.annotations["deployment.kubernetes.io/revision"]).toBe("4");
    expect(exec(r.c, "kubectl rollout history deploy/web").output).toMatch(/REVISION\s+CHANGE-CAUSE\n1\s+<none>\n3\s+<none>\n4\s+<none>$/);
    r = exec(r.c, "kubectl rollout undo deployment/web --to-revision=1");
    expect(find(r.c, "Deployment", "default", "web")!.template.image).toBe("nginx:1.25");
    expect(exec(r.c, "kubectl rollout undo deployment/web --to-revision=7").output).toBe("error: unable to find specified revision 7 in history");
    expect(exec(r.c, "kubectl rollout undo deployment/web --to-revision=5").output).toBe(
      "deployment.apps/web skipped rollback (current template already matches revision 5)",
    );
    expect(exec(fromFiles(deployment("nginx:1.25")), "kubectl rollout undo deployment/web").output).toBe('error: no rollout history found for deployment "web"');
  });

  it("restores the change-cause of the revision it rolls back to", () => {
    const r = exec(fromFiles(annotated("nginx:1.25", "v1"), annotated("nginx:1.26", "v2")), "kubectl rollout undo deploy/web");
    expect(find(r.c, "Deployment", "default", "web")!.metadata.annotations["kubernetes.io/change-cause"]).toBe("v1");
  });
});

describe("restart, pause and resume", () => {
  it("restarts by changing the template, which makes a new revision", () => {
    const c = fromFiles(deployment("nginx:1.27"));
    const r = exec(c, "kubectl rollout restart deployment/web");
    expect(r.output).toBe("deployment.apps/web restarted");
    const d = find(r.c, "Deployment", "default", "web")!;
    expect(d.template.annotations!["kubectl.kubernetes.io/restartedAt"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(replicaSetsOf(r.c, d)).toHaveLength(2);
    const { out } = steps(r.c, 6);
    expect(out.at(-1)).toBe("0/4 ready=4");
  });

  it("holds template changes while paused and rolls them out on resume", () => {
    let r = exec(fromFiles(deployment("nginx:1.25")), "kubectl rollout pause deployment/web");
    expect(r.output).toBe("deployment.apps/web paused");
    expect(exec(r.c, "kubectl rollout pause deployment/web").output).toBe('error: deployments.apps "web" is already paused');
    r = exec(r.c, "kubectl set image deployment/web web=nginx:1.26", "kubectl set image deployment/web web=nginx:1.27", "kubectl get pods");
    expect(list(r.c, "ReplicaSet")).toHaveLength(1);
    expect(exec(r.c, "kubectl rollout restart deployment/web").error).toBe(true);
    expect(exec(r.c, "kubectl rollout undo deployment/web").error).toBe(true);
    r = exec(r.c, "kubectl scale deployment web --replicas=5");
    expect(list(r.c, "Pod")).toHaveLength(5);
    r = exec(r.c, "kubectl rollout resume deployment/web");
    expect(r.output).toBe("deployment.apps/web resumed");
    expect(list(r.c, "ReplicaSet")).toHaveLength(2);
    expect(exec(r.c, "kubectl rollout resume deployment/web").output).toBe('error: deployments.apps "web" is not paused');
    expect(exec(r.c, "kubectl rollout history deployment/web").output.split("\n")).toHaveLength(4);
  });

  it("validates rollout input", () => {
    const c = fromFiles(deployment("nginx:1.27"));
    for (const bad of [
      "kubectl rollout",
      "kubectl rollout status",
      "kubectl rollout explode deployment/web",
      "kubectl rollout status pod/web",
      "kubectl rollout status deployment/nope",
      "kubectl rollout status deployment/web --revision=1",
      "kubectl rollout undo deployment/web --to-revision=x",
      "kubectl get pods --to-revision=1",
    ]) {
      expect(exec(c, bad).error, bad).toBe(true);
    }
  });
});

describe("fixture.apply", () => {
  it("applies files in order, settles them and keeps them visible", () => {
    const svc = "apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n";
    const c = createCluster({ files: { "web.yaml": deployment("nginx:1.27"), "svc.yaml": svc }, apply: ["web.yaml", "svc.yaml"] });
    expect(c.clock).toBe(0);
    expect(list(c, "Pod").every(isReady)).toBe(true);
    expect(exec(c, "ls").output).toBe("svc.yaml\nweb.yaml");
    expect(exec(c, "kubectl get ep web").output).toMatch(/(10\.244\.\d+\.\d+:80,?){3} \+ 1 more\.\.\./);
    expect(exec(c, "kubectl get deploy web").output).toMatch(/web\s+4\/4\s+4\s+4\s+10m/);
    expect(createCluster({ files: { "web.yaml": deployment("nginx:1.27") }, apply: ["web.yaml"] })).toEqual(
      createCluster({ files: { "web.yaml": deployment("nginx:1.27") }, apply: ["web.yaml"] }),
    );
  });

  it("ages crashing Pods and throws for a broken fixture", () => {
    const c = fromFiles(deployment("example/api:2.0", "", 1));
    expect(list(c, "Pod")[0]).toMatchObject({ status: "CrashLoopBackOff", restarts: 6 });
    expect(() => createCluster({ apply: ["missing.yaml"] })).toThrow(/missing\.yaml/);
    expect(() => createCluster({ files: { "x.yaml": "kind: Nope\n" }, apply: ["x.yaml"] })).toThrow(/x\.yaml/);
  });
});
