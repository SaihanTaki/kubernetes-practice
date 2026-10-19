import type { ChapterData } from "../types";

export const data: ChapterData = {
  objectives: [
    "Name the control plane and worker node components and say what each one does.",
    "Explain desired state, observed state, and how controllers reconcile the two.",
    "Trace what happens between kubectl apply and running containers when you create a Deployment.",
    "Read the common structure of any manifest: apiVersion, kind, metadata, spec, and status.",
  ],
  quiz: [
    {
      id: "architecture-etcd",
      topic: "Control plane",
      difficulty: "beginner",
      question: "Which component reads from and writes to etcd directly?",
      options: [
        { id: "a", text: "The kubelet on each node" },
        { id: "b", text: "kube-apiserver" },
        { id: "c", text: "kubectl" },
        { id: "d", text: "kube-proxy" },
      ],
      correctOptionId: "b",
      explanation:
        "Only the API server talks to etcd. Every other component, including the scheduler, controllers, kubelet, and kubectl, reads and writes cluster state through the API server.",
    },
    {
      id: "architecture-scheduler",
      topic: "Scheduling",
      difficulty: "beginner",
      question: "A new Pod exists but has no node assigned yet. Which component picks a node for it?",
      options: [
        { id: "a", text: "kube-scheduler" },
        { id: "b", text: "etcd" },
        { id: "c", text: "The container runtime" },
        { id: "d", text: "The ReplicaSet controller" },
      ],
      correctOptionId: "a",
      explanation:
        "The scheduler watches for Pods with no node, chooses one that fits, and records the choice through the API server. The ReplicaSet controller creates Pods but does not place them, and the runtime only runs containers once the kubelet asks.",
    },
    {
      id: "architecture-reconcile",
      topic: "Reconciliation",
      difficulty: "intermediate",
      question: "A worker node fails and takes one Pod of a 3-replica Deployment with it. What restores the third Pod?",
      options: [
        { id: "a", text: "You must run kubectl apply again" },
        { id: "b", text: "The kubelet on the failed node restarts it after a reboot" },
        { id: "c", text: "etcd restores the Pod from its last snapshot" },
        { id: "d", text: "Controllers see fewer Pods than desired and create a new one, which the scheduler places on a healthy node" },
      ],
      correctOptionId: "d",
      explanation:
        "Desired state in etcd still says 3. Once the Pods on the lost node are removed, the ReplicaSet controller counts 2 and creates a replacement, and the scheduler places it on a healthy node. Nobody has to re-apply anything.",
    },
    {
      id: "architecture-spec-status",
      topic: "Manifest YAML",
      difficulty: "beginner",
      question: "In a Kubernetes object, what is the difference between spec and status?",
      options: [
        { id: "a", text: "spec is what you want; status is what Kubernetes currently observes" },
        { id: "b", text: "spec is optional; status is required in every manifest you apply" },
        { id: "c", text: "spec holds labels; status holds the name and namespace" },
        { id: "d", text: "They are two names for the same field" },
      ],
      correctOptionId: "a",
      explanation:
        "You write spec to describe the desired state. Kubernetes components fill in status with what they observe, and controllers work to make status match spec. You do not write status yourself; name, namespace, and labels live in metadata.",
    },
  ],
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
      groups: [
        { id: "control-plane", label: "Control plane", x: 220, y: 0, width: 420, height: 340 },
        { id: "worker-1", label: "Worker node 1", x: 720, y: 0, width: 420, height: 210 },
        { id: "worker-2", label: "Worker node 2", x: 720, y: 260, width: 420, height: 210 },
      ],
      nodes: [
        { id: "kubectl", label: "kubectl", x: 0, y: 150, detail: "The command-line client. It turns your commands and manifests into HTTPS requests to the API server." },
        { id: "apiserver", label: "kube-apiserver", x: 240, y: 40, detail: "The front door of the cluster. It authenticates and validates every request and is the only component that talks to etcd." },
        { id: "etcd", label: "etcd", x: 440, y: 40, detail: "A consistent key-value store that holds all cluster state: every object's spec and status." },
        { id: "scheduler", label: "kube-scheduler", x: 240, y: 150, detail: "Watches for Pods with no node assigned and picks a node for each based on resource requests and constraints." },
        { id: "controller-manager", label: "kube-controller-manager", x: 440, y: 150, detail: "Runs the built-in controllers, such as the Deployment and ReplicaSet controllers. Each one compares desired and observed state and acts to close the gap." },
        { id: "cloud-controller-manager", label: "cloud-controller-manager", x: 340, y: 260, detail: "Optional. Runs controllers that talk to a cloud provider, for example to create load balancers or notice deleted VMs." },
        { id: "kubelet-1", label: "kubelet", x: 740, y: 40, detail: "The node agent. It watches for Pods assigned to its node, asks the runtime to start their containers, and reports Pod status." },
        { id: "runtime-1", label: "container runtime", x: 950, y: 40, detail: "Pulls images and runs containers, for example containerd or CRI-O. The kubelet talks to it through the Container Runtime Interface." },
        { id: "proxy-1", label: "kube-proxy", x: 740, y: 150, detail: "Watches Services and programs the node's network rules so traffic to a Service reaches one of its Pods." },
        { id: "kubelet-2", label: "kubelet", x: 740, y: 300, detail: "The same agent on the second node. Each kubelet only starts Pods bound to its own node." },
        { id: "runtime-2", label: "container runtime", x: 950, y: 300, detail: "Runs this node's containers when its kubelet asks." },
        { id: "proxy-2", label: "kube-proxy", x: 740, y: 410, detail: "Keeps this node's Service routing rules up to date." },
      ],
      edges: [
        { from: "kubectl", to: "apiserver", label: "HTTPS" },
        { from: "apiserver", to: "etcd", label: "read/write" },
        { from: "scheduler", to: "apiserver", label: "watch" },
        { from: "controller-manager", to: "apiserver", label: "watch" },
        { from: "cloud-controller-manager", to: "apiserver" },
        { from: "kubelet-1", to: "apiserver" },
        { from: "proxy-1", to: "apiserver" },
        { from: "kubelet-2", to: "apiserver" },
        { from: "proxy-2", to: "apiserver" },
        { from: "kubelet-1", to: "runtime-1", label: "CRI" },
        { from: "kubelet-2", to: "runtime-2", label: "CRI" },
      ],
      steps: [
        {
          title: "kubectl sends the Deployment",
          text: "You run kubectl apply -f web.yaml. kubectl sends the Deployment to the API server as an HTTPS request.",
          nodes: ["kubectl", "apiserver"],
        },
        {
          title: "The API server stores it",
          text: "The API server authenticates you, validates the manifest against the Deployment schema, and saves it in etcd. kubectl returns as soon as it is stored. Nothing is running yet.",
          nodes: ["apiserver", "etcd"],
        },
        {
          title: "The Deployment controller creates a ReplicaSet",
          text: "The Deployment controller in kube-controller-manager is watching Deployments. It sees the new one with no ReplicaSet and creates one through the API server.",
          nodes: ["controller-manager", "apiserver", "etcd"],
        },
        {
          title: "The ReplicaSet controller creates Pods",
          text: "The ReplicaSet controller sees a ReplicaSet that wants 3 Pods and has 0, so it creates 3 Pod objects. They exist in etcd but have no node yet, so their status is Pending.",
          nodes: ["controller-manager", "apiserver", "etcd"],
        },
        {
          title: "The scheduler assigns nodes",
          text: "kube-scheduler watches for Pods without a node. For each one it picks a node with enough free resources and writes the binding through the API server.",
          nodes: ["scheduler", "apiserver"],
        },
        {
          title: "kubelets pick up their Pods",
          text: "Each kubelet watches for Pods bound to its own node. When one appears, it reads the Pod spec from the API server.",
          nodes: ["apiserver", "kubelet-1", "kubelet-2"],
        },
        {
          title: "The runtime starts containers",
          text: "The kubelet asks the container runtime to pull the image and start the containers.",
          nodes: ["kubelet-1", "runtime-1", "kubelet-2", "runtime-2"],
        },
        {
          title: "Status flows back",
          text: "The kubelet reports Pod status to the API server, which stores it in etcd. Controllers update ReplicaSet and Deployment status, and kubectl get deployments shows 3/3 ready.",
          nodes: ["kubelet-1", "kubelet-2", "apiserver", "etcd", "kubectl"],
        },
      ],
    },
  ],
};
