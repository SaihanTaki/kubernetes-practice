import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const app = (name: string, image: string, port: number, targetPort = port) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
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
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  selector:
    app: ${name}
  ports:
    - name: http
      port: 80
      targetPort: ${targetPort}
`;

const ingress = (spec: string, name = "shop") => `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
spec:
${spec}`;

const rule = (path: string, service: string, pathType = "Prefix") =>
  `          - path: ${path}\n            pathType: ${pathType}\n            backend:\n              service:\n                name: ${service}\n                port:\n                  number: 80\n`;

const SHOP = ingress(`  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
${rule("/api", "api")}${rule("/", "web")}${rule("/exact", "api", "Exact")}`);

function cluster(yaml = SHOP, extra = ""): Cluster {
  const c = createCluster({
    files: { "apps.yaml": `${app("web", "nginx:1.27", 80)}---\n${app("api", "example/api:1.1", 8080)}${extra}`, "ing.yaml": yaml },
    apply: ["apps.yaml", "ing.yaml"],
  });
  return exec(c, "kubectl get pods").c;
}

const apply = (c: Cluster, yaml: string) => exec({ ...c, files: { ...c.files, "x.yaml": yaml } }, "kubectl apply -f x.yaml");

describe("Ingress", () => {
  it("routes by host and the longest Prefix, with Exact above Prefix", () => {
    const c = cluster();
    expect(exec(c, "curl http://shop.example.com/").output).toMatch(/<title>Welcome to nginx!<\/title>/);
    expect(exec(c, "curl http://shop.example.com/api/orders").output).toMatch(/^\{"pod":"api-/);
    // /apis is not under /api, so it goes to web, where nginx has no such page.
    expect(exec(c, "curl -i http://shop.example.com/apis").output).toMatch(/^HTTP\/1\.1 404 Not Found\nServer: nginx\/1\.27\.0\n/);
    expect(exec(c, "curl http://shop.example.com/exact").output).toMatch(/^404 page not found$/);
    expect(exec(c, "curl -H 'Host: shop.example.com' http://192.0.2.10/api").output).toMatch(/^\{"pod":"api-/);
    expect(exec(c, "curl -i http://shop.example.com/api").output).toMatch(/^HTTP\/1\.1 200 OK\n/);
  });

  it("answers 404 for no match, fails DNS for unknown hosts and times out other IPs", () => {
    const c = cluster();
    expect(exec(c, "curl http://192.0.2.10/").output).toMatch(/<title>404 Not Found<\/title>[\s\S]*<center>nginx<\/center>/);
    expect(exec(c, "curl http://other.example.com/")).toMatchObject({ error: true, output: "curl: (6) Could not resolve host: other.example.com" });
    expect(exec(c, "curl -m 3 http://10.96.0.1/").output).toBe("curl: (28) Connection timed out after 3001 milliseconds");
    expect(exec(c, "curl -s http://other.example.com/")).toMatchObject({ error: true, output: "" });
    expect(exec(c, "wget http://shop.example.com/").output).toMatch(/^command not found: wget/);
  });

  it("answers 503 without a Service or endpoints and 502 when the Pod refuses", () => {
    let c = cluster(SHOP.replace("name: api\n", "name: apii\n"));
    expect(exec(c, "curl http://shop.example.com/api").output).toMatch(/<title>503 Service Temporarily Unavailable<\/title>/);
    expect(exec(c, "kubectl describe ingress shop").output).toMatch(/\/api\s+apii:80 \(<error: services "apii" not found>\)/);
    c = exec(cluster(), "kubectl scale deployment api --replicas=0", "kubectl get pods").c;
    expect(exec(c, "curl http://shop.example.com/api").output).toMatch(/503 Service Temporarily Unavailable/);
    c = cluster(SHOP, `---\n${app("web", "nginx:1.27", 80, 8080)}`);
    expect(exec(c, "curl http://shop.example.com/").output).toMatch(/<title>502 Bad Gateway<\/title>/);
    expect(check(c, { kind: "http-get", url: "http://shop.example.com/", expectedStatus: 502 })).toBe(true);
  });

  it("answers 504 when a NetworkPolicy drops the controller's traffic, until the controller namespace is allowed", () => {
    const deny = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web
spec:
  podSelector:
    matchLabels:
      app: web
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
`;
    let c = apply(cluster(), deny.replace("ingress-nginx", "elsewhere")).c;
    expect(exec(c, "curl http://shop.example.com/").output).toMatch(/504 Gateway Time-out/);
    c = apply(c, deny).c;
    expect(exec(c, "curl http://shop.example.com/").output).toMatch(/Welcome to nginx!/);
  });

  it("serves TLS hosts with their Secret, the fake certificate otherwise, and redirects plain HTTP", () => {
    const tls = SHOP.replace("  rules:", "  tls:\n    - hosts: [shop.example.com]\n      secretName: shop-tls\n  rules:");
    let c = cluster(tls);
    expect(exec(c, "curl https://shop.example.com/api").output).toMatch(/^curl: \(60\) SSL certificate problem: self-signed certificate\n/);
    expect(exec(c, "curl -k https://shop.example.com/api").output).toMatch(/^\{"pod"/);
    expect(exec(c, "curl http://shop.example.com/api").output).toMatch(/308 Permanent Redirect/);
    c = exec(c, "kubectl create secret generic shop-tls --from-literal=tls.crt=x").c;
    expect(exec(c, "curl https://shop.example.com/api").output).toMatch(/^\{"pod"/);
    expect(exec(c, "kubectl get ingress").output).toMatch(/shop\s+nginx\s+shop\.example\.com\s+192\.0\.2\.10\s+80, 443\s+/);
  });

  it("uses the defaultBackend for unmatched requests", () => {
    const c = cluster(ingress(`  defaultBackend:\n    service:\n      name: web\n      port:\n        name: http\n  rules:\n    - host: shop.example.com\n      http:\n        paths:\n${rule("/api", "api")}`));
    expect(exec(c, "curl http://shop.example.com/").output).toMatch(/Welcome to nginx!/);
    expect(exec(c, "kubectl describe ingress shop").output).toMatch(/Default backend: {2}web:http \(10\.244\.\d+\.\d+:80\)/);
    expect(check(c, { kind: "ingress-backend", ingressName: "shop", host: "shop.example.com", path: "/", expectedService: "web" })).toBe(true);
  });

  it("has no address and routes nothing for an unknown class", () => {
    const c = cluster(SHOP.replace("ingressClassName: nginx", "ingressClassName: traefik"));
    expect(exec(c, "kubectl get ing shop").output).toMatch(/^NAME\s+CLASS\s+HOSTS\s+ADDRESS\s+PORTS\s+AGE\nshop\s+traefik\s+shop\.example\.com\s+80\s+\d+m$/);
    expect(exec(c, "curl http://shop.example.com/").output).toBe("curl: (6) Could not resolve host: shop.example.com");
    // Without ingressClassName the default class takes it.
    const d = cluster(SHOP.replace("  ingressClassName: nginx\n", ""));
    expect(exec(d, "kubectl get ing").output).toMatch(/shop\s+<none>\s+shop\.example\.com\s+192\.0\.2\.10/);
  });

  it("lists and describes the nginx IngressClass", () => {
    const c = cluster();
    expect(exec(c, "kubectl get ingressclass").output).toMatch(/^NAME\s+CONTROLLER\s+PARAMETERS\s+AGE\nnginx\s+k8s\.io\/ingress-nginx\s+<none>\s+/);
    expect(exec(c, "kubectl describe ingressclass nginx").output).toMatch(/Controller: {3}k8s\.io\/ingress-nginx/);
  });

  it("validates Ingress manifests", () => {
    const c = cluster();
    expect(apply(c, ingress("  ingressClassName: nginx\n", "empty")).output).toMatch(/either `defaultBackend` or `rules` must be specified/);
    expect(apply(c, SHOP.replace("shop.example.com", "10.0.0.1")).output).toMatch(/not an IP address/);
  });

  it("checks routes and requests from the laptop", () => {
    const c = cluster(SHOP.replace("name: api\n", "name: apii\n"));
    expect(check(c, { kind: "ingress-backend", ingressName: "shop", host: "shop.example.com", path: "/api", expectedService: "apii" })).toBe(true);
    expect(check(c, { kind: "ingress-backend", ingressName: "shop", host: "other.example.com", path: "/", expectedService: null })).toBe(true);
    expect(check(c, { kind: "ingress-backend", ingressName: "nope", path: "/", expectedService: null })).toBe(false);
    expect(check(c, { kind: "http-get", url: "http://shop.example.com/api", expectedStatus: 503 })).toBe(true);
    expect(check(c, { kind: "http-get", url: "http://shop.example.com/", expectedStatus: 200 })).toBe(true);
    expect(check(c, { kind: "http-get", url: "http://nope.example.com/", expectedStatus: "dns" })).toBe(true);
  });
});
