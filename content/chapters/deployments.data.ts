import type { ChapterData } from "../types";

export const data: ChapterData = {
  objectives: [
    "Explain how a Deployment, its ReplicaSet, and its Pods relate.",
    "Tell desired state apart from observed state in kubectl output.",
    "Scale a Deployment and confirm the new Pods are ready.",
    "Read every field of a Deployment manifest, including the update strategy.",
  ],
  quiz: [
    {
      id: "deploy-owner",
      topic: "Deployments",
      difficulty: "beginner",
      question: "Which object creates the Pods for a Deployment?",
      options: [
        { id: "a", text: "The Deployment creates them directly" },
        { id: "b", text: "A ReplicaSet owned by the Deployment" },
        { id: "c", text: "The kube-scheduler" },
        { id: "d", text: "The kubelet on the control plane node" },
      ],
      correctOptionId: "b",
      explanation:
        "A Deployment manages ReplicaSets, and each ReplicaSet creates and removes Pods to match its replica count. The scheduler only picks a node for a Pod that already exists.",
    },
    {
      id: "deploy-delete-pod",
      topic: "Deployments",
      difficulty: "beginner",
      question: "A Deployment has replicas: 3. You delete one of its Pods. What happens next?",
      options: [
        { id: "a", text: "The Deployment drops to 2 replicas" },
        { id: "b", text: "Nothing until you run kubectl apply again" },
        { id: "c", text: "The ReplicaSet creates a new Pod with a new name" },
        { id: "d", text: "The deleted Pod restarts with the same name" },
      ],
      correctOptionId: "c",
      explanation:
        "Desired state is still 3. The ReplicaSet sees only 2 matching Pods and creates a replacement. The new Pod gets a new generated name.",
    },
    {
      id: "deploy-selector",
      topic: "Deployment YAML",
      difficulty: "intermediate",
      question: "In a Deployment manifest, spec.selector.matchLabels must match which field?",
      options: [
        { id: "a", text: "metadata.labels of the Deployment" },
        { id: "b", text: "spec.template.metadata.labels" },
        { id: "c", text: "The container name" },
        { id: "d", text: "metadata.name of the Deployment" },
      ],
      correctOptionId: "b",
      explanation:
        "The selector decides which Pods belong to the Deployment, so the Pod template must carry those labels. If they do not match, the API server rejects the manifest. The Deployment's own labels are free to differ.",
    },
    {
      id: "deploy-surge",
      topic: "Deployment YAML",
      difficulty: "advanced",
      question:
        "A Deployment has replicas: 4, maxSurge: 1, and maxUnavailable: 0. During a rolling update, what is the most Pods that can exist at once?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
        { id: "d", text: "8" },
      ],
      correctOptionId: "b",
      explanation:
        "maxSurge: 1 allows one Pod above the desired 4. maxUnavailable: 0 means an old Pod is only removed after a new one is ready, so the count never exceeds 5.",
    },
  ],
  manifests: [{
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
  }],
  labs: [
  {
    id: "deployments-scale",
    title: "Scale the web Deployment",
    difficulty: "beginner",
    scenario: "The web Deployment runs a single nginx Pod. Traffic is going up and you need three.",
    instructions: [
      "Look at the current Deployment, its ReplicaSet, and its Pods.",
      "Scale the web Deployment to three replicas.",
      "Keep checking until all three Pods are ready.",
    ],
    fixture: {
      deployments: [{ name: "web", replicas: 1, image: "nginx:1.27", labels: { app: "web" } }],
    },
    objectives: [
      {
        id: "desired",
        description: "The web Deployment asks for 3 replicas.",
        validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 3 },
      },
      {
        id: "ready",
        description: "3 Pods owned by web are ready.",
        validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 3 },
      },
    ],
    hints: [
      "Start with kubectl get deployments, then kubectl get replicasets and kubectl get pods.",
      "kubectl scale takes the resource type, its name, and --replicas=<n>.",
      "New Pods start as ContainerCreating. Run kubectl get pods again to see them become ready.",
      "Scaling the ReplicaSet directly does not stick: the Deployment sets it back. Scale the Deployment.",
    ],
    solution: ["kubectl scale deployment web --replicas=3", "kubectl get pods"],
  },
],
  diagrams: [],
};
