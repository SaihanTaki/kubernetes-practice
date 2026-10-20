import { age, aligned, annotationText, labelText, table } from "./cli";
import { CLUSTER_SCOPED, find, list } from "./cluster";
import { timestamp } from "./images";
import { apiGroup, PLURAL, type ResourceType, TYPES } from "./kinds";
import type { Cluster, ClusterRole, ClusterRoleBinding, PolicyRule, Pod, Role, RoleBinding, RoleRef, ServiceAccount, Subject } from "./types";

export const RBAC_GROUP = "rbac.authorization.k8s.io";
export const MASTERS = "system:masters";
const AUTHENTICATED = "system:authenticated";
const SA_PREFIX = "system:serviceaccount:";

export type User = { name: string; groups: string[] };

/** Who the learner is: the admin from kind's kubeconfig. */
export const ADMIN: User = { name: "kubernetes-admin", groups: [MASTERS, AUTHENTICATED] };

/**
 * The identity `--as` and `--as-group` impersonate. Like the API server, a ServiceAccount username gets the
 * ServiceAccount groups unless groups are given, and everyone is in system:authenticated.
 */
export function impersonate(name: string, groups: string[]): User {
  const sa = name.startsWith(SA_PREFIX) ? name.slice(SA_PREFIX.length).split(":") : null;
  const implied = sa && !groups.length ? ["system:serviceaccounts", `system:serviceaccounts:${sa[0]}`] : [];
  return { name, groups: [...new Set([...groups, ...implied, AUTHENTICATED])] };
}

/** A request as the authorizer sees it. `namespace` is "" for cluster-scoped requests. */
export type Attributes = { verb: string; group: string; resource: string; subresource?: string; namespace: string; name?: string };

function ruleAllows(r: PolicyRule, a: Attributes): boolean {
  const combined = a.subresource ? `${a.resource}/${a.subresource}` : a.resource;
  return (
    (r.verbs.includes("*") || r.verbs.includes(a.verb)) &&
    !!r.apiGroups?.some((g) => g === "*" || g === a.group) &&
    !!r.resources?.some((x) => x === "*" || x === combined || (!!a.subresource && x === `*/${a.subresource}`)) &&
    (!r.resourceNames?.length || (!!a.name && r.resourceNames.includes(a.name)))
  );
}

function subjectMatches(s: Subject, u: User, bindingNs: string): boolean {
  if (s.kind === "User") return s.name === u.name;
  if (s.kind === "Group") return u.groups.includes(s.name);
  return u.name === `${SA_PREFIX}${s.namespace ?? bindingNs}:${s.name}`;
}

const roleRules = (c: Cluster, ref: RoleRef, ns: string) =>
  (ref.kind === "ClusterRole" ? find(c, "ClusterRole", "", ref.name) : find(c, "Role", ns, ref.name))?.rules ?? [];

/** The rules granted to the user in a namespace ("" = cluster-wide only): ClusterRoleBindings, plus RoleBindings there. */
export function rulesFor(c: Cluster, u: User, ns: string): PolicyRule[] {
  const bindings: (RoleBinding | ClusterRoleBinding)[] = [...list(c, "ClusterRoleBinding"), ...(ns ? list(c, "RoleBinding", ns) : [])];
  return bindings
    .filter((b) => b.subjects.some((s) => subjectMatches(s, u, b.metadata.namespace)))
    .flatMap((b) => roleRules(c, b.roleRef, b.metadata.namespace));
}

/** RBAC, with system:masters always allowed as the API server's privileged group. */
export const authorize = (c: Cluster, u: User, a: Attributes) =>
  u.groups.includes(MASTERS) || rulesFor(c, u, a.namespace).some((r) => ruleAllows(r, a));

/** The API server's reason, without the `Error from server (Forbidden): ` prefix. */
export function forbidden(u: User, a: Attributes): string {
  const what = `${a.group ? `${a.resource}.${a.group}` : a.resource}${a.name ? ` "${a.name}"` : ""}`;
  const resource = a.subresource ? `${a.resource}/${a.subresource}` : a.resource;
  const scope = a.namespace ? `in the namespace "${a.namespace}"` : "at the cluster scope";
  return `${what} is forbidden: User "${u.name}" cannot ${a.verb} resource "${resource}" in API group "${a.group}" ${scope}`;
}

/** A resource as RBAC names it: `pods`, `deployments` in `apps`, or `*`. */
export type ApiResource = { resource: string; group: string; namespaced: boolean };

