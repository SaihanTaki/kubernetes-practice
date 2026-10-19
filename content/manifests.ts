export type Manifest = {
  id: string;
  title: string;
  yaml: string;
  /** Explanations keyed by 1-based line number. */
  notes: { line: number; text: string }[];
};

export const manifests: Record<string, Manifest> = {
  deployment: {
    id: "deployment",
    title: "web-deployment.yaml",
    yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80`,
    notes: [
      { line: 1, text: "Deployments belong to the apps API group, version v1. Pods use plain v1." },
      { line: 2, text: "The kind tells the API server which schema to validate the rest against." },
      { line: 4, text: "The Deployment name. Its ReplicaSets and Pods get names derived from it." },
      { line: 5, text: "Labels on the Deployment itself. Useful for filtering with -l, but they do not select Pods." },
      { line: 8, text: "Desired number of Pods. kubectl scale changes this field." },
      { line: 9, text: "Which Pods this Deployment owns. It cannot be changed after the Deployment is created." },
      { line: 12, text: "How Pods are replaced when the template changes. RollingUpdate is the default. Recreate stops every old Pod first." },
      { line: 15, text: "At most 1 Pod above replicas during an update." },
      { line: 16, text: "Never fewer than replicas ready Pods during an update, so the app stays at full capacity." },
      { line: 17, text: "The Pod template. Changing anything under it starts a rollout with a new ReplicaSet." },
      { line: 20, text: "Every Pod gets these labels. They must match spec.selector.matchLabels or the API server rejects the manifest." },
      { line: 22, text: "From here down this is an ordinary Pod spec, the same as in a Pod manifest." },
      { line: 24, text: "Pin an exact tag. Changing it is the most common way to trigger a rollout." },
    ],
  },
};
