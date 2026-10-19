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
];