/** Resolves `po`, `deployment`, `deployments.apps` or `*` like kubectl's REST mapper. */
export function apiResource(name: string): ApiResource | null {
  if (name === "*") return { resource: "*", group: "*", namespaced: true };
  const known = (type: ResourceType): ApiResource => ({ resource: PLURAL[type], group: apiGroup(type), namespaced: !CLUSTER_SCOPED.has(type) && type !== "Namespace" });
  const lower = name.toLowerCase();
  if (Object.hasOwn(TYPES, lower)) return known(TYPES[lower]);
  const dot = lower.indexOf(".");
  if (dot === -1) return null;
  const [base, group] = [lower.slice(0, dot), lower.slice(dot + 1)];
  const type = Object.hasOwn(TYPES, base) ? TYPES[base] : undefined;
  return type && apiGroup(type) === group ? known(type) : null;
}

/** `kubectl auth can-i`: `resource` may name a subresource as `pods/log`. */
export function canI(c: Cluster, u: User, verb: string, resource: string, ns: string, name?: string): boolean {
  const [base, subresource] = resource.split("/");
  const r = apiResource(base);
  return authorize(c, u, { verb, group: r?.group ?? "", resource: r?.resource ?? base, subresource, namespace: r && !r.namespaced ? "" : ns, name });
}

export const VERBS = ["get", "list", "watch", "create", "update", "patch", "delete", "deletecollection", "use", "bind", "escalate", "impersonate", "proxy", "*"];

// --- Built-in objects ---

const READ = ["get", "list", "watch"];
const WRITE = ["create", "delete", "deletecollection", "patch", "update"];
const VIEW_CORE = ["configmaps", "endpoints", "events", "limitranges", "namespaces", "persistentvolumeclaims", "pods", "pods/log", "pods/status", "resourcequotas", "serviceaccounts", "services"];
const APPS = ["daemonsets", "deployments", "deployments/scale", "replicasets", "replicasets/scale", "statefulsets", "statefulsets/scale"];
const BATCH = ["cronjobs", "jobs"];
const NETWORKING = ["ingresses", "networkpolicies"];

const VIEW: PolicyRule[] = [
  { apiGroups: [""], resources: VIEW_CORE, verbs: READ },
  { apiGroups: ["apps"], resources: APPS, verbs: READ },
  { apiGroups: ["batch"], resources: BATCH, verbs: READ },
  { apiGroups: ["networking.k8s.io"], resources: NETWORKING, verbs: READ },
];

const EDIT: PolicyRule[] = [
  ...VIEW,
  { apiGroups: [""], resources: ["pods", "pods/attach", "pods/exec", "pods/portforward", "pods/proxy"], verbs: WRITE },
  { apiGroups: [""], resources: ["configmaps", "endpoints", "events", "persistentvolumeclaims", "secrets", "serviceaccounts", "services"], verbs: WRITE },
  { apiGroups: [""], resources: ["secrets"], verbs: READ },
  { apiGroups: [""], resources: ["serviceaccounts"], verbs: ["impersonate"] },
  { apiGroups: ["apps"], resources: APPS, verbs: WRITE },
  { apiGroups: ["batch"], resources: BATCH, verbs: WRITE },
  { apiGroups: ["networking.k8s.io"], resources: NETWORKING, verbs: WRITE },
];

const ADMIN_RULES: PolicyRule[] = [
  ...EDIT,
  { apiGroups: [RBAC_GROUP], resources: ["rolebindings", "roles"], verbs: [...READ, ...WRITE] },
  { apiGroups: ["authorization.k8s.io"], resources: ["localsubjectaccessreviews"], verbs: ["create"] },
];

const BUILTIN_ROLES: Record<string, PolicyRule[]> = {
  "cluster-admin": [{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }, { nonResourceURLs: ["*"], verbs: ["*"] }],
  admin: ADMIN_RULES,
  edit: EDIT,
  view: VIEW,
};

const BOOTSTRAP = { "kubernetes.io/bootstrapping": "rbac-defaults" };

// Not from meta(): uids must not use c.seq, which names generated Pods.
const builtinMeta = (c: Cluster, kind: string, name: string) => ({
  uid: `${kind}/${name}`, name, namespace: "", labels: { ...BOOTSTRAP }, annotations: { "rbac.authorization.kubernetes.io/autoupdate": "true" }, createdAt: c.clock,
});

