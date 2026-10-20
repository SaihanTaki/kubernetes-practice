import type { ChapterData } from "../types";
import { quiz } from "./namespaces.quiz";

export const data: ChapterData = {
  objectives: [
    "Explain what a namespace scopes and what it does not isolate on its own.",
    "Tell namespaced resources apart from cluster-scoped ones such as Nodes and Namespaces.",
    "Work in a chosen namespace with -n and list across all of them with -A.",
    "Predict what deleting a namespace removes.",
    "Write a Namespace manifest and place another resource in it with metadata.namespace.",
  ],
  quiz,
  manifests: [
    {
      id: "namespace",
      title: "dev-namespace.yaml",
      yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: dev`,
      notes: [
        { line: 1, text: "Namespaces are in the core API group, version v1, like Pods." },
        { line: 2, text: "A Namespace is cluster-scoped, so this manifest has no metadata.namespace of its own." },
        { line: 4, text: "Must be unique across the whole cluster and a valid DNS label: lowercase letters, digits, and dashes." },
      ],
    },
    {
      id: "namespaced-deployment",
      title: "web-dev.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: dev
  labels:
    app: web
spec:
  replicas: 2
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
      notes: [
        { line: 4, text: "Only has to be unique among Deployments in dev. A Deployment called web in default is a different object." },
        { line: 5, text: "Puts the Deployment in dev regardless of your current context. Without this line it goes to the namespace from -n or your context." },
        { line: 9, text: "Its ReplicaSet and Pods are created in the same namespace as the Deployment." },
        { line: 12, text: "Selectors only match Pods in the Deployment's own namespace, so web in default is never counted here." },
      ],
    },
  ],
  labs: [
    {
      id: "namespaces-staging",
      title: "Set up dev and retire staging",
      difficulty: "beginner",
      scenario:
        "The web app runs in default. An old copy sits in a staging namespace nobody uses. Your team wants a separate dev namespace with its own web Deployment.",
      instructions: [
        "List Deployments in every namespace to see what exists.",
        "Create a namespace called dev.",
        "Create a Deployment called web in dev with image nginx:1.27 and 2 replicas.",
        "Delete the staging namespace and everything in it.",
        "Check that the web Deployment in default still has 3 replicas.",
      ],
      fixture: {
        namespaces: ["staging"],
        deployments: [
          { name: "web", replicas: 3, image: "nginx:1.27", labels: { app: "web" } },
          { name: "web", namespace: "staging", replicas: 1, image: "nginx:1.25", labels: { app: "web" } },
        ],
      },
      objectives: [
        {
          id: "dev-web",
          description: "A Deployment called web in dev asks for 2 replicas.",
          validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 2, namespace: "dev" },
        },
        {
          id: "dev-ready",
          description: "2 Pods owned by web in dev are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 2, namespace: "dev" },
        },
        {
          id: "staging-gone",
          description: "The web Deployment in staging is gone.",
          validator: { kind: "resource-absent", resourceType: "Deployment", resourceName: "web", namespace: "staging" },
        },
        {
          id: "default-untouched",
          description: "The web Deployment in default still asks for 3 replicas.",
          validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 3 },
        },
      ],
      hints: [
        "kubectl get deployments -A shows every namespace at once.",
        "kubectl create namespace dev, then add -n dev to kubectl create deployment.",
        "Without -n, kubectl works in default. Creating web there fails because one already exists.",
        "kubectl delete namespace staging removes the namespace and the Deployment inside it.",
        "Run kubectl get pods -n dev again until both Pods are ready.",
      ],
      solution: [
        "kubectl get deployments -A",
        "kubectl create namespace dev",
        "kubectl create deployment web --image=nginx:1.27 --replicas=2 -n dev",
        "kubectl delete namespace staging",
        "kubectl get pods -n dev",
        "kubectl get deployments -A",
      ],
    },
  ],
  diagrams: [
    {
      id: "ns-scope",
      root: {
        id: "cluster",
        label: "Cluster",
        sub: "one API server, one set of nodes",
        layout: "column",
        children: [
          {
            id: "namespaces",
            label: "",
            children: [
              {
                id: "ns-default",
                label: "Namespace default",
                sub: "namespaced resources",
                detail: "Where resources go when you give no namespace. Names here only clash with other names in default.",
                layout: "column",
                children: [
                  { id: "default-web", label: "Deployment web", sub: "3 replicas", detail: "Full identity is namespace plus kind plus name: default, Deployment, web." },
                  { id: "default-pods", label: "Pods web-…", sub: "in default", detail: "A Deployment's ReplicaSets and Pods are always in the Deployment's namespace." },
                ],
              },
              {
                id: "ns-dev",
                label: "Namespace dev",
                sub: "namespaced resources",
                detail: "A separate scope for names. It shares nodes, network, and the API server with default.",
                layout: "column",
                children: [
                  { id: "dev-web", label: "Deployment web", sub: "2 replicas", detail: "Same kind and name as the one in default, but a different object. Scaling one does not affect the other." },
                  { id: "dev-pods", label: "Pods web-…", sub: "in dev", detail: "These can still reach Pods in default over the network unless a NetworkPolicy blocks it." },
                ],
              },
            ],
          },
          {
            id: "cluster-scoped",
            label: "Cluster-scoped",
            sub: "not in any namespace",
            detail: "Resources with one cluster-wide list. Their names must be unique across the whole cluster.",
            children: [
              { id: "nodes", label: "Nodes", sub: "node-1, node-2", detail: "Pods from any namespace can run on any node. A namespace does not reserve machines." },
              { id: "ns-objects", label: "Namespaces", sub: "default, dev, …", detail: "Namespaces are themselves cluster-scoped objects. A namespace cannot contain another namespace." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Two namespaces",
          text: "default and dev are separate name scopes inside one cluster.",
          highlight: ["ns-default", "ns-dev"],
        },
        {
          title: "Same name, different objects",
          text: "Each namespace has its own Deployment called web. kubectl needs -n to know which one you mean.",
          highlight: ["default-web", "dev-web"],
        },
        {
          title: "Outside every namespace",
          text: "Nodes and Namespaces are cluster-scoped. Workloads from both namespaces share the same nodes.",
          highlight: ["cluster-scoped", "nodes", "ns-objects"],
        },
      ],
    },
    {
      id: "ns-delete",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-before",
            label: "Before",
            sub: "staging holds an app",
            detail: "The staging namespace contains a Deployment, its ReplicaSet, and its Pods. default has its own app.",
            children: [
              { id: "b-staging", label: "staging", sub: "Deployment, ReplicaSet, 2 Pods", detail: "Everything here has metadata.namespace: staging." },
              { id: "b-default", label: "default", sub: "Deployment web, Pods", detail: "Unrelated to staging apart from sharing the cluster." },
            ],
          },
          {
            id: "stage-terminating",
            label: "kubectl delete namespace staging",
            sub: "Terminating",
            detail: "The namespace is marked Terminating. No new resources can be created in it while Kubernetes deletes its contents.",
            children: [
              { id: "t-staging", label: "staging", sub: "Terminating, contents being deleted", detail: "Deployments, ReplicaSets, Pods, and every other namespaced object in staging are removed." },
              { id: "t-default", label: "default", sub: "unchanged", detail: "Deleting one namespace never touches resources in another." },
            ],
          },
          {
            id: "stage-after",
            label: "After",
            sub: "staging is gone",
            detail: "The namespace and its contents no longer exist. Recreating the namespace gives you an empty one.",
            children: [
              { id: "a-staging", label: "staging", sub: "NotFound", detail: "kubectl get pods -n staging now fails with namespaces \"staging\" not found." },
              { id: "a-default", label: "default", sub: "Deployment web, Pods", detail: "Still running exactly as before." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Before",
          text: "staging holds a Deployment with its ReplicaSet and Pods.",
          highlight: ["stage-before", "b-staging"],
        },
        {
          title: "Delete the namespace",
          text: "The namespace goes into Terminating and Kubernetes deletes every resource inside it. There is no prompt.",
          highlight: ["stage-terminating", "t-staging"],
        },
        {
          title: "Other namespaces are untouched",
          text: "Resources in default are not affected by deleting staging.",
          highlight: ["t-default", "a-default"],
        },
        {
          title: "Gone",
          text: "The namespace and everything in it are gone. There is no undo.",
          highlight: ["stage-after", "a-staging"],
        },
      ],
    },
  ],
};
