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
  diagrams: [
    {
      id: "rs-reconcile",
      root: {
        id: "loop",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "trigger",
            label: "Something changes",
            sub: "a Pod or the ReplicaSet is added, updated, or deleted",
            detail: "The controller watches Pods and ReplicaSets through the API server. Any change to either wakes it up to check the ReplicaSet again.",
          },
          {
            id: "desired",
            label: "Desired count",
            sub: "spec.replicas: 3",
            detail: "The number of Pods you asked for. It changes only when you edit the ReplicaSet, for example with kubectl scale.",
          },
          {
            id: "count",
            label: "Count matching Pods",
            sub: "Pods whose labels match spec.selector",
            detail: "The controller lists Pods in the namespace that match the selector and are not being deleted. This is the actual count.",
          },
          {
            id: "compare",
            label: "Compare actual with desired",
            sub: "one of three outcomes",
            detail: "The controller closes the gap in one direction or does nothing. The next change starts the loop again.",
            children: [
              {
                id: "too-few",
                label: "Too few",
                sub: "create Pods from the template",
                detail: "Each new Pod gets the template's labels and spec, a generated name, and an ownerReference to the ReplicaSet.",
              },
              {
                id: "too-many",
                label: "Too many",
                sub: "delete the extras",
                detail: "The controller deletes Pods until the count matches, preferring ones that are not yet scheduled or ready.",
              },
              {
                id: "equal",
                label: "Equal",
                sub: "do nothing",
                detail: "The actual state already matches the desired state, so there is nothing to change.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Desired state",
          text: "The ReplicaSet asks for 3 Pods, and 3 matching Pods are running.",
          highlight: ["desired"],
        },
        {
          title: "A Pod is deleted",
          text: "You delete one of the Pods. The deletion is a change the controller is watching, so it checks the ReplicaSet again.",
          highlight: ["trigger"],
        },
        {
          title: "Count the Pods",
          text: "The controller finds 2 Pods matching the selector, against 3 desired.",
          highlight: ["desired", "count"],
        },
        {
          title: "Create a replacement",
          text: "2 is fewer than 3, so the controller creates 1 new Pod from the template, with a new name.",
          highlight: ["too-few"],
        },
        {
          title: "Back in balance",
          text: "Creating the Pod is itself a change. The controller counts again, finds 3, and does nothing.",
          highlight: ["count", "equal"],
        },
      ],
    },
    {
      id: "rs-selector",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "rs",
            label: "ReplicaSet frontend",
            sub: "replicas: 3, selector app=frontend",
            detail: "The ReplicaSet does not store Pod names. On every check it looks for Pods in its namespace whose labels match its selector.",
          },
          {
            id: "pods",
            label: "Pods in the namespace",
            sub: "each box shows its labels",
            detail: "Only labels decide what the ReplicaSet counts. Pod names, images, and who created the Pod do not matter.",
            children: [
              {
                id: "matched",
                label: "Match app=frontend",
                detail: "These Pods carry app=frontend, so the ReplicaSet counts them toward its 3 replicas.",
                layout: "column",
                children: [
                  {
                    id: "owned-1",
                    label: "frontend-x8k2p",
                    sub: "app=frontend, owned",
                    detail: "Created from the ReplicaSet's template. Its ownerReferences entry points at ReplicaSet frontend.",
                  },
                  {
                    id: "owned-2",
                    label: "frontend-q4mzn",
                    sub: "app=frontend, owned",
                    detail: "Created from the ReplicaSet's template. Its ownerReferences entry points at ReplicaSet frontend.",
                  },
                  {
                    id: "bare",
                    label: "cache-test",
                    sub: "app=frontend, no owner",
                    detail: "A Pod created directly with kubectl. It matches the selector and has no controller, so the ReplicaSet adopts it by adding an ownerReference.",
                  },
                ],
              },
              {
                id: "unmatched",
                label: "No match",
                detail: "These Pods do not carry app=frontend, so the ReplicaSet ignores them.",
                layout: "column",
                children: [
                  {
                    id: "released",
                    label: "frontend-v9tlw",
                    sub: "app=debug, relabelled",
                    detail: "Was owned by the ReplicaSet until its label was changed to app=debug. The ReplicaSet released it and it keeps running on its own.",
                  },
                  {
                    id: "backend",
                    label: "api-7f2kd",
                    sub: "app=backend",
                    detail: "Belongs to a different workload. A different value for the same key does not match.",
                  },
                  {
                    id: "unlabelled",
                    label: "scratch",
                    sub: "no labels",
                    detail: "A Pod with no labels never matches a selector that requires one.",
                  },
                ],
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "The selector",
          text: "The ReplicaSet wants 3 Pods labelled app=frontend. It looks at every Pod in the namespace and keeps the ones whose labels match.",
          highlight: ["rs", "matched"],
        },
        {
          title: "Releasing a Pod",
          text: "frontend-v9tlw was one of three owned Pods. Its label was changed to app=debug, so it no longer matches. The ReplicaSet removes its ownerReference and the Pod keeps running unmanaged.",
          highlight: ["released"],
        },
        {
          title: "Adopting a Pod",
          text: "That leaves 2 owned Pods. cache-test matches the selector and has no owner, so the ReplicaSet adopts it instead of creating a new Pod. The count is back to 3.",
          highlight: ["owned-1", "owned-2", "bare"],
        },
        {
          title: "Ignored Pods",
          text: "api-7f2kd and scratch do not carry app=frontend. The ReplicaSet never counts, adopts, or deletes them.",
          highlight: ["backend", "unlabelled"],
        },
      ],
    },
    {
      id: "rs-scale",
      root: {
        id: "stages",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-spec",
            label: "1. Spec changed",
            sub: "DESIRED 5, CURRENT 2, READY 2",
            detail: "kubectl scale replicaset frontend --replicas=5 updates spec.replicas. No Pods have been created yet.",
            children: [
              {
                id: "spec-replicas",
                label: "spec.replicas: 5",
                sub: "was 2",
                detail: "The only field kubectl scale changes. The controller notices the ReplicaSet was updated.",
              },
              {
                id: "spec-pods",
                label: "2 Pods",
                sub: "Running",
                detail: "The existing Pods are not touched when scaling up.",
              },
            ],
          },
          {
            id: "stage-create",
            label: "2. Pods created",
            sub: "DESIRED 5, CURRENT 5, READY 2",
            detail: "The controller counts 2 of 5 and creates 3 Pods from the template. They exist, so CURRENT is 5, but they are not ready yet.",
            children: [
              {
                id: "create-old",
                label: "2 Pods",
                sub: "Running",
                detail: "The original Pods keep serving while the new ones start.",
              },
              {
                id: "create-new",
                label: "3 new Pods",
                sub: "ContainerCreating",
                detail: "Each is scheduled to a node, where the kubelet pulls the image and starts the containers.",
              },
            ],
          },
          {
            id: "stage-ready",
            label: "3. All running",
            sub: "DESIRED 5, CURRENT 5, READY 5",
            detail: "All 5 Pods have started and are ready. The controller counts 5 of 5 and does nothing.",
            children: [
              {
                id: "ready-pods",
                label: "5 Pods",
                sub: "Running",
                detail: "The 2 original Pods and the 3 new ones are indistinguishable to the ReplicaSet.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Change the spec",
          text: "kubectl scale sets spec.replicas to 5. Only the desired count changes; 2 Pods still exist.",
          highlight: ["stage-spec", "spec-replicas"],
        },
        {
          title: "Create the missing Pods",
          text: "The controller sees 2 of 5 and creates 3 Pods. They start in ContainerCreating, so READY stays at 2.",
          highlight: ["stage-create", "create-new"],
        },
        {
          title: "All Pods ready",
          text: "Once their containers start, the new Pods are Running and ready. DESIRED, CURRENT, and READY all show 5.",
          highlight: ["stage-ready"],
        },
      ],
    },
  ],
};
