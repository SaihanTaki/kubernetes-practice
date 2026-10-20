import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, list, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const cluster = () =>
  exec(createCluster({ namespaces: ["ci"], deployments: [{ name: "app", namespace: "ci", replicas: 1, image: "nginx:1.27", labels: { app: "app" } }] }), "kubectl get pods -n ci").c;

const SA = "system:serviceaccount:ci:deployer";
const apply = (c: Cluster, yaml: string) => exec({ ...c, files: { ...c.files, "x.yaml": yaml } }, "kubectl apply -f x.yaml");

describe("ServiceAccounts", () => {
  it("gives every namespace a default ServiceAccount", () => {
    let c = cluster();
    expect(exec(c, "kubectl get sa -n ci").output).toMatch(/^NAME\s+SECRETS\s+AGE\ndefault\s+0\s+\d+m$/);
    c = exec(c, "kubectl create namespace dev").c;
    expect(exec(c, "kubectl get serviceaccount default -n dev").error).toBe(false);
    c = exec(c, "kubectl delete sa default -n dev").c;
    expect(exec(c, "kubectl get sa default -n dev").error).toBe(false);
  });

  it("creates and describes ServiceAccounts", () => {
    const r = exec(cluster(), "kubectl create serviceaccount deployer -n ci");
    expect(r.output).toBe("serviceaccount/deployer created");
    expect(exec(r.c, "kubectl describe sa deployer -n ci").output).toMatch(/^Name: {16}deployer\nNamespace: {11}ci\n[\s\S]*Image pull secrets: {2}<none>\nMountable secrets: {3}<none>\nTokens: {14}<none>\nEvents:/);
  });

  it("rejects Pods whose serviceAccountName does not exist", () => {
    const pod = `apiVersion: v1
kind: Pod
metadata:
  name: p
  namespace: ci
spec:
  serviceAccountName: deployer
  containers:
    - name: p
      image: nginx:1.27
`;
    expect(apply(cluster(), pod).output).toBe(
      'Error from server (Forbidden): error when creating "x.yaml": pods "p" is forbidden: error looking up service account ci/deployer: serviceaccount "deployer" not found',
    );
    const c = exec(cluster(), "kubectl create sa deployer -n ci").c;
    expect(apply(c, pod).output).toBe("pod/p created");
    const deploy = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      serviceAccountName: robot
      containers:
        - name: web
          image: nginx:1.27
`;
    const d = apply(createCluster(), deploy).c;
    expect(list(d, "Pod")).toHaveLength(0);
    expect(exec(d, "kubectl get events").output).toMatch(/FailedCreate\s+replicaset\/web-\w+\s+Error creating: pods "web-\w+-\w+" is forbidden: error looking up service account default\/robot: serviceaccount "robot" not found/);
  });
});

describe("Roles and bindings", () => {
  it("creates Roles with one rule per API group and resolves short names", () => {
    const r = exec(cluster(), "kubectl create role dev --verb=get,list --resource=po,deployments,jobs.batch,pods/log --resource-name=x -n ci");
    expect(r.output).toBe("role.rbac.authorization.k8s.io/dev created");
    expect(exec(r.c, "kubectl get role dev -n ci -o yaml").output).toMatch(
      /rules:\n {2}- apiGroups:\n {6}- ""\n {4}resources:\n {6}- pods\n {6}- pods\/log\n {4}verbs:\n {6}- get\n {6}- list\n {4}resourceNames:\n {6}- x\n {2}- apiGroups:\n {6}- apps\n {4}resources:\n {6}- deployments\n/,
    );
    expect(exec(r.c, "kubectl describe role dev -n ci").output).toMatch(/PolicyRule:\n {2}Resources\s+Non-Resource URLs\s+Resource Names\s+Verbs\n[\s\S]*pods\/log\s+\[\]\s+\[x\]\s+\[get list\]\n {2}deployments\.apps\s+\[\]\s+\[x\]\s+\[get list\]\n {2}jobs\.batch/);
  });

  it("validates create role and rolebinding flags", () => {
    const c = cluster();
    expect(exec(c, "kubectl create role r --verb=fly --resource=pods").output).toBe("error: invalid verb: 'fly'");
    expect(exec(c, "kubectl create role r --verb=get --resource=foos").output).toBe('error: the server doesn\'t have a resource type "foos"');
    expect(exec(c, "kubectl create role r --resource=pods").output).toBe("error: at least one verb must be specified");
    expect(exec(c, "kubectl create rolebinding b --user=jane").output).toBe("error: exactly one of clusterrole or role must be specified");
    expect(exec(c, "kubectl create rolebinding b --role=r --serviceaccount=deployer").output).toBe("error: serviceaccount must be <namespace>:<name>");
    expect(exec(c, "kubectl create clusterrolebinding b --role=r").output).toBe("error: unknown flag: --role");
    expect(exec(c, "kubectl create deployment d --image=nginx --verb=get").error).toBe(true);
    expect(exec(c, "kubectl get pods --verb=get").error).toBe(true);
  });

  it("lists bindings with their subjects", () => {
    const c = exec(cluster(), "kubectl create rolebinding b --clusterrole=view --user=jane --group=devs --serviceaccount=ci:deployer -n ci").c;
    expect(exec(c, "kubectl get rolebindings -n ci -o wide").output).toMatch(/^NAME\s+ROLE\s+AGE\s+USERS\s+GROUPS\s+SERVICEACCOUNTS\nb\s+ClusterRole\/view\s+\d+s\s+jane\s+devs\s+ci\/deployer$/);
    expect(exec(c, "kubectl describe rolebinding b -n ci").output).toMatch(/Role:\n {2}Kind: {2}ClusterRole\n {2}Name: {2}view\nSubjects:\n {2}Kind\s+Name\s+Namespace\n[\s\S]*User\s+jane\n {2}Group\s+devs\n {2}ServiceAccount\s+deployer\s+ci$/);
    expect(exec(c, "kubectl get clusterroles").output.split("\n").slice(1).map((l) => l.split(/\s+/)[0])).toEqual(["cluster-admin", "admin", "edit", "view"]);
    expect(exec(c, "kubectl get clusterrolebinding cluster-admin").output).toMatch(/cluster-admin\s+ClusterRole\/cluster-admin/);
  });

  it("keeps roleRef immutable and ClusterRoleBindings on ClusterRoles", () => {
    const binding = (kind: string, role: string, roleKind = "ClusterRole") => `apiVersion: rbac.authorization.k8s.io/v1
kind: ${kind}
metadata:
  name: b
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ${roleKind}
  name: ${role}
`;
    const c = apply(cluster(), binding("RoleBinding", "view")).c;
    expect(apply(c, binding("RoleBinding", "edit")).output).toBe(
      'The RoleBinding "b" is invalid: roleRef: Invalid value: rbac.RoleRef{APIGroup:"rbac.authorization.k8s.io", Kind:"ClusterRole", Name:"edit"}: cannot change roleRef',
    );
    expect(apply(c, binding("ClusterRoleBinding", "r", "Role")).output).toBe('The ClusterRoleBinding "b" is invalid: roleRef.kind: Unsupported value: "Role": supported values: "ClusterRole"');
  });
});

describe("authorization", () => {
  const granted = () =>
    exec(
      cluster(),
      "kubectl create sa deployer -n ci",
      "kubectl create role pods --verb=get,list --resource=pods -n ci",
      "kubectl create rolebinding deployer --role=pods --serviceaccount=ci:deployer -n ci",
    ).c;

  it("answers auth can-i, with no as a normal answer", () => {
    const c = granted();
    expect(exec(c, `kubectl auth can-i list pods -n ci --as=${SA}`)).toMatchObject({ output: "yes", error: false });
    expect(exec(c, `kubectl auth can-i list pods --as=${SA}`)).toMatchObject({ output: "no", error: false });
    expect(exec(c, `kubectl auth can-i delete pods -n ci --as=${SA}`).output).toBe("no");
    expect(exec(c, `kubectl auth can-i get pods/app -n ci --as=${SA}`).output).toBe("yes");
    expect(exec(c, `kubectl auth can-i get pods --subresource=log -n ci --as=${SA}`).output).toBe("no");
    expect(exec(c, "kubectl auth can-i delete nodes").output).toBe("yes");
    expect(exec(c, "kubectl auth can-i get foos --as=jane").output).toBe("Warning: the server doesn't have a resource type 'foos'\nno");
    expect(exec(c, "kubectl auth can-i get").error).toBe(true);
  });

  it("grants ClusterRoles through RoleBindings in one namespace only, and through groups", () => {
    let c = exec(cluster(), "kubectl create rolebinding jane --clusterrole=edit --user=jane -n ci").c;
    expect(exec(c, "kubectl auth can-i create deployments -n ci --as=jane").output).toBe("yes");
    expect(exec(c, "kubectl auth can-i create deployments --as=jane").output).toBe("no");
    expect(exec(c, "kubectl auth can-i list nodes --as=jane").output).toBe("no");
    expect(exec(c, "kubectl auth can-i create roles -n ci --as=jane").output).toBe("no");
    c = exec(c, "kubectl create clusterrolebinding ops --clusterrole=view --group=ops").c;
    expect(exec(c, "kubectl auth can-i list pods -A --as=bob --as-group=ops").output).toBe("yes");
    expect(exec(c, "kubectl auth can-i list secrets -A --as=bob --as-group=ops").output).toBe("no");
    c = exec(c, "kubectl create clusterrolebinding sas --clusterrole=view --group=system:serviceaccounts:ci").c;
    expect(exec(c, "kubectl auth can-i list pods --as=system:serviceaccount:ci:anyone").output).toBe("yes");
    expect(exec(c, "kubectl auth can-i list pods --as=system:serviceaccount:other:anyone").output).toBe("no");
    expect(exec(c, "kubectl get pods --as-group=ops").output).toBe("error: requesting groups or user-extra for  without impersonating a user");
  });

  it("checks every command run with --as", () => {
    const c = granted();
    const as = `--as=${SA}`;
    expect(exec(c, `kubectl get pods -n ci ${as}`).error).toBe(false);
    expect(exec(c, `kubectl get secrets -n ci ${as}`).output).toBe(
      `Error from server (Forbidden): secrets is forbidden: User "${SA}" cannot list resource "secrets" in API group "" in the namespace "ci"`,
    );
    expect(exec(c, `kubectl get pods -A ${as}`).output).toBe(`Error from server (Forbidden): pods is forbidden: User "${SA}" cannot list resource "pods" in API group "" at the cluster scope`);
    expect(exec(c, `kubectl get deploy app -n ci ${as}`).output).toBe(
      `Error from server (Forbidden): deployments.apps "app" is forbidden: User "${SA}" cannot get resource "deployments" in API group "apps" in the namespace "ci"`,
    );
    expect(exec(c, `kubectl create deployment x --image=nginx -n ci ${as}`).output).toBe(
      `Error from server (Forbidden): deployments.apps is forbidden: User "${SA}" cannot create resource "deployments" in API group "apps" in the namespace "ci"`,
    );
    expect(exec(c, `kubectl scale deploy app --replicas=2 -n ci ${as}`).output).toMatch(/cannot patch resource "deployments\/scale" in API group "apps"/);
    const pod = exec(c, "kubectl get pods -n ci").output.match(/app-\S+/)![0];
    expect(exec(c, `kubectl logs ${pod} -n ci ${as}`).output).toMatch(/cannot get resource "pods\/log"/);
    expect(exec(c, `kubectl exec ${pod} -n ci ${as} -- ls`).output).toMatch(/cannot create resource "pods\/exec"/);
    expect(exec(c, `kubectl delete pod ${pod} -n ci ${as}`).output).toMatch(/pods "app-\S+" is forbidden: .* cannot delete resource "pods"/);
    expect(exec(c, `kubectl cordon worker-1 ${as}`).output).toMatch(/nodes "worker-1" is forbidden: .* cannot patch resource "nodes" in API group "" at the cluster scope/);
    const cm = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n  namespace: ci\n";
    expect(exec({ ...c, files: { ...c.files, "cm.yaml": cm } }, `kubectl apply -f cm.yaml ${as}`).output).toBe(
      `Error from server (Forbidden): error when creating "cm.yaml": configmaps is forbidden: User "${SA}" cannot create resource "configmaps" in API group "" in the namespace "ci"`,
    );
    expect(exec(c, `kubectl auth can-i list pods -n ci ${as}`).output).toBe("yes");
  });

  it("lists what a user may do", () => {
    const c = granted();
    const out = exec(c, `kubectl auth can-i --list -n ci --as=${SA}`).output.split("\n");
    expect(out[0]).toMatch(/^Resources\s+Non-Resource URLs\s+Resource Names\s+Verbs$/);
    expect(out).toContainEqual(expect.stringMatching(/^pods\s+\[\]\s+\[\]\s+\[get list\]$/));
    expect(out).toContainEqual(expect.stringMatching(/^selfsubjectaccessreviews\.authorization\.k8s\.io\s+\[\]\s+\[\]\s+\[create\]$/));
    expect(out).toContainEqual(expect.stringMatching(/^\s+\[\/healthz\]\s+\[\]\s+\[get\]$/));
    expect(exec(c, "kubectl auth can-i --list").output).toMatch(/^Resources\s+Non-Resource URLs\s+Resource Names\s+Verbs\n\*\.\*\s+\[\]\s+\[\]\s+\[\*\]\n\s+\[\*\]\s+\[\]\s+\[\*\]$/);
  });

  it("checks can-i objectives", () => {
    const c = granted();
    const can = (verb: string, resource: string, namespace: string, expectedValue: boolean, name?: string) =>
      check(c, { kind: "can-i", verb, resource, as: SA, expectedValue, namespace, name });
    expect(can("list", "pods", "ci", true)).toBe(true);
    expect(can("list", "pods", "default", false)).toBe(true);
    expect(can("get", "pods/log", "ci", false)).toBe(true);
    expect(can("get", "secrets", "ci", true)).toBe(false);
    expect(check(c, { kind: "can-i", verb: "update", resource: "deployments", as: "kubernetes-admin", expectedValue: false })).toBe(true);
  });
});

describe("example/worker", () => {
  const worker = (env: string) => `apiVersion: v1
kind: Pod
metadata:
  name: worker
spec:
  containers:
    - name: worker
      image: example/worker:1.1${env}
`;
  it("crashes without QUEUE_URL and connects with it", () => {
    let c = exec(apply(createCluster(), worker("")).c, "kubectl get pods", "kubectl get pods").c;
    expect(exec(c, "kubectl get pod worker").output).toMatch(/worker\s+0\/1\s+CrashLoopBackOff/);
    expect(exec(c, "kubectl logs worker --previous").output).toBe("error: QUEUE_URL is not set");
    c = exec(apply(createCluster(), worker("\n      env:\n        - name: QUEUE_URL\n          value: amqp://queue:5672")).c, "kubectl get pods").c;
    expect(exec(c, "kubectl get pod worker").output).toMatch(/worker\s+1\/1\s+Running\s+0/);
    expect(exec(c, "kubectl logs worker").output).toBe("connected to amqp://queue:5672");
    expect(exec(c, "kubectl exec worker -- wget -qO- -T 1 http://localhost").error).toBe(true);
  });
});
