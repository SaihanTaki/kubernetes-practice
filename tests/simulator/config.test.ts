import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { createCluster, find, list, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const podWithEnv = (env: string) => `apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: nginx:1.27
${env}`;

describe("configmaps", () => {
  it("creates from literals, lists, describes and deletes", () => {
    let r = exec(createCluster(), "kubectl create configmap app --from-literal=color=blue --from-literal='greeting=hello world'");
    expect(r.output).toBe("configmap/app created");
    expect(find(r.c, "ConfigMap", "default", "app")!.data).toEqual({ color: "blue", greeting: "hello world" });
    expect(exec(r.c, "kubectl get cm").output).toMatch(/^app\s+2\s+\d+s$/m);
    const described = exec(r.c, "kubectl describe configmap app").output;
    expect(described).toContain("Data\n====\ncolor:\n----\nblue\n");
    expect(described).toContain("greeting:\n----\nhello world");
    r = exec(r.c, "kubectl delete cm app");
    expect(r.output).toBe('configmap "app" deleted');
    expect(list(r.c, "ConfigMap")).toHaveLength(0);
  });

  it("validates literals", () => {
    for (const bad of ["--from-literal=novalue", "--from-literal==x", "--from-literal='bad key=x'", "--from-literal=a=1 --from-literal=a=2"]) {
      expect(exec(createCluster(), `kubectl create configmap app ${bad}`).error, bad).toBe(true);
    }
    expect(exec(createCluster(), "kubectl get pods --from-literal=a=b").error).toBe(true);
  });

  it("applies and round-trips a ConfigMap", () => {
    const yaml = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app\ndata:\n  color: blue\n";
    let r = exec(createCluster({ files: { "cm.yaml": yaml } }), "kubectl apply -f cm.yaml");
    expect(r.output).toBe("configmap/app created");
    r = exec(r.c, "kubectl get cm app -o yaml > out.yaml", "kubectl apply -f out.yaml");
    expect(r.output).toBe("configmap/app unchanged");
    r.c.files["cm.yaml"] = yaml.replace("blue", "red");
    expect(exec(r.c, "kubectl apply -f cm.yaml").output).toBe("configmap/app configured");
    expect(exec(r.c, "kubectl apply -f cm.yaml").c.resources[0]).toMatchObject({ data: { color: "red" } });
    const numeric = exec(createCluster({ files: { "cm.yaml": yaml.replace("blue", "8080") } }), "kubectl apply -f cm.yaml");
    expect(numeric.error).toBe(true);
  });
});

describe("secrets", () => {
  it("stores literals as base64 and never prints values in describe", () => {
    const r = exec(createCluster(), "kubectl create secret generic db --from-literal=password=s3cr3t --from-literal=user=admin");
    expect(r.output).toBe("secret/db created");
    const doc = parseYaml(exec(r.c, "kubectl get secret db -o yaml").output);
    expect(doc).toMatchObject({ kind: "Secret", type: "Opaque", data: { password: "czNjcjN0", user: "YWRtaW4=" } });
    const described = exec(r.c, "kubectl describe secret db").output;
    expect(described).toMatch(/Type:\s+Opaque/);
    expect(described).toContain("password:  6 bytes");
    expect(described).not.toContain("s3cr3t");
    expect(exec(r.c, "kubectl get secrets").output).toMatch(/^db\s+Opaque\s+2\s/m);
    expect(exec(createCluster(), "kubectl create secret tls x --from-literal=a=b").error).toBe(true);
  });

  it("merges stringData into base64 data and rejects bad base64", () => {
    const yaml = "apiVersion: v1\nkind: Secret\nmetadata:\n  name: db\ndata:\n  user: YWRtaW4=\nstringData:\n  password: héllo\n";
    const r = exec(createCluster({ files: { "s.yaml": yaml } }), "kubectl apply -f s.yaml");
    expect(find(r.c, "Secret", "default", "db")!.data).toEqual({ user: "YWRtaW4=", password: "aMOpbGxv" });
    expect(exec(r.c, "kubectl describe secret db").output).toContain("password:  6 bytes");
    const bad = exec(createCluster({ files: { "s.yaml": yaml.replace("YWRtaW4=", "not base64!") } }), "kubectl apply -f s.yaml");
    expect(bad.output).toMatch(/must be base64-encoded/);
  });
});

describe("config references", () => {
  const env = `      env:
        - name: COLOR
          valueFrom:
            configMapKeyRef:
              name: app
              key: color
        - name: PASSWORD
          valueFrom:
            secretKeyRef:
              name: db
              key: password
`;

  it("holds a Pod in CreateContainerConfigError until every reference resolves", () => {
    let r = exec(createCluster({ files: { "pod.yaml": podWithEnv(env) } }), "kubectl apply -f pod.yaml", "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")!.status).toBe("CreateContainerConfigError");
    expect(exec(r.c, "kubectl describe pod app").output).toContain('Error: configmap "app" not found');
    r = exec(r.c, "kubectl create configmap app --from-literal=other=x", "kubectl get pods");
    expect(exec(r.c, "kubectl describe pod app").output).toContain("Error: couldn't find key color in ConfigMap default/app");
    r = exec(r.c, "kubectl delete cm app", "kubectl create configmap app --from-literal=color=blue", "kubectl get pods");
    expect(exec(r.c, "kubectl describe pod app").output).toContain('Error: secret "db" not found');
    expect(exec(r.c, "kubectl get pods").output).toMatch(/app\s+0\/1\s+CreateContainerConfigError/);
    r = exec(r.c, "kubectl create secret generic db --from-literal=password=x", "kubectl get pods");
    expect(r.output).toMatch(/app\s+1\/1\s+Running/);
    // A running container keeps its environment; deleting the ConfigMap does not stop it.
    r = exec(r.c, "kubectl delete cm app", "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")!.status).toBe("Running");
  });

  it("checks envFrom references and shows env in describe", () => {
    const from = "      envFrom:\n        - configMapRef:\n            name: app\n        - secretRef:\n            name: db\n";
    let r = exec(createCluster({ files: { "pod.yaml": podWithEnv(from) } }), "kubectl create configmap app", "kubectl apply -f pod.yaml", "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")!.status).toBe("CreateContainerConfigError");
    r = exec(r.c, "kubectl create secret generic db", "kubectl get pods");
    expect(find(r.c, "Pod", "default", "app")!.status).toBe("Running");

    const described = exec(createCluster({ files: { "pod.yaml": podWithEnv(`${env}        - name: MODE\n          value: fast\n`) } }), "kubectl apply -f pod.yaml", "kubectl describe pod app").output;
    expect(described).toContain("  COLOR:  <set to the key 'color' of config map 'app'>  Optional: false");
    expect(described).toContain("  PASSWORD:  <set to the key 'password' in secret 'db'>  Optional: false");
    expect(described).toContain("  MODE:  fast");
  });

  it("rejects malformed env entries", () => {
    const bad = (e: string) => exec(createCluster({ files: { "pod.yaml": podWithEnv(e) } }), "kubectl apply -f pod.yaml").error;
    expect(bad("      env:\n        - name: A\n          value: x\n          valueFrom:\n            configMapKeyRef:\n              name: a\n              key: b\n")).toBe(true);
    expect(bad("      env:\n        - name: A\n          value: 1\n")).toBe(true);
    expect(bad("      envFrom:\n        - {}\n")).toBe(true);
  });
});