/** The user-facing ClusterRoles, and the binding that makes system:masters cluster-admin. */
export function builtinRbac(c: Cluster): (ClusterRole | ClusterRoleBinding)[] {
  return [
    ...Object.entries(BUILTIN_ROLES).map(([name, rules]): ClusterRole => ({ kind: "ClusterRole", metadata: builtinMeta(c, "clusterrole", name), rules: structuredClone(rules) })),
    { kind: "ClusterRoleBinding", metadata: builtinMeta(c, "clusterrolebinding", "cluster-admin"), subjects: [{ kind: "Group", name: MASTERS }], roleRef: { kind: "ClusterRole", name: "cluster-admin" } },
  ];
}

/** Every namespace has a ServiceAccount named default; the controller recreates it when deleted. */
export function ensureDefaultServiceAccounts(c: Cluster) {
  for (const ns of c.namespaces) {
    if (find(c, "ServiceAccount", ns, "default")) continue;
    c.resources.push({ kind: "ServiceAccount", metadata: { uid: `sa/${ns}/default`, name: "default", namespace: ns, labels: {}, annotations: {}, createdAt: c.clock } });
  }
}

/** The ServiceAccount admission plugin: a Pod's account must exist. */
export function serviceAccountError(c: Cluster, p: Pod): string | null {
  const name = p.spec?.serviceAccountName ?? "default";
  const ns = p.metadata.namespace;
  if (name === "default" || find(c, "ServiceAccount", ns, name)) return null;
  return `error looking up service account ${ns}/${name}: serviceaccount "${name}" not found`;
}

// --- create role / rolebinding ---

/** Rules `kubectl create role` writes: one per API group, each with every verb. */
export function rulesFromFlags(verbs: string[], resources: string[], names: string[]): PolicyRule[] | string {
  if (!verbs.length) return "error: at least one verb must be specified";
  if (!resources.length) return "error: at least one resource must be specified";
  const bad = verbs.find((v) => !VERBS.includes(v));
  if (bad) return `error: invalid verb: '${bad}'`;
  const byGroup = new Map<string, string[]>();
  for (const raw of resources) {
    const [base, sub, extra] = raw.split("/");
    const r = apiResource(base);
    if (!r || extra !== undefined || sub === "") return `error: the server doesn't have a resource type "${base}"`;
    const group = r.group === "*" ? "*" : r.group;
    byGroup.set(group, [...(byGroup.get(group) ?? []), sub ? `${r.resource}/${sub}` : r.resource]);
  }
  return [...byGroup].map(([group, res]) => ({ apiGroups: [group], resources: res, verbs: [...verbs], ...(names.length && { resourceNames: [...names] }) }));
}

export function subjectsFromFlags(users: string[], groups: string[], serviceAccounts: string[]): Subject[] | string {
  const subjects: Subject[] = [...users.map((name): Subject => ({ kind: "User", name })), ...groups.map((name): Subject => ({ kind: "Group", name }))];
  for (const sa of serviceAccounts) {
    const [namespace, name, extra] = sa.split(":");
    if (!namespace || !name || extra !== undefined) return `error: serviceaccount must be <namespace>:<name>`;
    subjects.push({ kind: "ServiceAccount", name, namespace });
  }
  return subjects;
}

// --- Display ---

export const RBAC_HEADERS = {
  ServiceAccount: ["NAME", "SECRETS", "AGE"],
  Role: ["NAME", "CREATED AT"],
  ClusterRole: ["NAME", "CREATED AT"],
  RoleBinding: ["NAME", "ROLE", "AGE"],
  ClusterRoleBinding: ["NAME", "ROLE", "AGE"],
};
export const BINDING_WIDE_HEADER = ["USERS", "GROUPS", "SERVICEACCOUNTS"];

type RbacObject = ServiceAccount | Role | ClusterRole | RoleBinding | ClusterRoleBinding;

const subjectNames = (b: RoleBinding | ClusterRoleBinding, kind: Subject["kind"]) =>
  b.subjects.filter((s) => s.kind === kind).map((s) => (kind === "ServiceAccount" ? `${s.namespace ?? ""}/${s.name}` : s.name)).join(", ");

export function rbacRow(c: Cluster, r: RbacObject, wide: boolean): string[] {
  const created = age(c, r.metadata.createdAt);
  switch (r.kind) {
    case "ServiceAccount":
      return [r.metadata.name, "0", created];
    case "Role":
    case "ClusterRole":
      return [r.metadata.name, timestamp(r.metadata.createdAt)];
    default: {
      const row = [r.metadata.name, `${r.roleRef.kind}/${r.roleRef.name}`, created];
      return wide ? [...row, subjectNames(r, "User"), subjectNames(r, "Group"), subjectNames(r, "ServiceAccount")] : row;
    }
  }
}

