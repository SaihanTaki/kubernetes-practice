import type { ChapterData } from "../types";
import { quiz } from "./rbac.quiz";

const sa = "system:serviceaccount:ci:deployer";

export const data: ChapterData = {
  objectives: [
    "Tell authentication from authorization, and explain why users are not API objects.",
    "Write Roles and ClusterRoles with the right apiGroups, resources, subresources, and verbs.",
    "Choose between RoleBinding and ClusterRoleBinding, and reuse a ClusterRole in one namespace.",
    "Give a workload its own ServiceAccount and control whether its token is mounted.",
    "Grant least privilege and verify it with kubectl auth can-i and --as.",
  ],
  quiz,
  manifests: [
    {
      id: "rbac-serviceaccount",
      title: "deployer-sa.yaml",
      yaml: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: deployer
  namespace: ci
automountServiceAccountToken: false`,
      notes: [
        { line: 1, text: "ServiceAccounts are in the core API group, so the version is plain v1." },
        { line: 4, text: "RBAC sees this identity as system:serviceaccount:ci:deployer." },
        { line: 5, text: "ServiceAccounts are namespaced. A Pod can only use one from its own namespace." },
        {
          line: 6,
          text: "The pipeline runs outside the cluster with a token from kubectl create token, so Pods using this account get no token mounted. Remove the line if a Pod needs to call the API as deployer.",
        },
      ],
    },
    {
      id: "rbac-role",
      title: "deployer-role.yaml",
      yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: ci
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "update"]`,
      notes: [
        { line: 1, text: "Roles, ClusterRoles, and both binding kinds live in the rbac.authorization.k8s.io group." },
        { line: 2, text: "A Role grants access only inside its own namespace. Use a ClusterRole for cluster-scoped resources or reuse across namespaces." },
        { line: 5, text: "The namespace the permissions apply in." },
        { line: 6, text: "Rules are added together. Anything no rule allows is denied; there are no deny rules." },
        { line: 7, text: "The empty string is the core group: pods, services, configmaps, secrets." },
        { line: 8, text: "Lowercase plural resource names. pods does not include pods/log or pods/exec." },
        { line: 9, text: "get reads one Pod, list reads them all. No watch, so kubectl get -w would be refused." },
        { line: 10, text: "Deployments are in apps. Writing \"\" here would match nothing, because core has no deployments." },
        { line: 12, text: "update replaces the object. kubectl apply and set image send patch, so a real pipeline usually needs patch too." },
      ],
    },
    {
      id: "rbac-rolebinding",
      title: "deployer-rolebinding.yaml",
      yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deployer
  namespace: ci
subjects:
  - kind: ServiceAccount
    name: deployer
    namespace: ci
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: deployer`,
      notes: [
        { line: 2, text: "A RoleBinding grants permissions in its own namespace only, even when it points at a ClusterRole." },
        { line: 5, text: "Must match the Role's namespace when roleRef.kind is Role." },
        { line: 6, text: "One binding can list several subjects: Users, Groups, and ServiceAccounts." },
        { line: 9, text: "ServiceAccount subjects need a namespace. User and Group subjects have none and use apiGroup: rbac.authorization.k8s.io instead." },
        { line: 10, text: "roleRef is immutable. To point at a different role, delete and recreate the binding." },
        { line: 12, text: "Role or ClusterRole. A ClusterRole here grants its rules in namespace ci only." },
      ],
    },
  ],
  labs: [
    {
      id: "rbac-deployer",
      title: "Least privilege for a CI ServiceAccount",
      difficulty: "intermediate",
      scenario:
        "The CI pipeline runs as ServiceAccount deployer in namespace ci. It must get and list Pods and update Deployments in ci. It must not read Secrets, and it needs nothing outside ci.",
      instructions: [
        `Check the current state: kubectl auth can-i list pods -n ci --as=${sa}`,
        "Create a Role in ci that allows get and list on pods.",
        "Create a Role in ci that allows update on deployments (API group apps). Add get so the pipeline can read what it updates.",
        "Bind both Roles to the ServiceAccount with kubectl create rolebinding and --serviceaccount=ci:deployer.",
        "Check with kubectl auth can-i that Pods and Deployments are allowed, and that secrets and namespace default are not.",
      ],
      fixture: {
        namespaces: ["ci"],
        deployments: [{ name: "app", namespace: "ci", replicas: 1, image: "nginx:1.27", labels: { app: "app" } }],
        files: {
          "deployer-sa.yaml": `apiVersion: v1
kind: ServiceAccount
metadata:
  name: deployer
  namespace: ci
`,
          "registry-secret.yaml": `apiVersion: v1
kind: Secret
metadata:
  name: registry-token
  namespace: ci
stringData:
  TOKEN: ci-token-123
`,
        },
        apply: ["deployer-sa.yaml", "registry-secret.yaml"],
      },
      objectives: [
        {
          id: "get-pods",
          description: "deployer can get pods in ci.",
          validator: { kind: "can-i", verb: "get", resource: "pods", as: sa, expectedValue: true, namespace: "ci" },
        },
        {
          id: "list-pods",
          description: "deployer can list pods in ci.",
          validator: { kind: "can-i", verb: "list", resource: "pods", as: sa, expectedValue: true, namespace: "ci" },
        },
        {
          id: "update-deployments",
          description: "deployer can update deployments in ci.",
          validator: { kind: "can-i", verb: "update", resource: "deployments", as: sa, expectedValue: true, namespace: "ci" },
        },
        {
          id: "no-get-secrets",
          description: "deployer cannot get secrets in ci.",
          validator: { kind: "can-i", verb: "get", resource: "secrets", as: sa, expectedValue: false, namespace: "ci" },
        },
        {
          id: "no-list-secrets",
          description: "deployer cannot list secrets in ci.",
          validator: { kind: "can-i", verb: "list", resource: "secrets", as: sa, expectedValue: false, namespace: "ci" },
        },
        {
          id: "no-default",
          description: "deployer cannot list pods in namespace default.",
          validator: { kind: "can-i", verb: "list", resource: "pods", as: sa, expectedValue: false, namespace: "default" },
        },
      ],
      hints: [
        "Every command needs -n ci, otherwise the Role or RoleBinding lands in default.",
        "kubectl create role pod-reader --verb=get,list --resource=pods -n ci",
        "Deployments are in the apps group: --resource=deployments.apps",
        "kubectl create rolebinding deployer-pods --role=pod-reader --serviceaccount=ci:deployer -n ci",
        "One Role with --verb=get,list,update --resource=pods,deployments.apps also passes, but it lets the pipeline update Pods too. Two Roles keep it exact.",
        "Do not use the edit ClusterRole: it includes Secrets. Do not use a ClusterRoleBinding: it grants in every namespace.",
      ],
      solution: [
        "kubectl create role pod-reader --verb=get,list --resource=pods -n ci",
        "kubectl create role deployment-updater --verb=get,update --resource=deployments.apps -n ci",
        "kubectl create rolebinding deployer-pods --role=pod-reader --serviceaccount=ci:deployer -n ci",
        "kubectl create rolebinding deployer-deployments --role=deployment-updater --serviceaccount=ci:deployer -n ci",
        `kubectl auth can-i list pods -n ci --as=${sa}`,
        `kubectl auth can-i update deployments -n ci --as=${sa}`,
      ],
    },
  ],
  diagrams: [
    {
      id: "rbac-chain",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "request",
            label: "Request",
            sub: "list pods -n ci",
            detail: "Authentication has already turned the credentials into a username and groups. Now the API server asks RBAC whether that identity may list pods in ci.",
          },
          {
            id: "subject",
            label: "Subject",
            sub: "ServiceAccount ci/deployer",
            detail: "Who the grant is for: a User, a Group, or a ServiceAccount. Users and Groups are only names from the authenticator; ServiceAccounts are API objects.",
          },
          {
            id: "binding",
            label: "RoleBinding deployer",
            sub: "namespace ci",
            detail: "Connects a list of subjects to exactly one role through roleRef. A RoleBinding grants in its own namespace; a ClusterRoleBinding grants everywhere.",
          },
          {
            id: "role",
            label: "Role deployer",
            sub: "namespace ci",
            detail: "A named list of rules. Role is namespaced; ClusterRole is cluster-scoped and can be bound per namespace or cluster-wide.",
          },
          {
            id: "rules",
            label: "Rules",
            sub: "apiGroups + resources + verbs",
            detail: "Each rule allows some verbs on some resources in some API groups, optionally limited by resourceNames. The request is allowed if any rule from any binding matches.",
            children: [
              { id: "rule-pods", label: "\"\" pods", sub: "get, list", detail: "Core group, Pods, read only. Matches the request, so it is allowed." },
              { id: "rule-deploy", label: "apps deployments", sub: "get, update", detail: "Matches only requests for Deployments in the apps group." },
            ],
          },
          {
            id: "decision",
            label: "Decision",
            sub: "allow, or 403 Forbidden",
            detail: "RBAC has no deny rules. If no rule from any binding for the user or its groups matches, the request is refused with Forbidden.",
          },
        ],
      },
      steps: [
        { title: "A request arrives", text: "The authenticated identity system:serviceaccount:ci:deployer wants to list pods in ci.", highlight: ["request"] },
        { title: "Find bindings for the subject", text: "RBAC looks for bindings that name this user, one of its groups, or this ServiceAccount.", highlight: ["subject", "binding"] },
        { title: "Follow roleRef", text: "Each binding points at one Role or ClusterRole.", highlight: ["role"] },
        { title: "Match the rules", text: "The rule for core pods with verb list matches. The Deployments rule is irrelevant for this request.", highlight: ["rules", "rule-pods"] },
        { title: "Allow", text: "One matching rule is enough. A request for secrets would match nothing and get 403 Forbidden.", highlight: ["decision"] },
      ],
    },
    {
      id: "rbac-scope",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "row-rr",
            label: "Role + RoleBinding",
            sub: "the usual namespaced grant",
            detail: "Both objects live in the same namespace, and the permissions apply only there.",
            children: [
              { id: "rr-role", label: "Role", sub: "in namespace ci", detail: "Rules for namespaced resources, defined in one namespace." },
              { id: "rr-grant", label: "Grants in ci only", sub: "pods, deployments in ci", detail: "The subject gets nothing in other namespaces." },
            ],
          },
          {
            id: "row-cr",
            label: "ClusterRole + RoleBinding",
            sub: "define once, grant per namespace",
            detail: "The common way to reuse a role such as view or edit: one ClusterRole, a RoleBinding in each namespace that needs it.",
            children: [
              { id: "cr-role", label: "ClusterRole", sub: "cluster-scoped", detail: "Defined once for the whole cluster, for example the built-in view." },
              { id: "cr-grant", label: "Grants in the binding's namespace", sub: "namespaced resources only", detail: "Cluster-scoped resources such as nodes in the ClusterRole are ignored, because a RoleBinding can only grant inside its namespace." },
            ],
          },
          {
            id: "row-crb",
            label: "ClusterRole + ClusterRoleBinding",
            sub: "cluster-wide grant",
            detail: "For platform admins and cluster components. Use it sparingly.",
            children: [
              { id: "crb-role", label: "ClusterRole", sub: "cluster-scoped", detail: "Can include nodes, namespaces, persistentvolumes, and non-resource URLs." },
              { id: "crb-grant", label: "Grants everywhere", sub: "every namespace + cluster resources", detail: "Including namespaces created later." },
            ],
          },
          {
            id: "row-bad",
            label: "Role + ClusterRoleBinding",
            sub: "not allowed",
            detail: "A ClusterRoleBinding can only reference a ClusterRole. The API server rejects a roleRef to a Role.",
            children: [
              { id: "bad-role", label: "Role", sub: "namespaced", detail: "A Role exists only in its namespace, so it cannot be granted cluster-wide." },
              { id: "bad-grant", label: "Rejected", sub: "invalid roleRef", detail: "Use a ClusterRole if you need the grant everywhere." },
            ],
          },
        ],
      },
      steps: [
        { title: "Namespaced grant", text: "A Role and a RoleBinding in the same namespace. Most app permissions look like this.", highlight: ["row-rr"] },
        { title: "Reuse a ClusterRole", text: "Bind a ClusterRole with a RoleBinding to grant its rules in one namespace only.", highlight: ["row-cr"] },
        { title: "Cluster-wide", text: "A ClusterRoleBinding grants in every namespace and on cluster-scoped resources.", highlight: ["row-crb"] },
        { title: "The combination that does not exist", text: "A ClusterRoleBinding cannot point at a Role.", highlight: ["row-bad"] },
      ],
    },
  ],
};
