import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, endpointsOf, find, list, run, type Cluster } from "@/lib/simulator";

const web = () =>
  createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }] });

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const svcYaml = (type = "ClusterIP", extra = "") => `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: ${type}
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80${extra}
`;

describe("services", () => {
  it("exposes a deployment as a ClusterIP Service with endpoints", () => {
    const r = exec(web(), "kubectl expose deployment web --port=80");
    expect(r.output).toBe("service/web exposed");
    const svc = find(r.c, "Service", "default", "web")!;
    expect(svc).toMatchObject({ type: "ClusterIP", selector: { app: "web" }, ports: [{ port: 80, targetPort: 80, protocol: "TCP" }] });
    expect(svc.clusterIP).toMatch(/^10\.96\.\d+\.\d+$/);
    expect(svc.ports[0].nodePort).toBeUndefined();
    const get = exec(r.c, "kubectl get svc").output;
    expect(get.split("\n")[0]).toMatch(/^NAME\s+TYPE\s+CLUSTER-IP\s+EXTERNAL-IP\s+PORT\(S\)\s+AGE$/);
    expect(get).toMatch(/web\s+ClusterIP\s+10\.96\.\S+\s+<none>\s+80\/TCP/);
    const ep = exec(r.c, "kubectl get endpoints web").output;
    expect(ep).toMatch(/web\s+10\.244\.\d+\.\d+:80,10\.244\.\d+\.\d+:80\s/);
  });

  it("assigns NodePorts and keeps LoadBalancer external IPs pending", () => {
    const r = exec(web(), "kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort --name=web-np");
    const svc = find(r.c, "Service", "default", "web-np")!;
    expect(svc.ports[0].nodePort).toBeGreaterThanOrEqual(30000);
    expect(svc.ports[0].nodePort).toBeLessThanOrEqual(32767);
    expect(exec(r.c, "kubectl get svc web-np").output).toMatch(new RegExp(`80:${svc.ports[0].nodePort}/TCP`));
    const lb = exec(r.c, "kubectl expose deploy web --port=80 --type=LoadBalancer --name=web-lb");
    expect(exec(lb.c, "kubectl get svc web-lb").output).toMatch(/LoadBalancer\s+\S+\s+<pending>/);
    // targetPort 8080 matches no container port name, but numbers are used as-is.
    expect(endpointsOf(r.c, svc).map((e) => e.ports)).toEqual([[8080], [8080]]);
  });

  it("creates services with kubectl create service", () => {
    const r = exec(web(), "kubectl create service nodeport web --tcp=80:8080");
    expect(r.output).toBe("service/web created");
    expect(find(r.c, "Service", "default", "web")).toMatchObject({ type: "NodePort", selector: { app: "web" }, ports: [{ port: 80, targetPort: 8080 }] });
    expect(exec(r.c, "kubectl create svc clusterip web --tcp=80").output).toBe('Error from server (AlreadyExists): services "web" already exists');
    expect(exec(web(), "kubectl create service clusterip x").error).toBe(true);
    expect(exec(web(), "kubectl create service headless x --tcp=80").error).toBe(true);
    expect(exec(web(), "kubectl create service clusterip x --tcp=99999").error).toBe(true);
  });

  it("validates expose input", () => {
    expect(exec(web(), "kubectl expose deployment web").output).toBe("error: couldn't find port via --port flag or introspection");
    expect(exec(web(), "kubectl expose deployment nope --port=80").error).toBe(true);
    expect(exec(web(), "kubectl expose deployment web --port=0").error).toBe(true);
    expect(exec(web(), "kubectl expose deployment web --port=80 --type=ExternalName").error).toBe(true);
    expect(exec(web(), "kubectl expose deployment web --port=80 --name=Bad_Name").error).toBe(true);
    expect(exec(web(), "kubectl get pods --port=80").error).toBe(true);
    const dry = exec(web(), "kubectl expose deployment web --port=80 --dry-run=client -o yaml");
    expect(parseYaml(dry.output)).toMatchObject({ kind: "Service", spec: { selector: { app: "web" } } });
    expect(list(dry.c, "Service")).toHaveLength(0);
  });

  it("exposes a pod by its labels", () => {
    const c = createCluster({ pods: [{ name: "solo", image: "nginx:1.27", labels: { app: "solo" } }] });
    const r = exec(c, "kubectl expose pod solo --port=80");
    expect(endpointsOf(r.c, find(r.c, "Service", "default", "solo")!)).toHaveLength(1);
  });

  it("applies, round-trips and deletes a Service", () => {
    let r = exec(web(), "kubectl get pods");
    r.c.files["svc.yaml"] = svcYaml("NodePort");
    r = exec(r.c, "kubectl apply -f svc.yaml");
    expect(r.output).toBe("service/web created");
    const svc = find(r.c, "Service", "default", "web")!;
    expect(exec(r.c, "kubectl apply -f svc.yaml").output).toBe("service/web unchanged");
    r = exec(r.c, "kubectl get svc web -o yaml > out.yaml", "kubectl apply -f out.yaml");
    expect(r.output).toBe("service/web unchanged");
    expect(find(r.c, "Service", "default", "web")).toEqual(svc);
    r = exec(r.c, "kubectl delete svc web");
    expect(r.output).toBe('service "web" deleted');
    expect(list(r.c, "Service")).toHaveLength(0);
  });

  it("rejects invalid Service manifests", () => {
    const bad = (text: string) => exec(createCluster({ files: { "s.yaml": text } }), "kubectl apply -f s.yaml");
    expect(bad(svcYaml("ClusterIP", "\n      nodePort: 30080")).output).toMatch(/nodePort may not be used/);
    expect(bad(svcYaml("NodePort", "\n      nodePort: 80")).error).toBe(true);
    expect(bad(svcYaml("Weird")).error).toBe(true);
    expect(bad(svcYaml().replace("port: 80\n", "port: 70000\n")).error).toBe(true);
    expect(bad(`${svcYaml()}    - port: 443\n`).output).toMatch(/ports need a name/);
  });

  it("describes a Service with its endpoints", () => {
    const r = exec(web(), "kubectl expose deployment web --port=80 --type=NodePort");
    const out = exec(r.c, "kubectl describe service web").output;
    expect(out).toMatch(/Selector:\s+app=web/);
    expect(out).toMatch(/Type:\s+NodePort/);
    expect(out).toMatch(/NodePort:\s+<unset>\s+3\d{4}\/TCP/);
    expect(out).toMatch(/Endpoints:\s+10\.244\.\d+\.\d+:80,10\.244/);
  });

  it("shows IP and NODE with -o wide and resolves named target ports", () => {
    const out = exec(web(), "kubectl get pods -o wide").output;
    expect(out.split("\n")[0]).toMatch(/AGE\s+IP\s+NODE$/);
    expect(out).toMatch(/10\.244\.\d+\.\d+\s+worker-\d/);
    const pod = `apiVersion: v1
kind: Pod
metadata:
  name: api
  labels:
    app: api
spec:
  containers:
    - name: api
      image: example/api:1.0
      ports:
        - containerPort: 8080
          name: http
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: http
`;
    const r = exec(createCluster({ files: { "a.yaml": pod } }), "kubectl apply -f a.yaml", "kubectl get pods");
    expect(exec(r.c, "kubectl get ep api").output).toMatch(/api\s+10\.244\.\d+\.\d+:8080\s/);
  });

  it("only lists ready Pods whose labels match", () => {
    const c = createCluster({
      pods: [
        { name: "a", image: "nginx:1.27", labels: { app: "web" } },
        { name: "b", image: "nginx:1.27", labels: { app: "web" }, status: "CrashLoopBackOff" },
        { name: "c", image: "nginx:1.27", labels: { app: "other" } },
      ],
    });
    let r = exec(c, "kubectl create service clusterip web --tcp=80");
    expect(endpointsOf(r.c, find(r.c, "Service", "default", "web")!).map((e) => e.pod.metadata.name)).toEqual(["a"]);
    r = exec(r.c, "kubectl label pod c app=web --overwrite");
    expect(endpointsOf(r.c, find(r.c, "Service", "default", "web")!)).toHaveLength(2);
    expect(exec(createCluster(), "kubectl get endpoints").output).toBe("No resources found in default namespace.");
  });
});
