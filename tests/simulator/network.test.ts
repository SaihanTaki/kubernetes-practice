import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const deploy = (name: string, image: string, port: number, ns = "default", extra = "") => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: main
          image: ${image}
          ports:
            - containerPort: ${port}
${extra}---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  selector:
    app: ${name}
  ports:
    - port: ${port}
`;

/** api (example/api :8080), db (redis :6379) and a busybox client Pod, all running. */
function cluster(files: Record<string, string> = {}): Cluster {
  const c = createCluster({
    namespaces: ["other"],
    pods: [{ name: "client", image: "busybox:1.36", labels: { app: "client" } }],
    files: { "apps.yaml": deploy("api", "example/api:1.1", 8080) + "---\n" + deploy("db", "redis:7.2", 6379), ...files },
    apply: ["apps.yaml"],
  });
  return exec(c, "kubectl get pods").c;
}

const policy = (name: string, spec: string, ns = "default") => `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${name}
  namespace: ${ns}
spec:
${spec}`;

const apply = (c: Cluster, yaml: string) => exec({ ...c, files: { ...c.files, "x.yaml": yaml } }, "kubectl apply -f x.yaml");

describe("exec network clients", () => {
  it("wget and curl reach a Service by every DNS form", () => {
    const c = cluster();
    const body = /^\{"pod":"api-[a-z0-9]+-[a-z0-9]+","version":"1.1"\}$/;
    for (const host of ["api", "api.default", "api.default.svc", "api.default.svc.cluster.local"]) {
      expect(exec(c, `kubectl exec client -- wget -qO- -T 2 http://${host}:8080`).output).toMatch(body);
    }
    expect(exec(c, "kubectl exec client -- curl -s http://api:8080/api/orders").output).toMatch(body);
    const ip = exec(c, "kubectl get svc api").output.match(/10\.96\.\d+\.\d+/)![0];
    expect(exec(c, `kubectl exec client -- wget -qO- ${ip}:8080`).output).toMatch(body);
  });

  it("reaches a Pod by IP and by its dashed pod DNS name", () => {
    const c = cluster();
    const ip = exec(c, "kubectl get pods -o wide -l app=api").output.match(/10\.244\.\d+\.\d+/)![0];
    expect(exec(c, `kubectl exec client -- wget -qO- http://${ip}:8080/healthz`).error).toBe(false);
    expect(exec(c, `kubectl exec client -- wget -qO- http://${ip.replace(/\./g, "-")}.default.pod:8080/`).error).toBe(false);
  });

  it("prints busybox wget and curl failures with their exit codes", () => {
    const c = cluster();
    expect(exec(c, "kubectl exec client -- wget -qO- http://nope").output).toBe("wget: bad address 'nope'\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec client -- curl http://nope").output).toBe("curl: (6) Could not resolve host: nope\ncommand terminated with exit code 6");
    expect(exec(c, "kubectl exec client -- wget -qO- http://api:8080/missing").output).toBe("wget: server returned error: HTTP/1.1 404 Not Found\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec client -- curl -s http://api:8080/missing").output).toBe("404 page not found");
    // No such Service port: kube-proxy has no rule, so the packets go nowhere.
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:9999").output).toBe("wget: download timed out\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec client -- curl -m 2 http://api:9999").output).toBe("curl: (28) Connection timed out after 2001 milliseconds\ncommand terminated with exit code 28");
    expect(exec(c, "kubectl exec client -- curl -s -m 2 http://api:9999").output).toBe("command terminated with exit code 28");
    // A TCP server that does not speak HTTP.
    expect(exec(c, "kubectl exec client -- wget -qO- http://db:6379").output).toBe("wget: error getting response: Connection reset by peer\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec client -- curl http://db:6379").output).toBe("curl: (52) Empty reply from server\ncommand terminated with exit code 52");
  });

  it("refuses when the Service has no ready endpoints or the Pod does not listen", () => {
    let c = exec(cluster(), "kubectl scale deployment api --replicas=0", "kubectl get pods").c;
    expect(exec(c, "kubectl exec client -- wget -qO- http://api:8080").output).toMatch(/^wget: can't connect to remote host \(10\.96\.\d+\.\d+\): Connection refused\n/);
    c = cluster();
    const ip = exec(c, "kubectl get pods -o wide -l app=api").output.match(/10\.244\.\d+\.\d+/)![0];
    expect(exec(c, `kubectl exec client -- curl http://${ip}:80`).output).toBe(`curl: (7) Failed to connect to ${ip} port 80 after 0 ms: Couldn't connect to server\ncommand terminated with exit code 7`);
  });

  it("rotates over endpoints", () => {
    const c = exec(cluster(), "kubectl scale deployment api --replicas=2", "kubectl get pods", "kubectl get pods").c;
    const a = exec(c, "kubectl exec client -- wget -qO- http://api:8080");
    const b = exec(a.c, "kubectl exec client -- wget -qO- http://api:8080");
    expect(a.output).not.toBe(b.output);
  });

  it("prints progress without -q and saves to a file without -O -", () => {
    const c = cluster();
    let r = exec(c, "kubectl exec client -- wget -O- http://api:8080");
    expect(r.output).toMatch(/^Connecting to api:8080 \(10\.96\.\d+\.\d+:8080\)\nwriting to stdout\n\{"pod"/);
    r = exec(c, "kubectl exec client -- wget -q http://api:8080");
    expect(exec(r.c, "kubectl exec client -- cat /index.html").output).toMatch(/^\{"pod"/);
  });

  it("supports nslookup, hostname, env and printenv", () => {
    const c = exec(cluster(), "kubectl run late --image=busybox:1.36", "kubectl get pods").c;
    expect(exec(c, "kubectl exec client -- nslookup api").output).toMatch(/^Server:\t\t10\.96\.0\.10\nAddress:\t10\.96\.0\.10:53\n\nName:\tapi\.default\.svc\.cluster\.local\nAddress: 10\.96\.\d+\.\d+\n$/);
    expect(exec(c, "kubectl exec client -- nslookup nope").output).toMatch(/\*\* server can't find nope: NXDOMAIN\n\ncommand terminated with exit code 1$/);
    expect(exec(c, "kubectl exec client -- hostname").output).toBe("client");
    const env = exec(c, "kubectl exec late -- env").output.split("\n");
    expect(env).toContain("HOSTNAME=late");
    expect(env).toContain("KUBERNETES_SERVICE_HOST=10.96.0.1");
    expect(env.some((l) => /^API_SERVICE_HOST=10\.96\./.test(l))).toBe(true);
    // Service variables exist only for Services created before the Pod.
    expect(exec(c, "kubectl exec client -- env").output).not.toMatch(/API_SERVICE_HOST/);
    expect(exec(c, "kubectl exec late -- printenv HOSTNAME").output).toBe("late");
    expect(exec(c, "kubectl exec late -- printenv NOPE")).toMatchObject({ error: true, output: "command terminated with exit code 1" });
    expect(exec(c, "kubectl exec late -- sh -c 'printenv HOSTNAME > /tmp/h'", "kubectl exec late -- cat /tmp/h").output).toBe("late");
  });

  it("resolves env from ConfigMaps and Secrets", () => {
    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: cfg
data:
  MODE: fast
---
apiVersion: v1
kind: Secret
metadata:
  name: sec
stringData:
  TOKEN: abc
---
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: nginx:1.27
      envFrom:
        - configMapRef:
            name: cfg
          prefix: CFG_
      env:
        - name: TOKEN
          valueFrom:
            secretKeyRef:
              name: sec
              key: TOKEN
`;
    const c = exec(apply(createCluster(), yaml).c, "kubectl get pods").c;
    const env = exec(c, "kubectl exec app -- env").output.split("\n");
    expect(env).toEqual(expect.arrayContaining(["CFG_MODE=fast", "TOKEN=abc"]));
    expect(check(c, { kind: "env-value", podName: "app", envName: "TOKEN", expectedValue: "abc" })).toBe(true);
    expect(check(c, { kind: "env-value", podName: "app", envName: "MODE", expectedValue: null })).toBe(true);
    expect(check(c, { kind: "env-value", podName: "nope", envName: "MODE", expectedValue: null })).toBe(false);
  });

  it("resolves StatefulSet Pods through their headless Service", () => {
    const yaml = `apiVersion: v1
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
  replicas: 2
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
`;
    const c = exec(apply(cluster(), yaml).c, ...Array(6).fill("kubectl get pods")).c;
    expect(exec(c, "kubectl exec client -- wget -qO- http://web-1.web").output).toMatch(/Welcome to nginx!/);
    expect(exec(c, "kubectl exec client -- nslookup web").output.match(/Address: /g)).toHaveLength(2);
    expect(exec(c, "kubectl exec client -- wget -qO- http://web-7.web").output).toMatch(/^wget: bad address 'web-7.web'/);
  });

  it("rejects unsupported options", () => {
    const c = cluster();
    expect(exec(c, "kubectl exec client -- wget -x http://api").output).toMatch(/^wget: unrecognized option '-x'/);
    expect(exec(c, "kubectl exec client -- curl --proxy x http://api").output).toMatch(/^curl: option --proxy: is unknown/);
  });
});

describe("NetworkPolicy", () => {
  const denyAll = policy("deny", "  podSelector: {}\n  policyTypes: [Ingress]\n");
  const allowClient = policy(
    "allow-client",
    "  podSelector:\n    matchLabels:\n      app: api\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              app: client\n      ports:\n        - port: 8080\n",
  );

  it("isolates selected Pods and allows matching sources and ports", () => {
    let c = apply(cluster(), denyAll).c;
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:8080").output).toBe("wget: download timed out\ncommand terminated with exit code 1");
    c = apply(c, allowClient).c;
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:8080").error).toBe(false);
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://db:6379").output).toMatch(/download timed out/);
    const http = (expectedStatus: 200 | "timeout" | "connected", url: string) =>
      check(c, { kind: "http-get", fromPod: "client", url, expectedStatus });
    expect(http(200, "http://api:8080")).toBe(true);
    expect(http("connected", "http://api:8080")).toBe(true);
    expect(http("timeout", "http://db:6379")).toBe(true);
    expect(check(c, { kind: "http-get", fromOwnerType: "Deployment", fromOwnerName: "api", url: "http://db:6379", expectedStatus: "timeout" })).toBe(true);
  });

  it("checks egress on the source and needs a DNS rule once egress is restricted", () => {
    const egress = (rules: string) => policy("client-egress", `  podSelector:\n    matchLabels:\n      app: client\n  policyTypes: [Egress]\n  egress:\n${rules}`);
    const toApi = "    - to:\n        - podSelector:\n            matchLabels:\n              app: api\n";
    let c = apply(cluster(), egress(toApi)).c;
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:8080").output).toMatch(/^wget: bad address 'api'/);
    expect(exec(c, "kubectl exec client -- nslookup api").output).toMatch(/^;; connection timed out; no servers could be reached/);
    const ip = exec(c, "kubectl get svc api").output.match(/10\.96\.\d+\.\d+/)![0];
    expect(exec(c, `kubectl exec client -- wget -qO- -T 2 http://${ip}:8080`).error).toBe(false);
    const dns = "    - to:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: kube-system\n          podSelector:\n            matchLabels:\n              k8s-app: kube-dns\n      ports:\n        - protocol: UDP\n          port: 53\n";
    c = apply(c, egress(toApi + dns)).c;
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:8080").error).toBe(false);
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://db:6379").output).toMatch(/download timed out/);
  });

  it("matches namespaceSelector (AND with podSelector), labelled namespaces and ipBlock", () => {
    const fromOther = policy(
      "from-other",
      "  podSelector:\n    matchLabels:\n      app: api\n  ingress:\n    - from:\n        - namespaceSelector:\n            matchLabels:\n              team: ops\n          podSelector:\n            matchLabels:\n              app: probe\n",
    );
    let c = apply(cluster(), fromOther).c;
    c = exec(c, "kubectl run probe -n other --image=busybox:1.36 --dry-run=client -o yaml > p.yaml").c;
    c = exec({ ...c, files: { ...c.files, "p.yaml": c.files["p.yaml"].replace("run: probe", "app: probe") } }, "kubectl apply -f p.yaml", "kubectl get pods -n other").c;
    const call = (cc: Cluster) => exec(cc, "kubectl exec probe -n other -- wget -qO- -T 2 http://api.default:8080");
    expect(call(c).output).toMatch(/download timed out/);
    c = exec(c, "kubectl label namespace other team=ops").c;
    expect(call(c).error).toBe(false);
    expect(exec(c, "kubectl exec client -- wget -qO- -T 2 http://api:8080").output).toMatch(/download timed out/);
    expect(exec(c, "kubectl get ns other --show-labels").output).toMatch(/team=ops,kubernetes\.io\/metadata\.name=other/);

    const byIp = policy("by-ip", "  podSelector:\n    matchLabels:\n      app: db\n  ingress:\n    - from:\n        - ipBlock:\n            cidr: 10.244.0.0/16\n            except:\n              - 10.244.2.0/24\n");
    c = apply(cluster(), byIp).c;
    const clientIp = exec(c, "kubectl get pod client -o wide").output.match(/10\.244\.(\d+)\.\d+/)!;
    const result = exec(c, "kubectl exec client -- curl -s -m 1 http://db:6379");
    expect(result.output).toBe(clientIp[1] === "2" ? "command terminated with exit code 28" : "command terminated with exit code 52");
  });

  it("lists and describes policies in the real format", () => {
    const c = apply(cluster(), `${denyAll}---\n${allowClient}`).c;
    expect(exec(c, "kubectl get netpol").output).toMatch(/^NAME\s+POD-SELECTOR\s+AGE\ndeny\s+<none>\s+\d+s\nallow-client\s+app=api\s+\d+s$/);
    expect(exec(c, "kubectl describe networkpolicy allow-client").output).toMatch(
      /Spec:\n {2}PodSelector: {5}app=api\n {2}Allowing ingress traffic:\n {4}To Port: 8080\/TCP\n {4}From:\n {6}PodSelector: app=client\n {2}Not affecting egress traffic\n {2}Policy Types: Ingress/,
    );
    expect(exec(c, "kubectl describe netpol deny").output).toMatch(/PodSelector: {5}<none> \(Allowing the specific traffic to all pods in this namespace\)\n {2}Allowing ingress traffic:\n {4}<none> \(Selected pods are isolated for ingress connectivity\)/);
    expect(exec(c, "kubectl get netpol deny -o yaml").output).toMatch(/policyTypes:\n {4}- Ingress/);
  });

  it("validates policies", () => {
    const bad = policy("bad", "  podSelector: {}\n  ingress:\n    - from:\n        - ipBlock:\n            cidr: 10.0.0.0/8\n          podSelector: {}\n");
    expect(apply(cluster(), bad).output).toMatch(/must specify ipBlock alone/);
  });
});
