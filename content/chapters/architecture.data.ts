import type { ChapterData } from "../types";
import { quiz } from "./architecture.quiz";

export const data: ChapterData = {
  objectives: [
    "Name the control plane and worker node components and say what each one does.",
    "Explain desired state, observed state, and how controllers reconcile the two.",
    "Trace what happens between kubectl apply and running containers when you create a Deployment.",
    "Read the common structure of any manifest: apiVersion, kind, metadata, spec, and status.",
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
        { line: 1, text: "Which API group and version defines this kind. Core objects like Pod use plain v1; Deployments use apps/v1." },
        { line: 2, text: "The type of object. The API server uses apiVersion and kind together to pick the schema." },
        { line: 3, text: "metadata identifies the object. Every kind has the same metadata fields." },
        { line: 4, text: "Must be unique among objects of this kind in the namespace. Lowercase letters, digits, and dashes." },
        { line: 5, text: "Optional. Leave it out and kubectl uses your current namespace, usually default." },
        { line: 6, text: "Key-value pairs you choose. Selectors in ReplicaSets and Deployments find Pods by these labels." },
        { line: 8, text: "spec is the desired state: what you want. Kubernetes adds a status section with the observed state; you never write it." },
        { line: 9, text: "The contents of spec depend on the kind. For a Pod it lists the containers to run." },
        { line: 11, text: "The kubelet asks the container runtime to pull and start this image." },
      ],
    },
  ],
  labs: [],
  diagrams: [
    {
      id: "architecture",
      root: {
        id: "cluster",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "kubectl",
            label: "kubectl",
            sub: "on your machine",
            detail: "The command-line client. It turns your commands and manifests into HTTPS requests to the API server.",
          },
          {
            id: "control-plane",
            label: "Control plane",
            sub: "stores desired state and decides what should happen",
            detail: "The machines that run the cluster's brain. You only ever talk to its API server.",
            children: [
              {
                id: "apiserver",
                label: "kube-apiserver",
                sub: "the only entry point",
                detail: "The front door of the cluster. It authenticates and validates every request and is the only component that talks to etcd.",
              },
              {
                id: "etcd",
                label: "etcd",
                sub: "cluster state",
                detail: "A consistent key-value store that holds all cluster state: every object's spec and status.",
              },
              {
                id: "scheduler",
                label: "kube-scheduler",
                sub: "picks a node per Pod",
                detail: "Watches for Pods with no node assigned and picks a node for each based on resource requests and constraints.",
              },
              {
                id: "controller-manager",
                label: "kube-controller-manager",
                sub: "runs the controllers",
                detail: "Runs the built-in controllers, such as the Deployment and ReplicaSet controllers. Each one compares desired and observed state and acts to close the gap.",
              },
              {
                id: "cloud-controller-manager",
                label: "cloud-controller-manager",
                sub: "optional",
                detail: "Optional. Runs controllers that talk to a cloud provider, for example to create load balancers or notice deleted VMs.",
              },
            ],
          },
          {
            id: "workers",
            label: "Worker nodes",
            sub: "run your containers, each node talks only to the API server",
            children: [1, 2].map((n) => ({
              id: `worker-${n}`,
              label: `Worker node ${n}`,
              layout: "column" as const,
              children: [
                {
                  id: `kubelet-${n}`,
                  label: "kubelet",
                  sub: "node agent",
                  detail: "The node agent. It watches for Pods assigned to its node, asks the runtime to start their containers, and reports Pod status.",
                },
                {
                  id: `runtime-${n}`,
                  label: "container runtime",
                  sub: "containerd, CRI-O",
                  detail: "Pulls images and runs containers. The kubelet talks to it through the Container Runtime Interface (CRI).",
                },
                {
                  id: `proxy-${n}`,
                  label: "kube-proxy",
                  sub: "Service routing",
                  detail: "Watches Services and programs the node's network rules so traffic to a Service reaches one of its Pods.",
                },
              ],
            })),
          },
        ],
      },
      steps: [
        {
          title: "kubectl sends the Deployment",
          text: "You run kubectl apply -f web.yaml. kubectl sends the Deployment to the API server as an HTTPS request.",
          highlight: ["kubectl", "apiserver"],
        },
        {
          title: "The API server stores it",
          text: "The API server authenticates you, validates the manifest against the Deployment schema, and saves it in etcd. kubectl returns as soon as it is stored. Nothing is running yet.",
          highlight: ["apiserver", "etcd"],
        },
        {
          title: "The Deployment controller creates a ReplicaSet",
          text: "The Deployment controller in kube-controller-manager is watching Deployments. It sees the new one with no ReplicaSet and creates one through the API server.",
          highlight: ["controller-manager", "apiserver", "etcd"],
        },
        {
          title: "The ReplicaSet controller creates Pods",
          text: "The ReplicaSet controller sees a ReplicaSet that wants 3 Pods and has 0, so it creates 3 Pod objects. They exist in etcd but have no node yet, so their status is Pending.",
          highlight: ["controller-manager", "apiserver", "etcd"],
        },
        {
          title: "The scheduler assigns nodes",
          text: "kube-scheduler watches for Pods without a node. For each one it picks a node with enough free resources and writes the binding through the API server.",
          highlight: ["scheduler", "apiserver"],
        },
        {
          title: "kubelets pick up their Pods",
          text: "Each kubelet watches for Pods bound to its own node. When one appears, it reads the Pod spec from the API server.",
          highlight: ["apiserver", "kubelet-1", "kubelet-2"],
        },
        {
          title: "The runtime starts containers",
          text: "The kubelet asks the container runtime to pull the image and start the containers.",
          highlight: ["kubelet-1", "runtime-1", "kubelet-2", "runtime-2"],
        },
        {
          title: "Status flows back",
          text: "The kubelet reports Pod status to the API server, which stores it in etcd. Controllers update ReplicaSet and Deployment status, and kubectl get deployments shows 3/3 ready.",
          highlight: ["kubelet-1", "kubelet-2", "apiserver", "etcd", "kubectl"],
        },
      ],
    },
  ],
};
