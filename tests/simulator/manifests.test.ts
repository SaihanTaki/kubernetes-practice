import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, find, list, replicaSetsOf, run, type Cluster, type Fixture } from "@/lib/simulator";

const web = (extra: Fixture = {}) =>
  createCluster({ deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }], ...extra });

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const deployment = (name: string, image: string, replicas = 2, namespace?: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}${namespace ? `\n  namespace: ${namespace}` : ""}
  labels:
    app: ${name}
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
          image: ${image}
`;

const pod = (image: string, port = 80) => `apiVersion: v1
kind: Pod
metadata:
  name: solo
spec:
  containers:
    - name: app
      image: ${image}
      ports:
        - containerPort: ${port}
`;

describe("files", () => {
  it("lists and prints files", () => {
    const c = createCluster({ files: { "b.yaml": "b\n", "a.txt": "hello\n" } });
    expect(exec(c, "ls").output).toBe("a.txt\nb.yaml");
    expect(exec(c, "cat a.txt").output).toBe("hello");
    const missing = exec(c, "cat nope.yaml");
    expect(missing).toMatchObject({ error: true, output: "cat: nope.yaml: No such file or directory" });
    expect(exec(c, "cat constructor").error).toBe(true);
  });

  it("redirects kubectl output to a file", () => {
    const r = exec(web(), "kubectl get deploy web -o yaml > web.yaml");
    expect(r).toMatchObject({ output: "", error: false });
    expect(parseYaml(r.c.files["web.yaml"]).kind).toBe("Deployment");
    expect(r.c.files["web.yaml"].endsWith("\n")).toBe(true);
    expect(exec(r.c, "ls").output).toBe("web.yaml");
  });

  it("does not write a file for a failed command or a bad name", () => {
    expect(exec(web(), "kubectl get pod nope > out.txt").c.files).toEqual({});
    expect(exec(web(), "kubectl get pods > ../x").error).toBe(true);
    expect(exec(web(), "kubectl get pods > __proto__").error).toBe(true);
    expect(exec(web(), "ls > out.txt").error).toBe(true);
  });
});

describe("namespaces", () => {
  it("creates a namespace once", () => {
    const r = exec(web(), "kubectl create namespace dev");
    expect(r.output).toBe("namespace/dev created");
    expect(r.c.namespaces).toContain("dev");
    expect(exec(r.c, "kubectl create ns dev").output).toBe('Error from server (AlreadyExists): namespaces "dev" already exists');
  });

  it("deletes a namespace and everything in it", () => {
    const c = web({ namespaces: ["dev"], pods: [{ name: "solo", namespace: "dev", image: "busybox" }] });
    const r = exec(c, "kubectl delete namespace dev");
    expect(r.output).toBe('namespace "dev" deleted');
    expect(r.c.namespaces).not.toContain("dev");
    expect(list(r.c, "Pod", "dev")).toHaveLength(0);
    expect(list(r.c, "Pod", "default")).toHaveLength(2);
  });

  it("refuses to delete default and kube-system", () => {
    for (const ns of ["default", "kube-system"]) {
      const r = exec(web(), `kubectl delete ns ${ns}`);
      expect(r.error).toBe(true);
      expect(r.output).toBe(`Error from server (Forbidden): namespaces "${ns}" is forbidden: this namespace may not be deleted`);
    }
    expect(list(exec(web(), "kubectl delete ns default").c, "Deployment")).toHaveLength(1);
  });
});

describe("imperative create", () => {
  it("creates a Deployment with app labels", () => {
    const r = exec(createCluster(), "kubectl create deployment api --image=nginx:1.27 --replicas=3");
    expect(r.output).toBe("deployment.apps/api created");
    const d = find(r.c, "Deployment", "default", "api")!;
    expect(d).toMatchObject({ replicas: 3, selector: { app: "api" }, template: { labels: { app: "api" }, image: "nginx:1.27" } });
    expect(list(r.c, "Pod")).toHaveLength(3);
    expect(find(exec(createCluster(), "kubectl create deploy api --image=nginx").c, "Deployment", "default", "api")!.replicas).toBe(1);
  });

  it("rejects duplicates, missing namespaces and bad images", () => {
    expect(exec(web(), "kubectl create deployment web --image=nginx").output).toBe(
      'Error from server (AlreadyExists): deployments.apps "web" already exists',
    );
    expect(exec(web(), "kubectl create deployment api --image=nginx -n nope").output).toBe(
      'Error from server (NotFound): namespaces "nope" not found',
    );
    expect(exec(web(), "kubectl create deployment api").error).toBe(true);
    expect(exec(web(), "kubectl create deployment api --image=").error).toBe(true);
    expect(exec(web(), "kubectl create deployment api --image=Nginx;rm").error).toBe(true);
    expect(exec(web(), "kubectl create pod api --image=nginx").error).toBe(true);
  });

  it("runs a standalone Pod that starts on the next command", () => {
    let r = exec(createCluster({ namespaces: ["dev"] }), "kubectl run solo --image=busybox -n dev");
    expect(r.output).toBe("pod/solo created");
    const p = find(r.c, "Pod", "dev", "solo")!;
    expect(p).toMatchObject({ status: "ContainerCreating", metadata: { labels: { run: "solo" } } });
    expect(p.owner).toBeUndefined();
    r = exec(r.c, "kubectl get pods -n dev", "kubectl get pods -n dev");
    expect(r.output).toMatch(/solo\s+1\/1\s+Running/);
    expect(exec(r.c, "kubectl run solo --image=busybox -n dev").output).toBe(
      'Error from server (AlreadyExists): pods "solo" already exists',
    );
  });
});

describe("set image", () => {
  it("rolls the Deployment to a new ReplicaSet step by step and scales the old one to 0", () => {
    const before = list(web(), "ReplicaSet")[0].metadata.name;
    let r = exec(web(), "kubectl set image deployment/web nginx=nginx:1.28");
    expect(r.output).toBe("deployment.apps/web image updated");
    r = exec(r.c, "kubectl get pods", "kubectl get pods", "kubectl get pods");
    const d = find(r.c, "Deployment", "default", "web")!;
    const sets = replicaSetsOf(r.c, d);
    expect(sets).toHaveLength(2);
    expect(sets.find((rs) => rs.metadata.name === before)!.replicas).toBe(0);
    const current = sets.find((rs) => rs.metadata.name !== before)!;
    expect(current.replicas).toBe(2);
    expect(list(r.c, "Pod").map((p) => p.image)).toEqual(["nginx:1.28", "nginx:1.28"]);
    expect(exec(r.c, "kubectl describe deploy web").output).toContain(`NewReplicaSet:  ${current.metadata.name}`);
  });

  it("accepts the two-word form and rejects unknown containers", () => {
    expect(exec(web(), "kubectl set image deployment web nginx=nginx:1.28").error).toBe(false);
    const r = exec(web(), "kubectl set image deployment/web web=nginx:1.28");
    expect(r.error).toBe(true);
    expect(r.output).toContain('unable to find container named "web"');
    expect(exec(web(), "kubectl set image deployment/nope nginx=nginx:1.28").error).toBe(true);
    expect(exec(web(), "kubectl set image deployment/web nginx").error).toBe(true);
  });
});

describe("dry run", () => {
  it("prints the manifest without changing the cluster", () => {
    const c = web();
    const r = exec(c, "kubectl create deployment api --image=nginx:1.27 --dry-run=client -o yaml");
    expect(r.c.resources).toEqual(c.resources);
    const doc = parseYaml(r.output);
    expect(doc).toMatchObject({ kind: "Deployment", metadata: { name: "api" }, spec: { replicas: 1 } });
    expect(doc.status).toBeUndefined();
  });

  it("reports a dry-run create for run and apply", () => {
    const r = exec(createCluster(), "kubectl run solo --image=busybox --dry-run=client");
    expect(r.output).toBe("pod/solo created (dry run)");
    expect(r.c.resources).toHaveLength(0);
    const yaml = parseYaml(exec(createCluster(), "kubectl run solo --image=busybox --dry-run=client -o yaml").output);
    expect(yaml.spec.nodeName).toBeUndefined();
    expect(yaml.metadata.ownerReferences).toBeUndefined();
    const applied = exec(createCluster({ files: { "a.yaml": deployment("api", "nginx") } }), "kubectl apply -f a.yaml --dry-run=client");
    expect(applied.output).toBe("deployment.apps/api created (dry run)");
    expect(applied.c.resources).toHaveLength(0);
  });

  it("is limited to create, run and apply", () => {
    expect(exec(web(), "kubectl scale deploy web --replicas=3 --dry-run=client").error).toBe(true);
    expect(exec(web(), "kubectl create deployment api --image=nginx -o yaml").error).toBe(true);
    expect(exec(web(), "kubectl create deployment api --image=nginx --dry-run=server").error).toBe(true);
  });
});

describe("apply", () => {
  const files = (text: string) => createCluster({ namespaces: ["dev"], files: { "app.yaml": text } });

  it("creates, then reports unchanged, then configured", () => {
    let r = exec(files(deployment("api", "nginx:1.27")), "kubectl apply -f app.yaml");
    expect(r.output).toBe("deployment.apps/api created");
    expect(list(r.c, "Pod")).toHaveLength(2);
    r = exec(r.c, "kubectl apply -f app.yaml");
    expect(r.output).toBe("deployment.apps/api unchanged");

    r.c.files["app.yaml"] = deployment("api", "nginx:1.28", 3);
    r = exec(r.c, "kubectl apply -f app.yaml");
    expect(r.output).toBe("deployment.apps/api configured");
    const d = find(r.c, "Deployment", "default", "api")!;
    expect(d).toMatchObject({ replicas: 3, template: { image: "nginx:1.28" } });
    r = exec(r.c, "kubectl get pods", "kubectl get pods", "kubectl get pods");
    expect(replicaSetsOf(r.c, d).map((rs) => rs.replicas).sort()).toEqual([0, 3]);
  });

  it("round-trips get -o yaml through a file", () => {
    const r = exec(web(), "kubectl get deploy web -o yaml > web.yaml", "kubectl apply -f web.yaml");
    expect(r.output).toBe("deployment.apps/web unchanged");
  });

  it("applies multiple documents with namespaces", () => {
    const text = `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: shop\n---\n${deployment("api", "nginx", 1, "shop")}---\n`;
    const r = exec(files(text), "kubectl apply -f app.yaml");
    expect(r.output).toBe("namespace/shop created\ndeployment.apps/api created");
    expect(find(r.c, "Deployment", "shop", "api")).toBeDefined();
    expect(find(exec(files(deployment("api", "nginx")), "kubectl apply -f app.yaml -n dev").c, "Deployment", "dev", "api")).toBeDefined();
    expect(exec(files(deployment("api", "nginx")), "kubectl apply -f app.yaml -n nope").output).toBe(
      'Error from server (NotFound): namespaces "nope" not found',
    );
  });

  it("changes nothing when any document is invalid", () => {
    const bad = deployment("bad", "nginx").replace("app: bad\n  template", "app: other\n  template");
    const c = files(`${deployment("api", "nginx")}---\n${bad}`);
    const r = exec(c, "kubectl apply -f app.yaml");
    expect(r).toMatchObject({ error: true, output: "error: app.yaml: spec.selector: selector does not match template labels" });
    expect(r.c.resources).toEqual(c.resources);

    const syntax = exec(files(`${deployment("api", "nginx")}---\nkind: [unclosed\n`), "kubectl apply -f app.yaml");
    expect(syntax.error).toBe(true);
    expect(syntax.output).toMatch(/^error: error parsing app\.yaml: /);
    expect(syntax.c.resources).toHaveLength(0);

    const missingNs = exec(files(`${deployment("api", "nginx")}---\n${deployment("b", "nginx", 1, "nope")}`), "kubectl apply -f app.yaml");
    expect(missingNs.error).toBe(true);
    expect(missingNs.c.resources).toHaveLength(0);
  });

  it("reports missing files and unknown kinds", () => {
    expect(exec(createCluster(), "kubectl apply -f x.yaml").output).toBe('error: the path "x.yaml" does not exist');
    expect(exec(files("apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: x\n"), "kubectl apply -f app.yaml").output).toMatch(/^error: app\.yaml: kind: /);
    expect(exec(files(""), "kubectl apply -f app.yaml").error).toBe(true);
    expect(exec(createCluster(), "kubectl apply").error).toBe(true);
  });

  it("allows Pod image and label changes but forbids other spec changes", () => {
    let r = exec(files(pod("nginx:1.27")), "kubectl apply -f app.yaml");
    expect(r.output).toBe("pod/solo created");
    expect(find(r.c, "Pod", "default", "solo")!.status).toBe("ContainerCreating");
    r.c.files["app.yaml"] = pod("nginx:1.28");
    r = exec(r.c, "kubectl apply -f app.yaml");
    expect(r.output).toBe("pod/solo configured");
    expect(find(r.c, "Pod", "default", "solo")!.image).toBe("nginx:1.28");
    expect(exec(r.c, "kubectl apply -f app.yaml").output).toBe("pod/solo unchanged");

    r.c.files["app.yaml"] = pod("nginx:1.28", 8080);
    const forbidden = exec(r.c, "kubectl apply -f app.yaml");
    expect(forbidden.error).toBe(true);
    expect(forbidden.output).toMatch(/^The Pod "solo" is invalid: spec: Forbidden: pod updates may not change fields other than/);
  });
});

describe("delete -f", () => {
  it("deletes every listed resource and reports missing ones", () => {
    const text = `${deployment("web", "nginx")}---\n${deployment("gone", "nginx")}`;
    const r = exec(web({ files: { "app.yaml": text } }), "kubectl delete -f app.yaml");
    expect(r.error).toBe(true);
    expect(r.output).toBe('deployment.apps "web" deleted\nError from server (NotFound): deployments "gone" not found');
    expect(r.c.resources).toHaveLength(0);
  });

  it("deletes namespaces listed in a file", () => {
    const c = createCluster({ namespaces: ["shop"], files: { "ns.yaml": "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: shop\n" } });
    const r = exec(c, "kubectl delete -f ns.yaml");
    expect(r.output).toBe('namespace "shop" deleted');
    expect(r.c.namespaces).not.toContain("shop");
  });
});
