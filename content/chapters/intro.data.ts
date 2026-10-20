import type { ChapterData } from "../types";
import { quiz } from "./intro.quiz";

const helloPod = `apiVersion: v1
kind: Pod
metadata:
  name: hello
  labels:
    app: hello
spec:
  containers:
    - name: web
      image: nginx:1.27
`;

export const data: ChapterData = {
  objectives: [
    "Explain what Kubernetes does and what declarative desired state means.",
    "Name the common Kubernetes objects, their apiVersion, and whether they are namespaced.",
    "Describe how Deployments, ReplicaSets, Pods, Services, ConfigMaps, and Secrets relate.",
    "Read the parts of any manifest: apiVersion, kind, metadata, spec, and status.",
    "Tell the imperative and declarative ways of working apart.",
  ],
  quiz,
  manifests: [
    {
      id: "pod-basic",
      title: "hello-pod.yaml",
      yaml: `apiVersion: v1
kind: Pod
metadata:
  name: hello
  namespace: default
  labels:
    app: hello
spec:
  containers:
    - name: web
      image: nginx:1.27`,
      notes: [
        { line: 1, text: "Which API group and version defines this kind. Pod is in the core group, so it is plain v1." },
        { line: 2, text: "The type of object. The API server uses apiVersion and kind together to pick the schema." },
        { line: 3, text: "metadata identifies the object. Every kind has the same metadata fields." },
        { line: 4, text: "Must be unique among objects of this kind in the namespace. Lowercase letters, digits, and dashes." },
        { line: 5, text: "Optional. Leave it out and kubectl uses your current namespace, usually default." },
        { line: 6, text: "Key-value pairs you choose. Services, ReplicaSets, and Deployments find Pods by these labels." },
        { line: 8, text: "spec is the desired state: what you want. Kubernetes adds a status section with the observed state; you never write it." },
        { line: 9, text: "The contents of spec depend on the kind. For a Pod it lists the containers to run." },
        { line: 11, text: "The container image to pull and start. Pin a tag rather than relying on latest." },
      ],
    },
    {
      id: "intro-deployment",
      title: "web-deployment.yaml",
      yaml: `apiVersion: apps/v1
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
        - name: web
          image: nginx:1.27`,
      notes: [
        { line: 1, text: "Deployment is in the apps group, so apiVersion is group/version: apps/v1." },
        { line: 2, text: "Same top-level shape as the Pod: apiVersion, kind, metadata, spec." },
        { line: 4, text: "The Deployment's name. Its ReplicaSet and Pods get names derived from it." },
        { line: 6, text: "Desired state: three Pods. The Deployment's status reports how many are actually ready." },
        { line: 7, text: "Which Pods this Deployment manages, chosen by label." },
        { line: 10, text: "A Pod template: the metadata and spec of the Pods to create, nested inside the Deployment." },
        { line: 13, text: "Every Pod gets this label, which matches the selector above." },
      ],
    },
  ],
  labs: [
    {
      id: "intro-first-manifest",
      title: "Fix and apply your first manifest",
      difficulty: "beginner",
      scenario: "pod.yaml describes a single nginx Pod called hello, but the apply fails. Find out why, fix the file, and get the Pod running.",
      instructions: [
        "Run cat pod.yaml to read the file.",
        "Run kubectl apply -f pod.yaml and read the error.",
        "Fix the mistake in pod.yaml in the file editor, then apply again.",
        "Run kubectl get pods until hello shows Running.",
      ],
      fixture: { files: { "pod.yaml": helloPod.replace("apiVersion: v1", "apiVersion: apps/v1") } },
      objectives: [
        {
          id: "created",
          description: "A Pod named hello exists.",
          validator: { kind: "resource-exists", resourceType: "Pod", resourceName: "hello" },
        },
      ],
      hints: [
        'The error is: pod.yaml: apiVersion: Invalid literal value, expected "v1". It names the field and the value it expects.',
        "Pod is in the core API group, which has no group name, so its apiVersion is just v1. apps/v1 is for Deployments and ReplicaSets.",
        "Change the first line to apiVersion: v1, leave kind: Pod as it is, and run kubectl apply -f pod.yaml again.",
        "The Pod starts as ContainerCreating. Run kubectl get pods again to see it Running.",
      ],
      solutionFiles: { "pod.yaml": helloPod },
      solution: ["kubectl apply -f pod.yaml", "kubectl get pods"],
    },
  ],
  diagrams: [
    {
      id: "object-map",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "ownership",
            label: "Owns",
            sub: "each layer creates the next",
            detail: "Controllers create these objects for you. You write the Deployment; the ReplicaSet and Pods follow from it.",
            layout: "column",
            flow: true,
            children: [
              {
                id: "deployment",
                label: "Deployment web",
                sub: "apps/v1",
                detail: "Holds the desired replica count and Pod template. It creates a ReplicaSet for each version of the template.",
              },
              {
                id: "replicaset",
                label: "ReplicaSet web-7c5ddbdf54",
                sub: "apps/v1",
                detail: "Keeps the right number of Pods running. If a Pod disappears, it creates a replacement.",
              },
              {
                id: "pods",
                label: "Pods app: web",
                sub: "v1, run the containers",
                detail: "Each Pod runs the containers from the template and carries the label app: web.",
                children: [
                  { id: "pod-1", label: "web-7c5ddbdf54-x8k2p", sub: "Running", detail: "Created by the ReplicaSet. Its name is the ReplicaSet name plus a random suffix." },
                  { id: "pod-2", label: "web-7c5ddbdf54-q4mzn", sub: "Running", detail: "An identical copy. Any Pod can be replaced without affecting the others." },
                ],
              },
            ],
          },
          {
            id: "uses",
            label: "Points at the Pods",
            sub: "no ownership",
            detail: "These objects are created separately and connect to Pods by label or by name. Deleting one does not delete the Pods.",
            layout: "column",
            children: [
              {
                id: "service",
                label: "Service web",
                sub: "selector app: web",
                detail: "Sends traffic to every ready Pod with the label app: web. Pods come and go; the Service name and IP stay the same.",
              },
              {
                id: "configmap",
                label: "ConfigMap web-config",
                sub: "settings",
                detail: "Plain configuration. The Pod template refers to it by name and reads it as environment variables or files.",
              },
              {
                id: "secret",
                label: "Secret web-db",
                sub: "passwords, tokens",
                detail: "Sensitive values, referenced from the Pod template by name like a ConfigMap. Kept separate so access can be restricted.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Ownership",
          text: "You create the Deployment. It creates a ReplicaSet, and the ReplicaSet creates the Pods. Delete the Deployment and the rest goes with it.",
          highlight: ["deployment", "replicaset", "pods"],
        },
        {
          title: "Selection by label",
          text: "The Service finds Pods by their label app: web, not by name. New Pods with that label receive traffic as soon as they are ready.",
          highlight: ["service", "pod-1", "pod-2"],
        },
        {
          title: "Configuration by reference",
          text: "The Pod template names a ConfigMap and a Secret. Each Pod reads them when its containers start.",
          highlight: ["configmap", "secret", "pod-1", "pod-2"],
        },
      ],
    },
    {
      id: "manifest-anatomy",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "you",
            label: "You write",
            sub: "in the YAML file you apply",
            detail: "These four top-level fields make up every manifest you write, for any kind.",
            layout: "column",
            children: [
              {
                id: "api-version",
                label: "apiVersion",
                sub: "v1, apps/v1",
                detail: "The API group and version that defines the kind. Pods are in v1, Deployments and ReplicaSets in apps/v1.",
              },
              {
                id: "kind",
                label: "kind",
                sub: "Pod, Deployment",
                detail: "The type of object. Together with apiVersion it tells the API server which schema to validate against.",
              },
              {
                id: "metadata",
                label: "metadata",
                sub: "name, namespace, labels",
                detail: "Identity. The name must be unique per kind within a namespace, and labels are how other objects select this one.",
              },
              {
                id: "spec",
                label: "spec",
                sub: "desired state",
                detail: "What you want. Its fields depend on the kind, and controllers read it to decide what to do.",
              },
            ],
          },
          {
            id: "cluster",
            label: "The cluster writes",
            sub: "visible with kubectl get -o yaml",
            detail: "Added by the API server and the components that observe the object. You do not put these in your file.",
            layout: "column",
            children: [
              {
                id: "server-metadata",
                label: "metadata (server-set)",
                sub: "uid, resourceVersion, creationTimestamp",
                detail: "The API server adds these fields when it stores the object. resourceVersion changes on every update.",
              },
              {
                id: "status",
                label: "status",
                sub: "observed state",
                detail: "What the cluster currently sees, written by the kubelet and controllers. If you include status in a manifest, the API server ignores it.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Which schema",
          text: "apiVersion and kind tell the API server what the object is and which schema to validate it against.",
          highlight: ["api-version", "kind"],
        },
        {
          title: "Identity and desired state",
          text: "metadata names the object and spec says what you want. These are the parts you edit day to day.",
          highlight: ["metadata", "spec"],
        },
        {
          title: "What the cluster adds",
          text: "Once stored, the object gains server-set metadata and a status section. Controllers keep comparing status with spec.",
          highlight: ["server-metadata", "status", "spec"],
        },
      ],
    },
  ],
};
