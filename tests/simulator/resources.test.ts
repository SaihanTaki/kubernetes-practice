import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, find, list, run, type Cluster } from "@/lib/simulator";
import { formatCpu, formatMemory, parseCpu, parseMemory } from "@/lib/simulator/quantity";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const resources = (requests = "", limits = "") =>
  [
    "      resources:",
    ...(requests ? ["        requests:", ...requests.split(",").map((kv) => `          ${kv.replace("=", ": ")}`)] : []),
    ...(limits ? ["        limits:", ...limits.split(",").map((kv) => `          ${kv.replace("=", ": ")}`)] : []),
  ].join("\n");

const pod = (name: string, image = "nginx:1.27", res = "") => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
spec:
  containers:
    - name: ${name}
      image: ${image}
${res}
`;

const deployment = (name: string, replicas: number, res = "") => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: nginx:1.27
${res.replace(/^/gm, "    ")}
`;

const withFiles = (files: Record<string, string>, c: Cluster = createCluster()) => ({ ...c, files: { ...c.files, ...files } });
const applyYaml = (yaml: string, c?: Cluster) => exec(withFiles({ "x.yaml": yaml }, c), "kubectl apply -f x.yaml");

describe("quantities", () => {
  it.each([
    ["250m", 250],
    ["0.5", 500],
    ["1", 1000],
    [".1", 100],
    ["1.5", 1500],
  ])("cpu %s is %d millicores", (q, n) => expect(parseCpu(q)).toBe(n));

  it.each([
    ["128Mi", 128 * 2 ** 20],
    ["1Gi", 2 ** 30],
    ["500M", 500e6],
    ["1000", 1000],
    ["1.5Gi", 1.5 * 2 ** 30],
  ])("memory %s is %d bytes", (q, n) => expect(parseMemory(q)).toBe(n));

  it.each(["", "abc", "1x", "-1", "1.5m", "1 Gi", "1gi"])("rejects %j", (q) => {
    expect(parseCpu(q) === null || parseMemory(q) === null).toBe(true);
    expect(parseMemory(q)).toBeNull();
  });

  it("formats canonically", () => {
    expect([formatCpu(500), formatCpu(2000), formatMemory(2 ** 30), formatMemory(1536 * 2 ** 20), formatMemory(500e6), formatMemory(0)]).toEqual([
      "500m", "2", "1Gi", "1536Mi", "500M", "0",
    ]);
  });

  it("rejects invalid or inverted resources on apply", () => {
    const bad = (res: string) => applyYaml(pod("x", "nginx", res));
    expect(bad(resources("cpu=lots")).output).toMatch(/quantities must match the regular expression/);
    expect(bad(resources("memory=1gb")).error).toBe(true);
    expect(bad(resources("", "gpu=1")).output).toMatch(/Unrecognized key/);
    expect(bad(resources("cpu=2", "cpu=1")).output).toMatch(/must be less than or equal to cpu limit of 1/);
    expect(bad(resources("cpu=1", "cpu=1000m")).error).toBe(false);
  });

  it("accepts YAML numbers for cpu", () => {
    const r = applyYaml(pod("x", "nginx", resources("cpu=0.5")));
    expect(find(r.c, "Pod", "default", "x")!.container.resources).toEqual({ requests: { cpu: "0.5" } });
  });
});

