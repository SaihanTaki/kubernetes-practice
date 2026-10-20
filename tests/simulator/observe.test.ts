import { describe, expect, it } from "vitest";
import { createCluster, list, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const cluster = () =>
  createCluster({
    deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }],
    pods: [
      { name: "api", image: "example/api:1.1" },
      { name: "broken", image: "example/api:2.0" },
      { name: "box", image: "busybox:1.36" },
      { name: "cache", image: "redis:7" },
    ],
  });

describe("logs", () => {
  it("prints each image's start lines", () => {
    const c = cluster();
    expect(exec(c, "kubectl logs api").output).toBe("listening on :8080");
    expect(exec(c, "kubectl logs box").output).toBe("");
    expect(exec(c, "kubectl logs cache").output).toContain("Ready to accept connections tcp");
    const web = list(c, "Pod").find((p) => p.metadata.name.startsWith("web-"))!.metadata.name;
    const out = exec(c, `kubectl logs ${web}`).output;
    expect(out).toContain("/docker-entrypoint.sh: Configuration complete; ready for start up");
    expect(out).toMatch(/\[notice\] 1#1: nginx\/1\.27\.0$/m);
    expect(exec(c, `kubectl logs pod/${web} --tail=1`).output).toMatch(/start worker processes$/);
    expect(exec(c, `kubectl logs ${web} --tail=0`).output).toBe("");
  });

  it("shows a crash in current and previous logs", () => {
    const c = cluster();
    expect(exec(c, "kubectl logs broken").output).toBe("fatal: config file /etc/api/config.yaml not found");
    expect(exec(c, "kubectl logs broken --previous").output).toBe("fatal: config file /etc/api/config.yaml not found");
    expect(exec(c, "kubectl logs broken -p -c api").error).toBe(false);
    expect(exec(c, "kubectl logs api --previous").output).toBe('Error from server (BadRequest): previous terminated container "api" in pod "api" not found');
  });

  it("explains containers that have not started", () => {
    let r = exec(cluster(), "kubectl run late --image=nginx", "kubectl logs late");
    expect(r.output).toBe('Error from server (BadRequest): container "nginx" in pod "late" is waiting to start: ContainerCreating');
    r = exec(r.c, "kubectl run bad --image=nginx:9.9", "kubectl get pods", "kubectl logs bad");
    expect(r.output).toBe('Error from server (BadRequest): container "nginx" in pod "bad" is waiting to start: trying and failing to pull image');
  });

  it("picks a Pod of a Deployment or ReplicaSet", () => {
    const c = cluster();
    const out = exec(c, "kubectl logs deployment/web").output;
    expect(out).toMatch(/^Found 2 pods, using pod\/web-\S+\n\/docker-entrypoint\.sh/);
    const rs = list(c, "ReplicaSet")[0].metadata.name;
    expect(exec(c, `kubectl logs rs/${rs} --tail=1`).output).toMatch(/start worker processes$/);
    expect(exec(c, "kubectl logs deploy/nope").output).toBe('Error from server (NotFound): deployments.apps "nope" not found');
  });

  it.each([
    ["kubectl logs", "error: expected 'logs POD_NAME'"],
    ["kubectl logs nope", 'Error from server (NotFound): pods "nope" not found'],
    ["kubectl logs api -c other", "error: container other is not valid for pod api"],
    ["kubectl logs svc/web", "error: cannot get logs from svc"],
    ["kubectl logs api extra", 'error: unexpected argument "extra"'],
    ["kubectl get pods --tail=1", "only supported with kubectl logs"],
    ["kubectl logs api --tail=x", "must be a whole number"],
  ])("rejects %s", (cmd, message) => {
    const r = exec(cluster(), cmd);
    expect(r.error).toBe(true);
    expect(r.output).toContain(message);
  });
});

describe("events", () => {
  it("lists events with real columns, oldest first", () => {
    const r = exec(cluster(), "kubectl scale deploy web --replicas=3", "kubectl get events");
    const lines = r.output.split("\n");
    expect(lines[0]).toMatch(/^LAST SEEN\s+TYPE\s+REASON\s+OBJECT\s+MESSAGE$/);
    expect(r.output).toMatch(/Normal\s+SuccessfulCreate\s+replicaset\/web-\S+\s+Created pod: web-/);
    expect(r.output).toMatch(/Normal\s+Scheduled\s+pod\/api\s+Successfully assigned default\/api to worker-\d/);
    expect(r.output).toMatch(/Warning\s+BackOff\s+pod\/broken\s+Back-off restarting failed container api in pod broken/);
    expect(lines.at(-1)).toMatch(/^0s\s/);
  });

  it("filters by field selector and namespace", () => {
    const c = cluster();
    const out = exec(c, "kubectl get events --field-selector involvedObject.name=broken").output;
    expect(out.split("\n").slice(1).every((l) => l.includes("pod/broken"))).toBe(true);
    expect(exec(c, "kubectl get ev --field-selector type=Warning,reason=BackOff").output.split("\n")).toHaveLength(2);
    expect(exec(c, "kubectl get events --field-selector type!=Normal").output).not.toContain("Normal");
    expect(exec(c, "kubectl get events -n other").output).toBe("No resources found in other namespace.");
    expect(exec(c, "kubectl get events -A").output.split("\n")[0]).toMatch(/^NAMESPACE\s+LAST SEEN/);
    expect(exec(c, "kubectl get events --field-selector spec.x=1").output).toContain("error: field label not supported: spec.x");
    expect(exec(c, "kubectl get pods --field-selector involvedObject.name=x").error).toBe(true);
  });

  it("ends describe output with the object's events", () => {
    const c = cluster();
    expect(exec(c, "kubectl describe pod api").output).toMatch(/Events:\n {2}Type\s+Reason\s+Age\s+From\s+Message\n.*\n {2}Normal\s+Scheduled/);
    const rs = list(c, "ReplicaSet")[0].metadata.name;
    expect(exec(c, `kubectl describe rs ${rs}`).output).toMatch(/SuccessfulCreate\s+\S+\s+replicaset-controller\s+Created pod/);
    expect(exec(c, "kubectl describe deploy web").output).toMatch(/\nEvents:\s+<none>$/);
  });

  it("keeps events of deleted objects but not on a new object with the same name", () => {
    const r = exec(cluster(), "kubectl delete pod api", "kubectl run api --image=nginx");
    expect(exec(r.c, "kubectl get events --field-selector involvedObject.name=api").output.split("\n").length).toBeGreaterThan(1);
    expect(exec(r.c, "kubectl describe pod api").output.match(/Scheduled/g)).toHaveLength(1);
  });
});

describe("bad input for Part A commands", () => {
  it.each([
    "kubectl top",
    "kubectl top nodes nope",
    "kubectl top pods nope",
    "kubectl taint",
    "kubectl taint nodes",
    "kubectl taint nodes worker-1 =:NoSchedule",
    "kubectl taint nodes worker-1 :-",
    "kubectl taint nodes worker-1 a=b=c:NoSchedule",
    "kubectl cordon",
    "kubectl cordon worker-1 extra",
    "kubectl uncordon nope",
    "kubectl drain worker-1 extra",
    "kubectl logs pod/",
    "kubectl logs /x",
    "kubectl logs a/b/c",
    "kubectl logs deployment/__proto__",
    "kubectl get events extra",
    "kubectl get events --field-selector",
    "kubectl get events --field-selector =",
    "kubectl create quota q --hard=",
    "kubectl create quota q --hard==1",
    "kubectl describe node",
    "kubectl delete node",
    "kubectl label node worker-1",
  ])("never throws for %j", (input) => {
    const r = run(cluster(), input);
    expect(r.error).toBe(true);
  });
});
