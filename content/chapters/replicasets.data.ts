import type { ChapterData } from "../types";

export const data: ChapterData = {
  objectives: [
    "Explain how a ReplicaSet keeps a desired number of Pods running.",
    "Describe how a selector decides which Pods a ReplicaSet owns, including standalone Pods with matching labels.",
    "Scale a ReplicaSet and predict what happens when one of its Pods is deleted.",
    "Read a ReplicaSet manifest and explain why its template labels must match its selector.",
    "Explain why you normally create a Deployment instead of a ReplicaSet.",
  ],
  quiz: [
    {
      id: "replicasets-ownership",
      topic: "Labels and selectors",
      difficulty: "beginner",
      question: "How does a ReplicaSet decide which Pods count toward its replicas?",
      options: [
        { id: "a", text: "It keeps a list of the Pod names it created" },
        { id: "b", text: "It counts Pods whose labels match its selector" },
        { id: "c", text: "It counts every Pod on the same node" },
        { id: "d", text: "It counts every Pod that uses the same image" },
      ],
      correctOptionId: "b",
      explanation:
        "A ReplicaSet finds its Pods through spec.selector. Names, nodes, and images play no part, which is why a standalone Pod with matching labels can be adopted.",
    },
    {
      id: "replicasets-adopt",
      topic: "Labels and selectors",
      difficulty: "intermediate",
      question:
        "A ReplicaSet with replicas: 3 and selector app=frontend has 3 running Pods. You create a bare Pod labelled app=frontend. What happens?",
      options: [
        { id: "a", text: "The API server rejects the new Pod" },
        { id: "b", text: "The ReplicaSet raises its replicas to 4" },
        { id: "c", text: "The ReplicaSet adopts the Pod, sees 4, and deletes one Pod" },
        { id: "d", text: "The ReplicaSet creates a fourth Pod from its template" },
      ],
      correctOptionId: "c",
      explanation:
        "A Pod with matching labels and no owner is adopted. The ReplicaSet then counts 4 Pods against a desired 3 and deletes one. spec.replicas never changes on its own.",
    },
    {
      id: "replicasets-yaml-labels",
      topic: "ReplicaSet YAML",
      difficulty: "beginner",
      question: "What happens if spec.template.metadata.labels does not match spec.selector.matchLabels?",
      options: [
        { id: "a", text: "The API server rejects the ReplicaSet" },
        { id: "b", text: "The ReplicaSet creates Pods but leaves them unready" },
        { id: "c", text: "Kubernetes copies the selector labels into the template" },
        { id: "d", text: "The ReplicaSet runs with 0 replicas" },
      ],
      correctOptionId: "a",
      explanation:
        "Pods built from such a template would never match the selector, so the ReplicaSet would create Pods forever without counting any. The API server refuses the manifest instead.",
    },
    {
      id: "replicasets-update",
      topic: "ReplicaSets",
      difficulty: "intermediate",
      question: "You change the image in a running ReplicaSet's Pod template. What happens to its existing Pods?",
      options: [
        { id: "a", text: "They are replaced one at a time with the new image" },
        { id: "b", text: "They are all deleted and recreated at once" },
        { id: "c", text: "Their containers restart with the new image" },
        { id: "d", text: "Nothing. Only Pods created later use the new image" },
      ],
      correctOptionId: "d",
      explanation:
        "A ReplicaSet only checks the Pod count. It does not update existing Pods. Rolling out a new template is what a Deployment adds on top.",
    },
  ],
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
