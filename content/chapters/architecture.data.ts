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
    {
      id: "reconcile-loop",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "loop",
            label: "The control loop",
            sub: "every controller runs this, forever",
            detail: "A controller never runs once and stops. It keeps watching, so it also repairs drift that nobody asked it to fix.",
            flow: true,
            children: [
              {
                id: "watch",
                label: "Watch",
                sub: "through the API server",
                detail: "The controller subscribes to changes for the kinds it owns, such as ReplicaSets and their Pods. The API server pushes every create, update, and delete.",
              },
              {
                id: "compare",
                label: "Compare",
                sub: "spec vs what exists",
                detail: "It compares desired state in spec with observed state: the object's status and the related objects that actually exist.",
              },
              {
                id: "act",
                label: "Act",
                sub: "write through the API server",
                detail: "If there is a gap, it takes a step to close it, such as creating or deleting a Pod. It never touches containers or etcd directly.",
              },
              {
                id: "repeat",
                label: "Repeat",
                sub: "back to watch",
                detail: "Its own change triggers new events, so the loop runs again until desired and observed match.",
              },
            ],
          },
          {
            id: "example",
            label: "Example: a node fails",
            sub: "ReplicaSet with spec.replicas: 3",
            detail: "The same loop, followed through one failure. No person runs a command at any point.",
            layout: "column",
            flow: true,
            children: [
              {
                id: "ex-healthy",
                label: "3 of 3 Pods running",
                sub: "desired 3, observed 3",
                detail: "Desired and observed match, so the ReplicaSet controller has nothing to do.",
              },
              {
                id: "ex-node-dies",
                label: "Node 2 stops responding",
                sub: "its Pod is evicted",
                detail: "The Node controller marks the node unreachable. After a timeout (5 minutes by default) the Pods on it are evicted and no longer count.",
              },
              {
                id: "ex-notice",
                label: "ReplicaSet controller compares",
                sub: "desired 3, observed 2",
                detail: "The Pod change reaches the controller through its watch. It counts 2 active Pods matching its selector against spec.replicas: 3.",
              },
              {
                id: "ex-create",
                label: "It creates 1 Pod",
                sub: "via the API server",
                detail: "The controller writes one new Pod object from the ReplicaSet's template. The Pod has no node yet.",
              },
              {
                id: "ex-recovered",
                label: "3 of 3 again",
                sub: "scheduler and kubelet do the rest",
                detail: "The scheduler places the new Pod on a healthy node and that node's kubelet starts it. The next comparison finds no gap.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Steady state",
          text: "The ReplicaSet controller is watching. Desired is 3 and observed is 3, so there is nothing to do.",
          highlight: ["watch", "ex-healthy"],
        },
        {
          title: "Something changes",
          text: "Node 2 stops responding. After a timeout its Pod is evicted, and that change reaches the controller through its watch.",
          highlight: ["watch", "ex-node-dies"],
        },
        {
          title: "Compare",
          text: "The controller counts 2 active Pods against spec.replicas: 3. There is a gap of one.",
          highlight: ["compare", "ex-notice"],
        },
        {
          title: "Act",
          text: "It creates one Pod from the template through the API server. That is its whole job; placing and starting the Pod belongs to other components.",
          highlight: ["act", "ex-create"],
        },
        {
          title: "Repeat",
          text: "The scheduler and kubelet run the new Pod. The loop runs again, finds 3 of 3, and goes back to watching.",
          highlight: ["repeat", "watch", "ex-recovered"],
        },
      ],
    },
    {
      id: "api-hub",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "clients",
            label: "Clients of the API server",
            sub: "none of them call each other",
            detail: "Every component is a client of the API server. They coordinate by writing objects and watching for changes, never by calling each other.",
            children: [
              {
                id: "kubectl",
                label: "kubectl",
                sub: "you",
                detail: "Writes the objects you apply and reads them back for kubectl get.",
              },
              {
                id: "controller-manager",
                label: "kube-controller-manager",
                sub: "watches, creates objects",
                detail: "Its controllers watch objects such as Deployments and ReplicaSets and create, update, or delete other objects in response.",
              },
              {
                id: "scheduler",
                label: "kube-scheduler",
                sub: "watches Pods, writes bindings",
                detail: "Watches for Pods with no node and writes a binding that assigns each one to a node.",
              },
              {
                id: "kubelet",
                label: "kubelet",
                sub: "on every node",
                detail: "Watches for Pods bound to its node and writes their status back. The node does not accept instructions from anything else.",
              },
              {
                id: "kube-proxy",
                label: "kube-proxy",
                sub: "on every node",
                detail: "Watches Services and their endpoints and updates the node's network rules.",
              },
            ],
          },
          {
            id: "apiserver",
            label: "kube-apiserver",
            sub: "authenticates, validates, stores, notifies watchers",
            detail: "Every read, write, and watch goes through it. After it stores a change it notifies every client watching that kind of object.",
          },
          {
            id: "etcd",
            label: "etcd",
            sub: "only the API server talks to it",
            detail: "Holds all cluster state. Because only the API server reads and writes it, every change passes authentication and validation first.",
          },
        ],
      },
      steps: [
        {
          title: "A write",
          text: "The ReplicaSet controller creates a Pod. It sends the Pod to the API server, which validates it and stores it in etcd.",
          highlight: ["controller-manager", "apiserver", "etcd"],
        },
        {
          title: "A watch fires",
          text: "The scheduler is watching for Pods with no node. The API server tells it about the new Pod, and it writes a binding back through the API server.",
          highlight: ["scheduler", "apiserver", "etcd"],
        },
        {
          title: "Another watch fires",
          text: "The kubelet on the chosen node sees a Pod bound to it, starts the containers, and writes the Pod's status. The controller manager and scheduler never spoke to each other or to the node.",
          highlight: ["kubelet", "apiserver", "etcd"],
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
