import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "rbac-authn-authz",
    topic: "Authentication",
    difficulty: "beginner",
    question: "A request is authenticated as user jane but RBAC does not allow it. What does the API server return?",
    options: [
      { id: "a", text: "401 Unauthorized" },
      { id: "b", text: "403 Forbidden" },
      { id: "c", text: "404 Not Found" },
      { id: "d", text: "The request succeeds with an empty result" },
    ],
    correctOptionId: "b",
    explanation:
      "401 means authentication failed: the API server does not know who you are. Once the identity is known and authorization refuses, the answer is 403 Forbidden.",
  },
  {
    id: "rbac-users",
    topic: "Authentication",
    difficulty: "beginner",
    question: "How do you add a human user named jane to a cluster?",
    options: [
      { id: "a", text: "kubectl create user jane" },
      { id: "b", text: "Apply a manifest with kind: User and name jane" },
      { id: "c", text: "Issue her a credential that the API server trusts, such as a client certificate with CN=jane or an OIDC token" },
      { id: "d", text: "Create a ServiceAccount named jane in the default namespace" },
    ],
    correctOptionId: "c",
    explanation:
      "Kubernetes has no User object. A username is whatever a trusted authenticator produces: the certificate's CN, an OIDC claim, or a webhook. ServiceAccounts are for workloads, not people.",
  },
  {
    id: "rbac-cert-groups",
    topic: "Authentication",
    difficulty: "intermediate",
    question: "A client certificate has CN=jane and O=dev. What does RBAC see?",
    options: [
      { id: "a", text: "User jane in group dev" },
      { id: "b", text: "User dev in group jane" },
      { id: "c", text: "ServiceAccount jane in namespace dev" },
      { id: "d", text: "User jane with no groups; O is ignored" },
    ],
    correctOptionId: "a",
    explanation:
      "The common name becomes the username and each organization becomes a group. Bindings can then grant to User jane or to Group dev.",
  },
  {
    id: "rbac-additive",
    topic: "RBAC model",
    difficulty: "beginner",
    question: "How do you write an RBAC rule that denies jane access to secrets while another binding allows it?",
    options: [
      { id: "a", text: "Add a rule with verbs: [\"deny\"]" },
      { id: "b", text: "Create a RoleBinding with effect: Deny" },
      { id: "c", text: "Put secrets in a ClusterRole, which overrides Roles" },
      { id: "d", text: "You cannot; RBAC has no deny rules, so remove or narrow the binding that allows it" },
    ],
    correctOptionId: "d",
    explanation:
      "RBAC is purely additive. A request is allowed if any rule from any binding matches. To take access away you remove the grant.",
  },
  {
    id: "rbac-apigroup",
    topic: "RBAC model",
    difficulty: "intermediate",
    question: "A Role rule has apiGroups: [\"\"], resources: [\"deployments\"], verbs: [\"update\"]. What can its subject do?",
    options: [
      { id: "a", text: "Update Deployments in the namespace" },
      { id: "b", text: "Update Deployments in every namespace" },
      { id: "c", text: "Nothing: Deployments are in the apps group, so the rule matches no resource" },
      { id: "d", text: "Update every resource in the core group" },
    ],
    correctOptionId: "c",
    explanation:
      "The empty string is the core group (pods, services, secrets). Deployments are apps/v1, so the rule needs apiGroups: [\"apps\"].",
  },
  {
    id: "rbac-logs",
    topic: "RBAC model",
    difficulty: "intermediate",
    question: "A Role allows get and list on pods. kubectl logs web-1 is refused. Why?",
    options: [
      { id: "a", text: "Logs are a subresource, pods/log, and need their own rule with verb get" },
      { id: "b", text: "Logs need a ClusterRole" },
      { id: "c", text: "Logs need the watch verb on pods" },
      { id: "d", text: "kubectl logs only works for cluster-admin" },
    ],
    correctOptionId: "a",
    explanation:
      "Subresources are authorized separately. Add pods/log to resources with verb get. The same applies to pods/exec, which needs create.",
  },
  {
    id: "rbac-exec",
    topic: "RBAC model",
    difficulty: "advanced",
    question: "Which rule lets a user run kubectl exec into Pods in a namespace?",
    options: [
      { id: "a", text: "resources: [\"pods\"], verbs: [\"exec\"]" },
      { id: "b", text: "resources: [\"pods\"], verbs: [\"update\"]" },
      { id: "c", text: "resources: [\"exec\"], verbs: [\"get\"]" },
      { id: "d", text: "resources: [\"pods/exec\"], verbs: [\"create\"]" },
    ],
    correctOptionId: "d",
    explanation:
      "exec is the pods/exec subresource and opening a session is a create. There is no exec verb, and update on pods does not cover subresources.",
  },
  {
    id: "rbac-resourcenames",
    topic: "RBAC model",
    difficulty: "advanced",
    question: "Why can a rule with resourceNames: [\"web\"] not limit the create verb?",
    options: [
      { id: "a", text: "resourceNames only works in ClusterRoles" },
      { id: "b", text: "On create the object does not exist yet and its name is not in the request URL, so there is nothing to match against" },
      { id: "c", text: "create always requires cluster-admin" },
      { id: "d", text: "resourceNames applies only to Secrets" },
    ],
    correctOptionId: "b",
    explanation:
      "Authorization looks at the request URL, and a create is a POST to the collection. resourceNames works for get, update, patch, and delete on named objects.",
  },
  {
    id: "rbac-clusterrole-use",
    topic: "Role vs ClusterRole",
    difficulty: "beginner",
    question: "You need to let a monitoring tool list nodes. Which kind of role must hold that rule?",
    options: [
      { id: "a", text: "A ClusterRole, because nodes are cluster-scoped" },
      { id: "b", text: "A Role in the default namespace" },
      { id: "c", text: "A Role in kube-system" },
      { id: "d", text: "Any Role, as long as the binding is a ClusterRoleBinding" },
    ],
    correctOptionId: "a",
    explanation:
      "Nodes, namespaces, and persistentvolumes are not in any namespace, so only a ClusterRole granted by a ClusterRoleBinding can give access to them.",
  },
  {
    id: "rbac-reuse",
    topic: "Bindings",
    difficulty: "intermediate",
    question: "Teams in namespaces shop and blog each need the same read-only rules in their own namespace only. What is the cleanest setup?",
    options: [
      { id: "a", text: "One ClusterRole and one ClusterRoleBinding per team" },
      { id: "b", text: "Copy the same Role into both namespaces and never change it" },
      { id: "c", text: "One ClusterRole, bound with a RoleBinding in shop and another in blog" },
      { id: "d", text: "One Role in default with a RoleBinding in each namespace" },
    ],
    correctOptionId: "c",
    explanation:
      "A RoleBinding may reference a ClusterRole and grants its rules only in the binding's namespace. A ClusterRoleBinding would grant in every namespace, and a RoleBinding cannot reference a Role from another namespace.",
  },
  {
    id: "rbac-crb-role",
    topic: "Bindings",
    difficulty: "intermediate",
    question: "What happens when you create a ClusterRoleBinding whose roleRef is kind: Role?",
    options: [
      { id: "a", text: "It grants the Role in every namespace" },
      { id: "b", text: "It grants the Role in its own namespace" },
      { id: "c", text: "It is converted to a RoleBinding" },
      { id: "d", text: "The API server rejects it: a ClusterRoleBinding can only reference a ClusterRole" },
    ],
    correctOptionId: "d",
    explanation:
      "A Role exists only inside one namespace, so it cannot be granted cluster-wide. ClusterRoleBindings must point at a ClusterRole.",
  },
  {
    id: "rbac-roleref",
    topic: "Bindings",
    difficulty: "advanced",
    question: "You try to change an existing RoleBinding's roleRef from view to edit with kubectl apply. What happens?",
    options: [
      { id: "a", text: "The binding switches to edit immediately" },
      { id: "b", text: "The update is rejected because roleRef is immutable; delete and recreate the binding" },
      { id: "c", text: "Both roles are granted" },
      { id: "d", text: "The change waits until the subject logs in again" },
    ],
    correctOptionId: "b",
    explanation:
      "roleRef cannot change after creation. That way permission to update a binding's subjects never becomes permission to swap in a stronger role.",
  },
  {
    id: "rbac-builtin-secrets",
    topic: "Built-in roles",
    difficulty: "intermediate",
    question: "Which built-in ClusterRole lets its subject read Secrets in the namespace it is bound in?",
    options: [
      { id: "a", text: "view" },
      { id: "b", text: "system:basic-user" },
      { id: "c", text: "None of them" },
      { id: "d", text: "edit" },
    ],
    correctOptionId: "d",
    explanation:
      "edit (and admin) include read and write on Secrets. view deliberately excludes Secrets because reading one can reveal credentials that grant more access.",
  },
  {
    id: "rbac-admin-vs-edit",
    topic: "Built-in roles",
    difficulty: "intermediate",
    question: "What does the admin ClusterRole add over edit when bound with a RoleBinding?",
    options: [
      { id: "a", text: "Managing Roles and RoleBindings in that namespace" },
      { id: "b", text: "Access to every namespace" },
      { id: "c", text: "Deleting the namespace and changing its ResourceQuota" },
      { id: "d", text: "Managing nodes" },
    ],
    correctOptionId: "a",
    explanation:
      "admin can grant access within its namespace. Bound with a RoleBinding it stays inside that namespace and cannot touch the namespace object, quotas, or nodes.",
  },
  {
    id: "rbac-sa-username",
    topic: "ServiceAccounts",
    difficulty: "beginner",
    question: "What username does RBAC see for ServiceAccount deployer in namespace ci?",
    options: [
      { id: "a", text: "deployer" },
      { id: "b", text: "ci:deployer" },
      { id: "c", text: "system:serviceaccount:ci:deployer" },
      { id: "d", text: "serviceaccount/deployer" },
    ],
    correctOptionId: "c",
    explanation:
      "ServiceAccount usernames are system:serviceaccount:<namespace>:<name>. ci:deployer is only the shorthand used by kubectl create rolebinding --serviceaccount.",
  },
  {
    id: "rbac-default-sa",
    topic: "ServiceAccounts",
    difficulty: "beginner",
    question: "A Pod spec does not set serviceAccountName. Which identity does it run as?",
    options: [
      { id: "a", text: "The user who created the Pod" },
      { id: "b", text: "The ServiceAccount named default in the Pod's namespace" },
      { id: "c", text: "No identity, so it cannot reach the API server" },
      { id: "d", text: "system:masters" },
    ],
    correctOptionId: "b",
    explanation:
      "Every namespace has a default ServiceAccount, and Pods use it unless they name another. It has no extra permissions unless someone binds roles to it.",
  },
  {
    id: "rbac-token",
    topic: "ServiceAccounts",
    difficulty: "advanced",
    question: "How does a Pod receive its ServiceAccount token in current Kubernetes?",
    options: [
      { id: "a", text: "A projected, short-lived token bound to the Pod, refreshed by the kubelet" },
      { id: "b", text: "A long-lived token Secret created for every ServiceAccount" },
      { id: "c", text: "An environment variable named KUBE_TOKEN" },
      { id: "d", text: "The node's kubelet certificate" },
    ],
    correctOptionId: "a",
    explanation:
      "The kubelet requests a token through the TokenRequest API and mounts it under /var/run/secrets/kubernetes.io/serviceaccount. It expires, is rotated, and stops working when the Pod is deleted. Automatic token Secrets stopped in 1.24.",
  },
  {
    id: "rbac-escalate",
    topic: "Least privilege",
    difficulty: "advanced",
    question: "Which permission lets a user grant themselves admin in a namespace even though they do not hold admin's permissions?",
    options: [
      { id: "a", text: "get on rolebindings" },
      { id: "b", text: "list on pods" },
      { id: "c", text: "watch on roles" },
      { id: "d", text: "bind on the admin ClusterRole, plus create on rolebindings" },
    ],
    correctOptionId: "d",
    explanation:
      "Normally you can only bind a role whose permissions you already hold. The bind verb lifts that check, as escalate does for editing role rules. Treat both, and impersonate, like admin rights.",
  },
  {
    id: "rbac-list-secrets",
    topic: "Least privilege",
    difficulty: "intermediate",
    question: "Why is list on secrets as sensitive as get on every Secret?",
    options: [
      { id: "a", text: "It is not; list returns only names" },
      { id: "b", text: "list also allows deleting Secrets" },
      { id: "c", text: "The list response contains every Secret's full data" },
      { id: "d", text: "list grants access in all namespaces" },
    ],
    correctOptionId: "c",
    explanation:
      "A list returns full objects, including data. kubectl get secrets -o yaml prints every value. watch behaves the same way.",
  },
  {
    id: "rbac-yaml-subject",
    topic: "RoleBinding YAML",
    difficulty: "intermediate",
    question: "Which subjects entry binds ServiceAccount deployer from namespace ci?",
    options: [
      { id: "a", text: "- { kind: User, name: deployer }" },
      { id: "b", text: "- { kind: ServiceAccount, name: deployer, namespace: ci }" },
      { id: "c", text: "- { kind: ServiceAccount, name: system:serviceaccount:deployer }" },
      { id: "d", text: "- { kind: Pod, name: deployer, namespace: ci }" },
    ],
    correctOptionId: "b",
    explanation:
      "ServiceAccount subjects use the short name plus their namespace. kind: User with name deployer would match a human user called deployer, and Pods cannot be subjects.",
  },
  {
    id: "rbac-yaml-roleref",
    topic: "RoleBinding YAML",
    difficulty: "intermediate",
    question: "A RoleBinding in namespace shop has roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: view }. What does it grant?",
    options: [
      { id: "a", text: "Read access to most objects in every namespace" },
      { id: "b", text: "Nothing, because a RoleBinding cannot reference a ClusterRole" },
      { id: "c", text: "Read access to nodes" },
      { id: "d", text: "The view rules, in namespace shop only" },
    ],
    correctOptionId: "d",
    explanation:
      "A RoleBinding always grants in its own namespace, even when it references a ClusterRole. That is how one ClusterRole is reused per namespace.",
  },
  {
    id: "rbac-yaml-apigroups",
    topic: "Role YAML",
    difficulty: "beginner",
    question: "Which rule lets a Role read ConfigMaps?",
    options: [
      { id: "a", text: "{ apiGroups: [\"\"], resources: [\"configmaps\"], verbs: [\"get\", \"list\"] }" },
      { id: "b", text: "{ apiGroups: [\"apps\"], resources: [\"configmaps\"], verbs: [\"get\", \"list\"] }" },
      { id: "c", text: "{ apiGroups: [\"\"], resources: [\"ConfigMap\"], verbs: [\"read\"] }" },
      { id: "d", text: "{ apiGroups: [\"v1\"], resources: [\"configmaps\"], verbs: [\"get\"] }" },
    ],
    correctOptionId: "a",
    explanation:
      "ConfigMaps are in the core group, written as the empty string. Resources are lowercase plurals, read is not a verb, and v1 is a version, not a group.",
  },
  {
    id: "rbac-yaml-automount",
    topic: "ServiceAccount YAML",
    difficulty: "intermediate",
    question: "A ServiceAccount sets automountServiceAccountToken: false and a Pod using it sets automountServiceAccountToken: true. Is the token mounted?",
    options: [
      { id: "a", text: "No, the ServiceAccount setting always wins" },
      { id: "b", text: "Only if the Pod runs in kube-system" },
      { id: "c", text: "Yes, the Pod's setting takes precedence" },
      { id: "d", text: "The Pod is rejected because the settings conflict" },
    ],
    correctOptionId: "c",
    explanation:
      "The field exists on both objects and the Pod spec wins. Set it to false on the ServiceAccount as the default, and opt in per Pod where the app calls the API.",
  },
  {
    id: "rbac-yaml-subresource",
    topic: "Role YAML",
    difficulty: "intermediate",
    question: "Which resources list lets a Role's get verb cover both Pods and their logs?",
    options: [
      { id: "a", text: "resources: [\"pods\"]" },
      { id: "b", text: "resources: [\"pods\", \"pods/log\"]" },
      { id: "c", text: "resources: [\"pods.log\"]" },
      { id: "d", text: "resources: [\"logs\"]" },
    ],
    correctOptionId: "b",
    explanation:
      "pods/log is a separate resource for authorization. pods alone does not include it, and neither logs nor pods.log names a resource; subresources are written with a slash.",
  },
  {
    id: "rbac-can-i",
    topic: "Testing access",
    difficulty: "beginner",
    question: "Which command checks whether ServiceAccount deployer in ci may list Secrets there?",
    options: [
      { id: "a", text: "kubectl get secrets -n ci --user=deployer" },
      { id: "b", text: "kubectl describe serviceaccount deployer -n ci" },
      { id: "c", text: "kubectl auth can-i list secrets -n ci --as=system:serviceaccount:ci:deployer" },
      { id: "d", text: "kubectl auth whoami -n ci" },
    ],
    correctOptionId: "c",
    explanation:
      "auth can-i asks the API server for a yes or no, and --as impersonates the ServiceAccount by its full username. describe serviceaccount does not show permissions, and --user picks a kubeconfig entry rather than impersonating.",
  },
  {
    id: "rbac-as-permission",
    topic: "Testing access",
    difficulty: "advanced",
    question: "Why can a cluster admin use --as=jane, while jane cannot use --as=cluster-admin-user?",
    options: [
      { id: "a", text: "--as only works with ServiceAccounts" },
      { id: "b", text: "Impersonation needs the impersonate verb on users, groups, or serviceaccounts, which the admin has and jane does not" },
      { id: "c", text: "--as only lowers permissions, never raises them" },
      { id: "d", text: "jane has to log out first" },
    ],
    correctOptionId: "b",
    explanation:
      "--as sends impersonation headers, and the API server checks that the real caller may impersonate that identity. That is why impersonate is a dangerous permission to hand out.",
  },
  {
    id: "rbac-masters",
    topic: "Authentication",
    difficulty: "advanced",
    question: "A client certificate in group system:masters leaks. Why does deleting RoleBindings not help?",
    options: [
      { id: "a", text: "system:masters bypasses RBAC entirely, so the certificate stays all-powerful until it expires" },
      { id: "b", text: "RoleBindings for system:masters are recreated by the API server" },
      { id: "c", text: "It does help; deleting the ClusterRoleBinding for cluster-admin revokes it" },
      { id: "d", text: "Certificates are checked only once, when kubectl first connects" },
    ],
    correctOptionId: "a",
    explanation:
      "Members of system:masters skip RBAC, so no binding grants or removes their access. Users are not API objects either, so the only fix is at the credential source. Hand out credentials for named users or groups bound to roles instead.",
  },
  {
    id: "rbac-crb-scope",
    topic: "Bindings",
    difficulty: "intermediate",
    question: "You bind the edit ClusterRole to ServiceAccount ci:deployer with a ClusterRoleBinding. Where can deployer now write objects?",
    options: [
      { id: "a", text: "Only in namespace ci, because the ServiceAccount lives there" },
      { id: "b", text: "Nowhere until you also add a RoleBinding" },
      { id: "c", text: "In every namespace, including Secrets in each" },
      { id: "d", text: "Only on cluster-scoped resources" },
    ],
    correctOptionId: "c",
    explanation:
      "A ClusterRoleBinding grants its ClusterRole in every namespace, wherever the subject lives. edit includes Secrets. To limit it to ci, use a RoleBinding in ci instead.",
  },
  {
    id: "rbac-verbs-watch",
    topic: "Rules",
    difficulty: "beginner",
    question: "A Role allows get and list on pods. Which command is refused?",
    options: [
      { id: "a", text: "kubectl get pods" },
      { id: "b", text: "kubectl get pod web-1" },
      { id: "c", text: "kubectl get pods -o yaml" },
      { id: "d", text: "kubectl get pods -w" },
    ],
    correctOptionId: "d",
    explanation:
      "get reads one object and list reads a collection, so a, b and c work. -w streams changes, which needs the watch verb, and the Role does not have it.",
  },
  {
    id: "rbac-patch",
    topic: "Rules",
    difficulty: "intermediate",
    question: "A Role allows get and update on deployments in apps. The pipeline runs kubectl set image and gets Forbidden. What is missing?",
    options: [
      { id: "a", text: "The create verb" },
      { id: "b", text: "The patch verb, because set image and apply send a patch rather than a full update" },
      { id: "c", text: "The deployments/scale subresource" },
      { id: "d", text: "apiGroups: [\"\"] next to apps" },
    ],
    correctOptionId: "b",
    explanation:
      "update replaces the whole object; patch changes part of it. kubectl set image and kubectl apply send patch requests, so the rule needs patch as well. Deployments are only in apps, so adding the core group changes nothing.",
  },
  {
    id: "rbac-forbidden-read",
    topic: "Least privilege",
    difficulty: "intermediate",
    question: "CI fails with: User \"system:serviceaccount:ci:deployer\" cannot patch resource \"deployments\" in API group \"apps\" in the namespace \"ci\". What is the least-privilege fix?",
    options: [
      { id: "a", text: "A ClusterRoleBinding of cluster-admin to the ServiceAccount" },
      { id: "b", text: "A RoleBinding of the edit ClusterRole in ci" },
      { id: "c", text: "Add patch on deployments in apiGroups [\"\"] to a ClusterRole" },
      { id: "d", text: "A Role in ci allowing patch on deployments in group apps, bound to the ServiceAccount with a RoleBinding" },
    ],
    correctOptionId: "d",
    explanation:
      "The message names the verb, resource, API group and namespace, so grant exactly that. cluster-admin hands over the whole cluster, edit adds Secrets and much more, and the core group has no deployments.",
  },
  {
    id: "rbac-create-pods",
    topic: "Least privilege",
    difficulty: "advanced",
    question: "Why is create on pods in a namespace a powerful permission?",
    options: [
      { id: "a", text: "The new Pod can mount any Secret in the namespace and run as any ServiceAccount there, inheriting its permissions" },
      { id: "b", text: "It also allows creating Pods in every other namespace" },
      { id: "c", text: "It includes pods/exec on all existing Pods" },
      { id: "d", text: "It is not; create on pods only starts containers" },
    ],
    correctOptionId: "a",
    explanation:
      "A Pod spec can name any Secret volume and any serviceAccountName in its namespace. Whoever can create Pods can read those Secrets and act as those ServiceAccounts. It stays within the namespace and does not grant exec.",
  },
  {
    id: "rbac-default-binding",
    topic: "ServiceAccounts",
    difficulty: "intermediate",
    question: "One app in namespace shop needs to list ConfigMaps. Why not bind that Role to the default ServiceAccount?",
    options: [
      { id: "a", text: "The default ServiceAccount cannot be a binding subject" },
      { id: "b", text: "Every Pod in shop that does not set serviceAccountName would get the permission too" },
      { id: "c", text: "The default ServiceAccount has no token" },
      { id: "d", text: "Roles cannot grant access to ConfigMaps" },
    ],
    correctOptionId: "b",
    explanation:
      "Pods run as default unless they name another account, so a grant to default reaches all of them. Give the app its own ServiceAccount and set spec.serviceAccountName.",
  },
  {
    id: "rbac-sa-groups",
    topic: "ServiceAccounts",
    difficulty: "advanced",
    question: "A RoleBinding in namespace ci has subject {kind: Group, name: system:serviceaccounts:ci}. Who gets the role?",
    options: [
      { id: "a", text: "Only the ServiceAccount named ci" },
      { id: "b", text: "Every ServiceAccount in the cluster" },
      { id: "c", text: "Every ServiceAccount in namespace ci" },
      { id: "d", text: "No one; ServiceAccounts cannot be in groups" },
    ],
    correctOptionId: "c",
    explanation:
      "Each ServiceAccount is in system:serviceaccounts (all of them) and system:serviceaccounts:<namespace>. The second group covers every account in ci.",
  },
  {
    id: "rbac-sa-namespace",
    topic: "ServiceAccounts",
    difficulty: "intermediate",
    question: "A Pod in namespace web sets serviceAccountName: deployer, but deployer exists only in namespace ci. What happens?",
    options: [
      { id: "a", text: "The Pod is not created, because a Pod can only use a ServiceAccount from its own namespace" },
      { id: "b", text: "The Pod runs as ci:deployer" },
      { id: "c", text: "The Pod runs as default" },
      { id: "d", text: "The Pod runs with no identity" },
    ],
    correctOptionId: "a",
    explanation:
      "ServiceAccounts are namespaced and serviceAccountName is looked up in the Pod's own namespace. When it does not exist there, the Pod is rejected. It never falls back to default or reaches into another namespace.",
  },
  {
    id: "rbac-create-token",
    topic: "ServiceAccounts",
    difficulty: "intermediate",
    question: "A pipeline outside the cluster needs a token for ServiceAccount deployer in ci. What is the current way to get one?",
    options: [
      { id: "a", text: "Read the token Secret created automatically for the ServiceAccount" },
      { id: "b", text: "Copy the client certificate from your kubeconfig" },
      { id: "c", text: "kubectl describe serviceaccount deployer -n ci" },
      { id: "d", text: "kubectl create token deployer -n ci, which issues a short-lived token" },
    ],
    correctOptionId: "d",
    explanation:
      "Since 1.24 no long-lived token Secret is created per ServiceAccount. kubectl create token asks the TokenRequest API for a short-lived one. Your kubeconfig certificate would run the pipeline as you, not as deployer.",
  },
  {
    id: "rbac-create-role-cmd",
    topic: "Roles",
    difficulty: "intermediate",
    question: "You run kubectl create role r --verb=get,update --resource=pods,deployments.apps -n ci. What does the Role allow?",
    options: [
      { id: "a", text: "get on pods and update on deployments only" },
      { id: "b", text: "get and update on both pods and deployments, because the command applies every verb to every resource" },
      { id: "c", text: "Nothing; deployments.apps is not a valid resource name" },
      { id: "d", text: "get and update on pods only; deployments needs a second command" },
    ],
    correctOptionId: "b",
    explanation:
      "kubectl create role grants every listed verb on every listed resource, and deployments.apps is resource.group, which sets apiGroups apps. To give different verbs per resource, write YAML or create two Roles.",
  },
  {
    id: "rbac-aggregation",
    topic: "Roles",
    difficulty: "advanced",
    question: "You install a CRD and want users bound to the view ClusterRole to read its objects. How?",
    options: [
      { id: "a", text: "Edit the view ClusterRole by hand" },
      { id: "b", text: "Nothing; view covers every resource automatically" },
      { id: "c", text: "Create a ClusterRole with read rules for the CRD and the label rbac.authorization.k8s.io/aggregate-to-view: \"true\"" },
      { id: "d", text: "Create a RoleBinding from view to the CRD" },
    ],
    correctOptionId: "c",
    explanation:
      "view, edit and admin are aggregated: they collect rules from ClusterRoles carrying the matching aggregate-to label. Hand edits to view are overwritten by the aggregation, and a binding points at subjects, not resources.",
  },
];
