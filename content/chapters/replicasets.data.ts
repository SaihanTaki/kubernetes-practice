import type { ChapterData } from "../types";
import { quiz } from "./replicasets.quiz";

export const data: ChapterData = {
  objectives: [
    "Explain how a ReplicaSet keeps a desired number of Pods running.",
    "Describe how a selector decides which Pods a ReplicaSet owns, including standalone Pods with matching labels.",
    "Scale a ReplicaSet and predict what happens when one of its Pods is deleted.",
    "Read a ReplicaSet manifest and explain why its template labels must match its selector.",
    "Explain why you normally create a Deployment instead of a ReplicaSet.",
  ],
  quiz,
  manifests: [
    {
      id: "replicaset",
      title: "frontend-replicaset.yaml",
      yaml: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend
  labels:
    app: frontend
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
          image: nginx:1.27
          ports:
            - containerPort: 80`,
      notes: [
        { line: 1, text: "ReplicaSets belong to the apps API group, version v1, like Deployments." },
        { line: 2, text: "The kind tells the API server which schema to validate the rest against." },
        { line: 4, text: "The ReplicaSet name. Its Pods are named frontend- plus a random suffix." },
        { line: 5, text: "Labels on the ReplicaSet itself. Useful for filtering, but they do not select Pods." },
        { line: 8, text: "Desired number of Pods. kubectl scale changes this field." },
        { line: 9, text: "Which Pods this ReplicaSet counts and owns." },
        { line: 10, text: "matchLabels lists key-value pairs. A Pod must carry all of them to match." },
        { line: 12, text: "The Pod template, used only when the ReplicaSet needs to create a new Pod. Editing it does not touch existing Pods." },
        { line: 15, text: "Every new Pod gets these labels. They must match spec.selector.matchLabels or the API server rejects the manifest." },
        { line: 16, text: "From here down this is an ordinary Pod spec, the same as in a Pod manifest." },
        { line: 19, text: "Pin an exact tag so every replica runs the same image." },
      ],
    },
  ],
  labs: [
    {
      id: "replicasets-scale",
      title: "Scale the frontend ReplicaSet",
      difficulty: "beginner",
      scenario: "The frontend ReplicaSet runs two nginx Pods. You need five to handle more load.",
      instructions: [
        "Look at the current ReplicaSet and its Pods.",
        "Scale the frontend ReplicaSet to five replicas.",
        "Keep checking until all five Pods are ready.",
      ],
      fixture: {
        replicaSets: [{ name: "frontend", replicas: 2, image: "nginx:1.27", labels: { app: "frontend" } }],
      },
      objectives: [
        {
          id: "desired",
          description: "The frontend ReplicaSet asks for 5 replicas.",
          validator: { kind: "replica-count", resourceType: "ReplicaSet", resourceName: "frontend", expectedValue: 5 },
        },
        {
          id: "ready",
          description: "5 Pods owned by frontend are ready.",
          validator: { kind: "ready-pod-count", ownerType: "ReplicaSet", ownerName: "frontend", expectedValue: 5 },
        },
      ],
      hints: [
        "Start with kubectl get replicasets, then kubectl get pods.",
        "kubectl scale takes the resource type, its name, and --replicas=<n>.",
        "New Pods start as ContainerCreating. Run kubectl get pods again to see them become ready.",
        "kubectl get pods -l app=frontend lists only the Pods the ReplicaSet selects.",
      ],
      solution: ["kubectl scale replicaset frontend --replicas=5", "kubectl get pods"],
    },
  ],
  diagrams: [],
};