const subjectYaml = (s: Subject) => (s.kind === "ServiceAccount" ? s : { apiGroup: RBAC_GROUP, ...s });

export function rbacManifest(r: RbacObject, metadata: Record<string, unknown>) {
  switch (r.kind) {
    case "ServiceAccount":
      return { apiVersion: "v1", kind: "ServiceAccount", metadata, automountServiceAccountToken: r.automountServiceAccountToken };
    case "Role":
    case "ClusterRole":
      return { apiVersion: `${RBAC_GROUP}/v1`, kind: r.kind, metadata, rules: r.rules };
    default:
      return { apiVersion: `${RBAC_GROUP}/v1`, kind: r.kind, metadata, roleRef: { apiGroup: RBAC_GROUP, ...r.roleRef }, subjects: r.subjects.length ? r.subjects.map(subjectYaml) : undefined };
  }
}

const bracket = (items?: string[]) => `[${(items ?? []).join(" ")}]`;

/** Rows of `Resources  Non-Resource URLs  Resource Names  Verbs`, merged per resource and names, as kubectl prints them. */
function ruleRows(rules: PolicyRule[]): string[][] {
  const rows = new Map<string, string[]>();
  for (const r of rules) {
    const keys = r.nonResourceURLs?.length
      ? [["", bracket(r.nonResourceURLs), "[]"]]
      : (r.apiGroups ?? []).flatMap((g) => (r.resources ?? []).map((res) => [g ? `${res}.${g}` : res, "[]", bracket(r.resourceNames)]));
    for (const key of keys) {
      const id = key.join("\u0000");
      const verbs = rows.get(id) ?? [];
      rows.set(id, [...verbs, ...r.verbs.filter((v) => !verbs.includes(v))]);
    }
  }
  return [...rows].map(([id, verbs]) => [...id.split("\u0000"), bracket(verbs)]);
}

const RULE_HEADER = ["Resources", "Non-Resource URLs", "Resource Names", "Verbs"];

export function describeRbac(r: RbacObject): string {
  const head: [string, string][] = [
    ["Name", r.metadata.name],
    ["Labels", labelText(r.metadata.labels)],
    ["Annotations", annotationText(r.metadata.annotations)],
  ];
  switch (r.kind) {
    case "ServiceAccount":
      return aligned([
        head[0],
        ["Namespace", r.metadata.namespace],
        ...head.slice(1),
        ["Image pull secrets", "<none>"],
        ["Mountable secrets", "<none>"],
        ["Tokens", "<none>"],
      ]);
    case "Role":
    case "ClusterRole": {
      const rows = ruleRows(r.rules);
      return `${aligned(head)}\nPolicyRule:\n${table([RULE_HEADER, RULE_HEADER.map((h) => "-".repeat(h.length)), ...rows]).replace(/^/gm, "  ")}`;
    }
    default: {
      const subjects = r.subjects.map((s) => [s.kind, s.name, s.namespace ?? ""]);
      return [
        aligned(head),
        "Role:",
        `  Kind:  ${r.roleRef.kind}`,
        `  Name:  ${r.roleRef.name}`,
        "Subjects:",
        table([["Kind", "Name", "Namespace"], ["----", "----", "---------"], ...subjects]).replace(/^/gm, "  "),
      ].join("\n");
    }
  }
}

/** What every authenticated identity may do (system:basic-user, system:discovery, system:public-info-viewer). */
const BASE_RULES: PolicyRule[] = [
  { apiGroups: ["authentication.k8s.io"], resources: ["selfsubjectreviews"], verbs: ["create"] },
  { apiGroups: ["authorization.k8s.io"], resources: ["selfsubjectaccessreviews", "selfsubjectrulesreviews"], verbs: ["create"] },
  ...["/.well-known/openid-configuration/", "/api/*", "/api", "/apis/*", "/apis", "/healthz", "/livez", "/openapi/*", "/openapi", "/readyz", "/version/", "/version"].map(
    (url): PolicyRule => ({ nonResourceURLs: [url], verbs: ["get"] }),
  ),
];

/** `kubectl auth can-i --list`. */
export function canIList(c: Cluster, u: User, ns: string): string {
  const rules = u.groups.includes(MASTERS) ? BUILTIN_ROLES["cluster-admin"] : [...rulesFor(c, u, ns), ...BASE_RULES];
  const rows = ruleRows(rules);
  const byResource = (a: string[], b: string[]) => (a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1);
  const resources = rows.filter((r) => r[0]).sort(byResource);
  return table([RULE_HEADER, ...resources, ...rows.filter((r) => !r[0])]);
}
