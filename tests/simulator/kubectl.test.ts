import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, list, run, type Cluster } from "@/lib/simulator";

const web = () =>
  createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }] });

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

describe("fixtures", () => {
  it("creates a ReplicaSet and running Pods for a Deployment", () => {
    const c = web();
    expect(list(c, "ReplicaSet")).toHaveLength(1);
    expect(list(c, "Pod").map((p) => p.status)).toEqual(["Running", "Running"]);
  });

  it("is deterministic", () => {
    expect(web()).toEqual(web());
  });
});

describe("get", () => {
  it("lists pods as a table", () => {
    const { output, error } = exec(web(), "kubectl get pods");
    expect(error).toBe(false);
    expect(output.split("\n")[0]).toMatch(/^NAME\s+READY\s+STATUS\s+RESTARTS\s+AGE$/);
    expect(output.split("\n")).toHaveLength(3);
    expect(output).toContain("1/1");
  });

  it("supports aliases, name/slash form and -o yaml", () => {
    const { output } = exec(web(), "kubectl get deploy/web -o yaml");
    const doc = parseYaml(output);
    expect(doc.kind).toBe("Deployment");
    expect(doc.spec.replicas).toBe(2);
    expect(doc.spec.selector.matchLabels).toEqual({ app: "web" });
  });

  it("reports empty namespaces and missing resources", () => {
    expect(exec(web(), "kubectl get pods -n other").output).toBe("No resources found in other namespace.");
    const missing = exec(web(), "kubectl get pod nope");
    expect(missing.error).toBe(true);
    expect(missing.output).toBe('Error from server (NotFound): pods "nope" not found');
  });

  it("filters by label selector", () => {
    const c = createCluster({
      pods: [
        { name: "a", image: "busybox", labels: { tier: "x" } },
        { name: "b", image: "busybox", labels: { tier: "y" } },
      ],
    });
    const { output } = exec(c, "kubectl get pods -l tier=y");
    expect(output).toContain("b ");
    expect(output).not.toMatch(/^a /m);
  });

  it("adds a NAMESPACE column with -A", () => {
    expect(exec(web(), "kubectl get rs -A").output.split("\n")[0]).toMatch(/^NAMESPACE\s+NAME/);
  });
});

describe("scale", () => {
  it("shows desired before observed state, then settles", () => {
    let r = exec(web(), "kubectl scale deployment web --replicas=4");
    expect(r.output).toBe("deployment.apps/web scaled");

    r = exec(r.c, "kubectl get deployments");
    expect(r.output).toMatch(/web\s+2\/4\s+4\s+2/);
    expect(r.c.resources.filter((x) => x.kind === "Pod" && x.status === "Running")).toHaveLength(4);

    r = exec(r.c, "kubectl get deployments");
    expect(r.output).toMatch(/web\s+4\/4\s+4\s+4/);
  });

  it("scales down by removing pods", () => {
    const { c } = exec(web(), "kubectl scale deploy web --replicas 0");
    expect(list(c, "Pod")).toHaveLength(0);
  });

  it("lets the Deployment override manual scaling of its ReplicaSet", () => {
    const rs = list(web(), "ReplicaSet")[0].metadata.name;
    const { c, output } = exec(web(), `kubectl scale rs ${rs} --replicas=5`);
    expect(output).toBe(`replicaset.apps/${rs} scaled`);
    expect(list(c, "ReplicaSet")[0].replicas).toBe(2);
  });

  it("scales a standalone ReplicaSet", () => {
    const c = createCluster({ replicaSets: [{ name: "front", replicas: 2, image: "nginx", labels: { app: "front" } }] });
    expect(list(exec(c, "kubectl scale replicaset front --replicas=5").c, "Pod")).toHaveLength(5);
  });

  it("validates the replica count", () => {
    expect(exec(web(), "kubectl scale deploy web --replicas=-1").error).toBe(true);
    expect(exec(web(), "kubectl scale deploy web --replicas=abc").error).toBe(true);
    expect(exec(web(), "kubectl scale deploy web --replicas=99").error).toBe(true);
    expect(exec(web(), "kubectl scale deploy web").error).toBe(true);
    expect(exec(web(), "kubectl scale pod x --replicas=2").error).toBe(true);
  });
});

describe("delete", () => {
  it("recreates a managed pod", () => {
    const victim = list(web(), "Pod")[0].metadata.name;
    const { c, output } = exec(web(), `kubectl delete pod ${victim}`);
    expect(output).toBe(`pod "${victim}" deleted`);
    const pods = list(c, "Pod");
    expect(pods).toHaveLength(2);
    expect(pods.map((p) => p.metadata.name)).not.toContain(victim);
  });

  it("does not recreate an unmanaged pod", () => {
    const c = createCluster({ pods: [{ name: "solo", image: "busybox" }] });
    expect(list(exec(c, "kubectl delete pod solo").c, "Pod")).toHaveLength(0);
  });

  it("cascades a Deployment delete to its ReplicaSet and Pods", () => {
    const { c } = exec(web(), "kubectl delete deployment web");
    expect(c.resources.filter((r) => r.kind !== "StorageClass")).toHaveLength(0);
  });
});

describe("describe", () => {
  it("shows the owner chain", () => {
    const pod = list(web(), "Pod")[0].metadata.name;
    expect(exec(web(), `kubectl describe pod ${pod}`).output).toMatch(/Controlled By:\s+ReplicaSet\/web-/);
    expect(exec(web(), "kubectl describe deployment web").output).toMatch(/Replicas:\s+2 desired/);
  });
});

describe("bad input", () => {
  it.each([
    "",
    "ls -la",
    "rm -rf /",
    "kubectl",
    "kubectl apply -f x.yaml",
    "kubectl get",
    "kubectl get widgets",
    "kubectl get pods --bogus",
    "kubectl get pods -o",
    "kubectl get pods -o json",
    "kubectl get pod BAD_NAME",
    "kubectl get pods extra args",
    "kubectl describe pod",
    "kubectl get pods -l nope",
    "kubectl delete rs x",
    "kubectl get pods -n ../etc",
    "kubectl $(whoami)",
  ])("never throws for %j", (input) => {
    expect(() => run(web(), input)).not.toThrow();
  });

  it("explains unsupported commands", () => {
    const r = exec(web(), "kubectl attach web");
    expect(r.error).toBe(true);
    expect(r.output).toContain("kubectl help");
  });

  it("does not mutate the input cluster", () => {
    const c = web();
    const before = structuredClone(c);
    run(c, "kubectl scale deploy web --replicas=5");
    expect(c).toEqual(before);
  });
});

describe("pod phase", () => {
  it("reports Running for a crash-looping Pod and Pending while creating", () => {
    const c = createCluster({ pods: [{ name: "bad", image: "busybox", status: "CrashLoopBackOff", restarts: 6 }] });
    const out = exec(c, "kubectl describe pod bad").output;
    expect(out).toMatch(/Status:\s+Running/);
    expect(out).toMatch(/Waiting \(reason: CrashLoopBackOff\)/);
    const scaled = exec(web(), "kubectl scale deploy web --replicas=3").c;
    const pending = list(scaled, "Pod").find((p) => p.status === "ContainerCreating")!;
    expect(exec(scaled, `kubectl describe pod ${pending.metadata.name}`).output).toMatch(/Status:\s+Pending/);
  });
});
