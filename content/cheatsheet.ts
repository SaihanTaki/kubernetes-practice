export type CheatsheetEntry = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  explanation: string;
  code: string;
  language: "bash" | "yaml";
  /** True when the simulator supports this command, so it can be tried in a lab. */
  simulated: boolean;
  relatedChapter?: string;
};

export const cheatsheet: CheatsheetEntry[] = [
  {
    id: "get-pods",
    title: "List Pods",
    category: "Inspect",
    keywords: ["get", "pods", "status", "ready"],
    explanation: "Shows each Pod with its ready count, status, restarts, and age.",
    code: "kubectl get pods",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-all-namespaces",
    title: "List Pods in every namespace",
    category: "Inspect",
    keywords: ["get", "namespace", "all", "-A"],
    explanation: "Adds a NAMESPACE column and lists across all namespaces.",
    code: "kubectl get pods -A",
    language: "bash",
    simulated: true,
  },
  {
    id: "get-namespace",
    title: "List Pods in one namespace",
    category: "Inspect",
    keywords: ["get", "namespace", "-n"],
    explanation: "Without -n, kubectl uses the default namespace.",
    code: "kubectl get pods -n kube-system",
    language: "bash",
    simulated: true,
  },
  {
    id: "get-selector",
    title: "Filter by label",
    category: "Inspect",
    keywords: ["labels", "selector", "-l", "filter"],
    explanation: "Lists only resources whose labels match. Separate several labels with commas.",
    code: "kubectl get pods -l app=web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-yaml",
    title: "Print a resource as YAML",
    category: "Inspect",
    keywords: ["yaml", "output", "-o", "manifest"],
    explanation: "Shows the full object, including the status the cluster has observed.",
    code: "kubectl get deployment web -o yaml",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-deployments",
    title: "List Deployments and ReplicaSets",
    category: "Deployments",
    keywords: ["get", "deployments", "replicasets", "rs", "deploy"],
    explanation: "READY on a Deployment is ready Pods over desired replicas. A ReplicaSet shows DESIRED, CURRENT, and READY.",
    code: "kubectl get deployments\nkubectl get replicasets",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "describe-deployment",
    title: "Describe a Deployment",
    category: "Deployments",
    keywords: ["describe", "details", "replicas", "strategy"],
    explanation: "Shows the selector, replica counts, strategy, and current ReplicaSet.",
    code: "kubectl describe deployment web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "scale-deployment",
    title: "Scale a Deployment",
    category: "Deployments",
    keywords: ["scale", "replicas", "up", "down"],
    explanation: "Changes spec.replicas. Scale the Deployment, not its ReplicaSet, or the Deployment sets it back.",
    code: "kubectl scale deployment web --replicas=3",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "delete-pod",
    title: "Delete a Pod",
    category: "Pods",
    keywords: ["delete", "pod", "recreate"],
    explanation: "A Pod owned by a ReplicaSet is replaced with a new one. A standalone Pod is gone for good.",
    code: "kubectl delete pod toolbox",
    language: "bash",
    simulated: true,
  },
  {
    id: "delete-deployment",
    title: "Delete a Deployment",
    category: "Deployments",
    keywords: ["delete", "deployment", "cascade"],
    explanation: "Also deletes the ReplicaSets and Pods the Deployment owns.",
    code: "kubectl delete deployment web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "rollout",
    title: "Watch and undo a rollout",
    category: "Deployments",
    keywords: ["rollout", "status", "undo", "history", "update"],
    explanation: "Follows an update until it finishes, or returns to the previous ReplicaSet.",
    code: "kubectl rollout status deployment/web\nkubectl rollout undo deployment/web",
    language: "bash",
    simulated: false,
    relatedChapter: "deployments",
  },
  {
    id: "get-nodes",
    title: "List nodes",
    category: "Cluster",
    keywords: ["get", "nodes", "control plane", "worker", "kubelet"],
    explanation: "Shows each node with its status, roles, and kubelet version. A node is Ready when its kubelet reports in.",
    code: "kubectl get nodes",
    language: "bash",
    simulated: true,
    relatedChapter: "architecture",
  },
  {
    id: "api-resources",
    title: "List resource types and API groups",
    category: "Cluster",
    keywords: ["api-resources", "apiVersion", "group", "kind", "shortnames"],
    explanation: "Shows each kind with its short name and API group. Use it to find the apiVersion for a manifest.",
    code: "kubectl api-resources",
    language: "bash",
    simulated: false,
    relatedChapter: "intro",
  },
  {
    id: "get-pod-yaml",
    title: "Print a Pod as YAML",
    category: "Inspect",
    keywords: ["yaml", "pod", "status", "spec", "-o"],
    explanation: "The status block below spec is filled in by the kubelet and control plane, not by you.",
    code: "kubectl get pod toolbox -o yaml",
    language: "bash",
    simulated: true,
    relatedChapter: "intro",
  },
  {
    id: "describe-pod",
    title: "Describe a Pod",
    category: "Pods",
    keywords: ["describe", "pod", "waiting", "reason", "restart count", "controlled by", "CrashLoopBackOff"],
    explanation: "Shows the node, image, container state with its waiting reason, Restart Count, and Controlled By.",
    code: "kubectl describe pod toolbox",
    language: "bash",
    simulated: true,
    relatedChapter: "pods",
  },
  {
    id: "logs",
    title: "Read container logs",
    category: "Pods",
    keywords: ["logs", "crash", "previous", "CrashLoopBackOff"],
    explanation: "Prints what the container wrote to stdout and stderr. --previous shows the run before the last restart.",
    code: "kubectl logs toolbox\nkubectl logs toolbox --previous",
    language: "bash",
    simulated: false,
    relatedChapter: "pods",
  },
  {
    id: "scale-replicaset",
    title: "Scale a ReplicaSet",
    category: "ReplicaSets",
    keywords: ["scale", "replicaset", "rs", "replicas"],
    explanation: "The controller creates or deletes Pods until the count matches. Scale to 0 to stop the app.",
    code: "kubectl scale replicaset frontend --replicas=5",
    language: "bash",
    simulated: true,
    relatedChapter: "replicasets",
  },
  {
    id: "apply",
    title: "Create or update from a file",
    category: "Manifests",
    keywords: ["apply", "-f", "file", "yaml"],
    explanation: "Sends the manifest to the API server. Running it again with changes updates the object.",
    code: "kubectl apply -f web-deployment.yaml",
    language: "bash",
    simulated: false,
  },
  {
    id: "deployment-yaml",
    title: "Minimal Deployment",
    category: "Manifests",
    keywords: ["deployment", "yaml", "selector", "template", "manifest"],
    explanation: "selector.matchLabels must match the template labels.",
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
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
          image: nginx:1.27`,
    language: "yaml",
    simulated: false,
    relatedChapter: "deployments",
  },
  {
    id: "pod-yaml",
    title: "Minimal Pod",
    category: "Manifests",
    keywords: ["pod", "yaml", "resources", "requests", "limits", "restartPolicy", "manifest"],
    explanation: "Requests decide where the Pod is scheduled. Limits are enforced while it runs.",
    code: `apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  restartPolicy: Always
  containers:
    - name: api
      image: nginx:1.27
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"`,
    language: "yaml",
    simulated: false,
    relatedChapter: "pods",
  },
  {
    id: "replicaset-yaml",
    title: "Minimal ReplicaSet",
    category: "Manifests",
    keywords: ["replicaset", "yaml", "selector", "template", "manifest"],
    explanation: "selector.matchLabels must match the template labels. Usually a Deployment creates this for you.",
    code: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: nginx
          image: nginx:1.27`,
    language: "yaml",
    simulated: false,
    relatedChapter: "replicasets",
  },
];
