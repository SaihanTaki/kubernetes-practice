import { describe, expect, it } from "vitest";
import { createCluster, find, list, podsOf, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const pods = () =>
  createCluster({
    pods: [
      { name: "a", image: "nginx:1.27", labels: { app: "web", env: "prod" } },
      { name: "b", image: "nginx:1.27", labels: { app: "web", env: "dev" } },
      { name: "c", image: "nginx:1.27", labels: { app: "db" } },
    ],
  });

const names = (output: string) => output.split("\n").slice(1).map((l) => l.split(/\s+/)[0]);

describe("selectors", () => {
  it.each([
    ["app=web", ["a", "b"]],
    ["app==web", ["a", "b"]],
    ["app!=web", ["c"]],
    ["env", ["a", "b"]],
    ["!env", ["c"]],
    ["app=web,env=dev", ["b"]],
    ["'env in (prod,staging)'", ["a"]],
    ['"env notin (prod)"', ["b", "c"]],
    ["'app in (web, db),!env'", ["c"]],
  ])("-l %s", (selector, expected) => {
    expect(names(exec(pods(), `kubectl get pods -l ${selector}`).output)).toEqual(expected);
  });

  it("rejects malformed selectors", () => {
    for (const s of ["'app in prod'", "=web", "app=Bad_", "'app in (a b)'"]) expect(exec(pods(), `kubectl get pods -l ${s}`).error).toBe(true);
    expect(exec(pods(), "kubectl get pods -l app=nope").output).toBe("No resources found in default namespace.");
  });

  it("adds a LABELS column", () => {
    const out = exec(pods(), "kubectl get pods --show-labels").output;
    expect(out.split("\n")[0]).toMatch(/AGE\s+LABELS$/);
    expect(out).toMatch(/^a\s.*app=web,env=prod$/m);
    expect(exec(pods(), "kubectl get pods -A --show-labels").output.split("\n")[0]).toMatch(/^NAMESPACE\s+NAME.*LABELS$/);
  });
});

describe("label and annotate", () => {
  it("adds, refuses to overwrite without --overwrite, overwrites and removes labels", () => {
    let r = exec(pods(), "kubectl label pod a tier=frontend team=blue");
    expect(r.output).toBe("pod/a labeled");
    expect(find(r.c, "Pod", "default", "a")!.metadata.labels).toMatchObject({ tier: "frontend", team: "blue" });
    r = exec(r.c, "kubectl label pod a tier=backend");
    expect(r).toMatchObject({ error: true, output: "error: 'tier' already has a value (frontend), and --overwrite is false" });
    r = exec(r.c, "kubectl label pods/a tier=backend --overwrite", "kubectl label pod a team-");
    expect(find(r.c, "Pod", "default", "a")!.metadata.labels).toEqual({ app: "web", env: "prod", tier: "backend" });
  });

  it("validates keys and values", () => {
    for (const bad of ["kubectl label pod a Bad_=x", "kubectl label pod a k=has space", "kubectl label pod a 'k=has space'", "kubectl label pod a k=-x", "kubectl label pod a", "kubectl label pod a k", "kubectl label pod nope a=b"]) {
      expect(exec(pods(), bad).error, bad).toBe(true);
    }
    expect(exec(pods(), `kubectl label pod a k=${"x".repeat(64)}`).error).toBe(true);
    expect(exec(pods(), "kubectl label pod a example.com/tier=web_1.0").error).toBe(false);
  });

  it("annotates with free-form values", () => {
    let r = exec(pods(), `kubectl annotate pod a note="hello world, (any) text > here"`);
    expect(r.output).toBe("pod/a annotated");
    expect(find(r.c, "Pod", "default", "a")!.metadata.annotations.note).toBe("hello world, (any) text > here");
    expect(r.c.files).toEqual({});
    expect(exec(r.c, "kubectl describe pod a").output).toMatch(/Annotations:\s+note: hello world/);
    r = exec(r.c, "kubectl annotate pod a note-");
    expect(find(r.c, "Pod", "default", "a")!.metadata.annotations).toEqual({});
  });

  it("orphans a Pod whose labels stop matching and replaces it", () => {
    const c = createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }] });
    const victim = list(c, "Pod")[0].metadata.name;
    const r = exec(c, `kubectl label pod ${victim} app=debug --overwrite`);
    const rs = list(r.c, "ReplicaSet")[0];
    expect(find(r.c, "Pod", "default", victim)!.owner).toBeUndefined();
    expect(podsOf(r.c, rs)).toHaveLength(2);
    expect(list(r.c, "Pod")).toHaveLength(3);
    expect(exec(r.c, `kubectl describe pod ${victim}`).output).toMatch(/Controlled By:\s+<none>/);
  });

  it("gives Deployment Pods a pod-template-hash label", () => {
    const c = createCluster({ deployments: [{ name: "web", replicas: 1, image: "nginx:1.27", labels: { app: "web" } }] });
    const rs = list(c, "ReplicaSet")[0];
    expect(list(c, "Pod")[0].metadata.labels).toEqual({ app: "web", "pod-template-hash": rs.metadata.name.slice(4) });
  });
});

describe("quoting", () => {
  it("groups quoted words and keeps > inside quotes literal", () => {
    const r = exec(pods(), `kubectl annotate pod a 'msg=a > b' > out.txt`);
    expect(r.c.files["out.txt"]).toBe("pod/a annotated\n");
    expect(find(r.c, "Pod", "default", "a")!.metadata.annotations.msg).toBe("a > b");
    expect(exec(pods(), "kubectl get pods -l ''").error).toBe(true);
  });

  it("reports unterminated quotes", () => {
    const r = exec(pods(), `kubectl annotate pod a note="oops`);
    expect(r).toMatchObject({ error: true, output: 'error: unterminated quote ("), close it with a matching "' });
  });
});
