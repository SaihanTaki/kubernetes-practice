import type { ChapterData } from "../types";
import { quiz } from "./deployments.quiz";

export const data: ChapterData = {
  objectives: [
    "Explain how a Deployment, its ReplicaSet, and its Pods relate.",
    "Tell desired state apart from observed state in kubectl output.",
    "Scale a Deployment and confirm the new Pods are ready.",
    "Read every field of a Deployment manifest, including the update strategy.",
  ],
  quiz,
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
  diagrams: [
    {
      id: "deploy-ownership",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "deployment",
            label: "Deployment web",
            sub: "you edit this",
            detail: "Holds the desired state: replicas, the Pod template, and the update strategy. Changing it is how you scale or roll out a new version.",
          },
          {
            id: "replicaset",
            label: "ReplicaSet web-7c5ddbdf54",
            sub: "keeps 3 Pods running",
            detail: "Created by the Deployment for one version of the Pod template. It counts matching Pods and creates or deletes Pods until the count equals its replicas.",
          },
          {
            id: "pods",
            label: "Pods",
            sub: "run the containers",
            detail: "Each Pod runs the containers from the template. If one is deleted or its node fails, the ReplicaSet creates a replacement.",
            children: [
              {
                id: "pod-1",
                label: "web-7c5ddbdf54-x8k2p",
                sub: "Running",
                detail: "Name is the ReplicaSet name plus a random suffix.",
              },
              {
                id: "pod-2",
                label: "web-7c5ddbdf54-q4mzn",
                sub: "Running",
                detail: "Identical to its siblings. Any one can be replaced without changing the others.",
              },
              {
                id: "pod-3",
                label: "web-7c5ddbdf54-v9tlw",
                sub: "Running",
                detail: "Owned by the ReplicaSet through metadata.ownerReferences, which is how replacement and cleanup work.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "You change the Deployment",
          text: "kubectl scale or kubectl apply updates the Deployment spec. You never edit the ReplicaSet or Pods directly.",
          highlight: ["deployment"],
        },
        {
          title: "The ReplicaSet keeps the count",
          text: "The Deployment passes replicas down to its current ReplicaSet, which compares it with the Pods that exist.",
          highlight: ["replicaset"],
        },
        {
          title: "Pods run the containers",
          text: "The ReplicaSet creates or deletes Pods until three are running. A lost Pod is replaced with a new name.",
          highlight: ["pod-1", "pod-2", "pod-3"],
        },
      ],
    },
    {
      id: "rolling-update",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-0",
            label: "Before: image v1",
            sub: "3 Pods, 3 ready",
            detail: "replicas: 3, maxSurge: 1, maxUnavailable: 0. So at most 4 Pods may exist and at least 3 must be ready.",
            children: [
              { id: "s0-old", label: "Old ReplicaSet (v1)", sub: "3 ready", detail: "The only ReplicaSet so far." },
              { id: "s0-new", label: "New ReplicaSet (v2)", sub: "does not exist yet", detail: "Created when you change the image." },
            ],
          },
          {
            id: "stage-1",
            label: "Surge one new Pod",
            sub: "4 Pods, 3 ready",
            detail: "maxUnavailable: 0 means no old Pod can go until a new one is ready, so the Deployment uses its one surge slot first.",
            children: [
              { id: "s1-old", label: "Old ReplicaSet (v1)", sub: "3 ready", detail: "Untouched until a new Pod is ready." },
              { id: "s1-new", label: "New ReplicaSet (v2)", sub: "1 starting", detail: "Scaled from 0 to 1. Total is now 4, the maxSurge limit." },
            ],
          },
          {
            id: "stage-2",
            label: "Swap one",
            sub: "4 Pods, 3 ready",
            detail: "The first v2 Pod became ready, so one v1 Pod was removed, freeing the surge slot for the next v2 Pod.",
            children: [
              { id: "s2-old", label: "Old ReplicaSet (v1)", sub: "2 ready", detail: "Scaled from 3 to 2." },
              { id: "s2-new", label: "New ReplicaSet (v2)", sub: "1 ready, 1 starting", detail: "Scaled from 1 to 2." },
            ],
          },
          {
            id: "stage-3",
            label: "Swap two",
            sub: "4 Pods, 3 ready",
            detail: "Same pattern again: a v2 Pod became ready, one v1 Pod went, and another v2 Pod started.",
            children: [
              { id: "s3-old", label: "Old ReplicaSet (v1)", sub: "1 ready", detail: "Scaled from 2 to 1." },
              { id: "s3-new", label: "New ReplicaSet (v2)", sub: "2 ready, 1 starting", detail: "Scaled from 2 to 3, its final count." },
            ],
          },
          {
            id: "stage-4",
            label: "Done: image v2",
            sub: "3 Pods, 3 ready",
            detail: "The last v2 Pod is ready, so the last v1 Pod was removed. The rollout is complete.",
            children: [
              {
                id: "s4-old",
                label: "Old ReplicaSet (v1)",
                sub: "0 replicas, kept for rollback",
                detail: "Kept with its v1 template. kubectl rollout undo scales it back up the same way.",
              },
              { id: "s4-new", label: "New ReplicaSet (v2)", sub: "3 ready", detail: "Now the Deployment's current ReplicaSet." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Start",
          text: "Three v1 Pods are ready. You change the image to v2, and the Deployment creates a new ReplicaSet at 0 replicas.",
          highlight: ["stage-0", "s0-old"],
        },
        {
          title: "Surge",
          text: "The new ReplicaSet scales to 1. Four Pods exist, the most maxSurge: 1 allows, and all three v1 Pods are still ready.",
          highlight: ["stage-1", "s1-new"],
        },
        {
          title: "First swap",
          text: "Once the v2 Pod is ready, the old ReplicaSet drops to 2 and the new one scales to 2. Ready Pods never fall below 3.",
          highlight: ["stage-2", "s2-old", "s2-new"],
        },
        {
          title: "Second swap",
          text: "Another v2 Pod is ready, so the old ReplicaSet drops to 1 and the new one scales to 3.",
          highlight: ["stage-3", "s3-old", "s3-new"],
        },
        {
          title: "Complete",
          text: "The third v2 Pod is ready and the old ReplicaSet scales to 0. It is not deleted, so you can roll back to it.",
          highlight: ["stage-4", "s4-old", "s4-new"],
        },
      ],
    },
  ],
};