describe("QoS class", () => {
  const qos = (res: string) => {
    const r = applyYaml(pod("x", "nginx", res));
    return [exec(r.c, "kubectl describe pod x").output.match(/^QoS Class:\s+(\S+)$/m)?.[1], parseYaml(exec(r.c, "kubectl get pod x -o yaml").output).status.qosClass];
  };
  it.each([
    ["", "BestEffort"],
    [resources("cpu=100m"), "Burstable"],
    [resources("cpu=1,memory=1Gi", "cpu=1,memory=1Gi"), "Guaranteed"],
    [resources("", "cpu=1,memory=1Gi"), "Guaranteed"],
    [resources("cpu=500m,memory=1Gi", "cpu=1,memory=1Gi"), "Burstable"],
    [resources("", "memory=1Gi"), "Burstable"],
  ])("%j is %s", (res, expected) => expect(qos(res)).toEqual([expected, expected]));

  it("defaults requests to limits and shows both in describe", () => {
    const r = applyYaml(pod("x", "nginx", resources("", "memory=256Mi")));
    expect(find(r.c, "Pod", "default", "x")!.container.resources).toEqual({ limits: { memory: "256Mi" }, requests: { memory: "256Mi" } });
    expect(exec(r.c, "kubectl describe pod x").output).toContain("Limits:\n  memory:  256Mi\nRequests:\n  memory:  256Mi");
  });
});

describe("OOM kills", () => {
  it("kills a container whose limit is below the image's memory use", () => {
    let r = applyYaml(pod("hog", "example/memhog:1.0", resources("", "memory=256Mi")));
    const states: string[] = [];
    for (let i = 0; i < 5; i++) {
      r = exec(r.c, "kubectl get pods");
      const p = find(r.c, "Pod", "default", "hog")!;
      states.push(`${p.status}:${p.restarts}`);
    }
    expect(states).toEqual(["OOMKilled:0", "OOMKilled:1", "OOMKilled:2", "CrashLoopBackOff:3", "CrashLoopBackOff:4"]);
    expect(r.output).toMatch(/hog\s+0\/1\s+CrashLoopBackOff\s+3/);
    const out = exec(r.c, "kubectl describe pod hog").output;
    expect(out).toContain("Last State:     Terminated\n  Reason:       OOMKilled\n  Exit Code:    137");
    expect(out).toMatch(/^Status:\s+Running$/m);
  });

  it("runs memhog with enough memory and other images within small limits", () => {
    const ok = exec(applyYaml(pod("hog", "example/memhog:1.0", resources("", "memory=768Mi"))).c, "kubectl get pods", "kubectl get pods");
    expect(find(ok.c, "Pod", "default", "hog")).toMatchObject({ status: "Running", ready: true, restarts: 0 });
    const nginx = exec(applyYaml(pod("web", "nginx", resources("", "memory=32Mi"))).c, "kubectl get pods");
    expect(find(nginx.c, "Pod", "default", "web")!.status).toBe("Running");
    const small = exec(applyYaml(pod("web", "nginx", resources("", "memory=16Mi"))).c, "kubectl get pods");
    expect(find(small.c, "Pod", "default", "web")!.status).toBe("OOMKilled");
  });

  it("ages fixture OOM loops like other crash loops", () => {
    const c = createCluster({ files: { "x.yaml": pod("hog", "example/memhog:1.0", resources("", "memory=100Mi")) }, apply: ["x.yaml"] });
    expect(find(c, "Pod", "default", "hog")).toMatchObject({ status: "CrashLoopBackOff", restarts: 6 });
  });
});

describe("top", () => {
  const c = () =>
    exec(
      withFiles({ "x.yaml": pod("hog", "example/memhog:1.0") }, createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }] })),
      "kubectl apply -f x.yaml",
      "kubectl get pods",
    ).c;

  it("shows Pod usage from the image catalogue", () => {
    const out = exec(c(), "kubectl top pods").output;
    expect(out.split("\n")[0]).toMatch(/^NAME\s+CPU\(cores\)\s+MEMORY\(bytes\)$/);
    expect(out).toMatch(/^hog\s+50m\s+600Mi$/m);
    expect(out).toMatch(/^web-\S+\s+[1-5]m\s+20Mi$/m);
    expect(exec(c(), "kubectl top pods -A").output.split("\n")[0]).toMatch(/^NAMESPACE\s+NAME/);
    expect(exec(c(), "kubectl top pod hog").output.split("\n")).toHaveLength(2);
    expect(exec(c(), "kubectl top pods -n other").output).toBe("No resources found in other namespace.");
  });

  it("shows node usage with percentages of allocatable", () => {
    const out = exec(c(), "kubectl top nodes").output;
    expect(out.split("\n")[0]).toMatch(/^NAME\s+CPU\(cores\)\s+CPU\(%\)\s+MEMORY\(bytes\)\s+MEMORY\(%\)$/);
    expect(out).toMatch(/^control-plane\s+150m\s+7%\s+900Mi\s+43%$/m);
    expect(out).toMatch(/^worker-\d\s+\d+m\s+\d+%\s+1\d{3}Mi\s+2\d%$/m);
    expect(exec(c(), "kubectl top widgets").error).toBe(true);
  });
});

const limitRange = `apiVersion: v1
kind: LimitRange
metadata:
  name: mem
spec:
  limits:
    - type: Container
      default:
        memory: 512Mi
      defaultRequest:
        memory: 256Mi
      max:
        memory: 1Gi
      min:
        memory: 64Mi
`;

describe("LimitRange", () => {
  const withLimits = () => applyYaml(limitRange).c;

  it("lists and describes limit ranges", () => {
    const c = withLimits();
    expect(exec(c, "kubectl get limits").output).toMatch(/^NAME\s+CREATED AT\nmem\s+2026-01-15T10:00:00Z$/);
    const out = exec(c, "kubectl describe limitrange mem").output;
    expect(out).toMatch(/^Type\s+Resource\s+Min\s+Max\s+Default Request\s+Default Limit\s+Max Limit\/Request Ratio$/m);
    expect(out).toMatch(/^Container\s+memory\s+64Mi\s+1Gi\s+256Mi\s+512Mi\s+-$/m);
  });

  it("fills in missing requests and limits", () => {
    const r = applyYaml(pod("x"), withLimits());
    expect(find(r.c, "Pod", "default", "x")!.container.resources).toEqual({ limits: { memory: "512Mi" }, requests: { memory: "256Mi" } });
  });

  it("defaults the default limit from max and the request from the limit", () => {
    const lr = limitRange.replace(/ {6}default:\n {8}memory: 512Mi\n {6}defaultRequest:\n {8}memory: 256Mi\n/, "");
    const r = applyYaml(pod("x"), applyYaml(lr).c);
    expect(find(r.c, "Pod", "default", "x")!.container.resources).toEqual({ limits: { memory: "1Gi" }, requests: { memory: "1Gi" } });
  });

  it("rejects out-of-range Pods with the real message", () => {
    const r = applyYaml(pod("x", "nginx", resources("", "memory=2Gi")), withLimits());
    expect(r.error).toBe(true);
    expect(r.output).toBe('Error from server (Forbidden): error when creating "x.yaml": pods "x" is forbidden: maximum memory usage per Container is 1Gi, but limit is 2Gi');
    expect(find(r.c, "Pod", "default", "x")).toBeUndefined();
    const low = applyYaml(pod("x", "nginx", resources("memory=32Mi")), withLimits());
    expect(low.output).toContain("minimum memory usage per Container is 64Mi, but request is 32Mi");
    const both = applyYaml(pod("x", "nginx", resources("memory=32Mi", "memory=2Gi")), withLimits());
    expect(both.output).toContain("is forbidden: [minimum memory usage per Container is 64Mi, but request is 32Mi, maximum memory usage per Container is 1Gi, but limit is 2Gi]");
    const run1 = exec(withLimits(), "kubectl run ok --image=nginx");
    expect(run1.error).toBe(false);
  });

  it("turns a controller rejection into a FailedCreate event and no Pod", () => {
    let r = applyYaml(deployment("api", 2, resources("", "memory=2Gi")), withLimits());
    expect(r.error).toBe(false);
    r = exec(r.c, "kubectl get pods");
    expect(list(r.c, "Pod")).toHaveLength(0);
    const rs = list(r.c, "ReplicaSet")[0].metadata.name;
    const out = exec(r.c, `kubectl describe rs ${rs}`).output;
    expect(out).toMatch(new RegExp(`Warning\\s+FailedCreate\\s+.*replicaset-controller\\s+Error creating: pods "${rs}-\\w{5}" is forbidden: maximum memory usage per Container is 1Gi, but limit is 2Gi`));
    expect(out).toMatch(/\(x\d+ over/);
    expect(exec(r.c, "kubectl get events").output).toContain("FailedCreate");
  });

  it("keeps generated Pod names as before Part A", () => {
    let c = createCluster({
      deployments: [{ name: "web", replicas: 3, image: "nginx:1.27", labels: { app: "web" } }],
      replicaSets: [{ name: "front", replicas: 2, image: "nginx", labels: { app: "front" } }],
    });
    c = exec(c, "kubectl scale deploy web --replicas=5", "kubectl set image deployment/web nginx=nginx:1.28", "kubectl get pods").c;
    expect(list(c, "Pod").map((p) => p.metadata.name)).toEqual([
      "front-87lt9", "front-wh7gc", "web-gltrkplcdg-rwc8v", "web-xbqvjdztdz-kvwdv",
      "web-xbqvjdztdz-th2kb", "web-xbqvjdztdz-rpr76", "web-xbqvjdztdz-4cw55", "web-xbqvjdztdz-df8kf",
    ]);
  });
});

const quota = (hard: string) => `apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute
spec:
  hard:
${hard.split(",").map((kv) => `    ${kv.replace("=", ": ")}`).join("\n")}
`;

describe("ResourceQuota", () => {
  it("creates a quota imperatively and shows live usage", () => {
    let r = exec(createCluster({ pods: [{ name: "a", image: "nginx" }] }), "kubectl create quota compute --hard=pods=3,configmaps=2,limits.memory=2Gi");
    expect(r.output).toBe("resourcequota/compute created");
    r = exec(r.c, "kubectl get quota");
    expect(r.output).toMatch(/^NAME\s+AGE\s+REQUEST\s+LIMIT$/m);
    expect(r.output).toMatch(/^compute\s+\S+\s+configmaps: 0\/2, pods: 1\/3\s+limits\.memory: 0\/2Gi$/m);
    const out = exec(r.c, "kubectl describe quota compute").output;
    expect(out).toMatch(/^Resource\s+Used\s+Hard\n-+\s+-+\s+-+\nconfigmaps\s+0\s+2\nlimits\.memory\s+0\s+2Gi\npods\s+1\s+3$/m);
    expect(parseYaml(exec(r.c, "kubectl get quota compute -o yaml").output).status.used).toEqual({ configmaps: "0", "limits.memory": "0", pods: "1" });
  });

  it.each([
    ["kubectl create quota q", "required flag --hard"],
    ["kubectl create quota q --hard=bogus=1", 'invalid --hard "bogus=1"'],
    ["kubectl create quota q --hard=pods=lots", 'invalid --hard "pods=lots"'],
    ["kubectl create quota q --hard=requests.cpu=1x", "invalid --hard"],
    ["kubectl create configmap q --hard=pods=1", "--hard is only supported"],
  ])("rejects %s", (cmd, message) => {
    const r = exec(createCluster(), cmd);
    expect(r.error).toBe(true);
    expect(r.output).toContain(message);
  });

  it("rejects Pods over the count with the real message", () => {
    const r = exec(createCluster(), "kubectl create quota compute --hard=pods=2", "kubectl run a --image=nginx", "kubectl run b --image=nginx", "kubectl run c --image=nginx");
    expect(r.error).toBe(true);
    expect(r.output).toBe('Error from server (Forbidden): pods "c" is forbidden: exceeded quota: compute, requested: pods=1, used: pods=2, limited: pods=2');
  });

  it("requires compute values once the quota sets them", () => {
    const c = applyYaml(quota("requests.cpu=1,limits.memory=1Gi")).c;
    const r = applyYaml(pod("x"), c);
    expect(r.output).toBe('Error from server (Forbidden): error when creating "x.yaml": pods "x" is forbidden: failed quota: compute: must specify limits.memory for: x; requests.cpu for: x');
    const over = applyYaml(pod("x", "nginx", resources("cpu=2", "memory=512Mi")), c);
    expect(over.output).toContain("exceeded quota: compute, requested: requests.cpu=2, used: requests.cpu=0, limited: requests.cpu=1");
    const ok = applyYaml(pod("x", "nginx", resources("cpu=500m", "memory=512Mi")), c);
    expect(ok.error).toBe(false);
    expect(exec(ok.c, "kubectl describe quota compute").output).toMatch(/^limits\.memory\s+512Mi\s+1Gi\nrequests\.cpu\s+500m\s+1$/m);
  });

  it("counts other kinds and records FailedCreate for controller Pods", () => {
    let r = exec(createCluster(), "kubectl create quota objs --hard=count/deployments.apps=1,services=0,pods=2");
    r = exec(r.c, "kubectl create deployment a --image=nginx --replicas=3", "kubectl create deployment b --image=nginx");
    expect(r.output).toBe('Error from server (Forbidden): deployments.apps "b" is forbidden: exceeded quota: objs, requested: count/deployments.apps=1, used: count/deployments.apps=1, limited: count/deployments.apps=1');
    expect(exec(r.c, "kubectl expose deployment a --port=80").output).toContain("exceeded quota: objs, requested: services=1, used: services=0, limited: services=0");
    r = exec(r.c, "kubectl get pods");
    expect(list(r.c, "Pod")).toHaveLength(2);
    expect(exec(r.c, "kubectl get events --field-selector reason=FailedCreate").output).toContain("exceeded quota: objs, requested: pods=1, used: pods=2, limited: pods=2");
  });

  it("validates quota manifests", () => {
    expect(applyYaml(quota("pods=3,widgets=1")).output).toMatch(/unsupported quota key/);
    expect(applyYaml(quota("requests.memory=lots")).output).toMatch(/quantities must match/);
    expect(applyYaml(quota("pods=3")).output).toBe("resourcequota/compute created");
  });
});

describe("generic verbs on the new kinds", () => {
  it.each([
    ["limitrange", "limits", "mem", limitRange],
    ["resourcequota", "quota", "compute", quota("pods=3")],
  ])("%s works with get, label, annotate, describe and delete", (type, alias, name, yaml) => {
    let r = exec(withFiles({ "x.yaml": yaml }), "kubectl apply -f x.yaml", `kubectl label ${alias} ${name} team=a`, `kubectl annotate ${type} ${name} note=x`);
    expect(r.error).toBe(false);
    expect(exec(r.c, `kubectl get ${alias} --show-labels`).output).toMatch(/LABELS\n.*team=a$/);
    expect(exec(r.c, `kubectl get ${alias} -l team=b`).output).toBe("No resources found in default namespace.");
    expect(parseYaml(exec(r.c, `kubectl get ${alias}/${name} -o yaml`).output).metadata.annotations).toEqual({ note: "x" });
    expect(exec(r.c, `kubectl get ${alias} -A`).output.split("\n")[0]).toMatch(/^NAMESPACE\s+NAME/);
    expect(exec(r.c, `kubectl apply -f x.yaml`).output).toMatch(/configured$/);
    expect(exec(r.c, `kubectl describe ${alias} ${name}`).error).toBe(false);
    r = exec(r.c, `kubectl delete ${alias} ${name}`);
    expect(r.output).toBe(`${type} "${name}" deleted`);
    expect(exec(r.c, `kubectl get ${alias}`).output).toBe("No resources found in default namespace.");
  });
});
