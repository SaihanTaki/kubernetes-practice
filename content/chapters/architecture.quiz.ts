import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
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
  {
    id: "architecture-kubelet",
    topic: "Node components",
    difficulty: "beginner",
    question: "Which component on a worker node watches for Pods assigned to that node and starts their containers?",
    options: [
      { id: "a", text: "kube-proxy" },
      { id: "b", text: "kube-scheduler" },
      { id: "c", text: "kubelet" },
      { id: "d", text: "etcd" },
    ],
    correctOptionId: "c",
    explanation:
      "The kubelet is the node agent: it sees Pods bound to its node, asks the container runtime to start them, and reports their status. kube-proxy handles Service networking, not containers.",
  },
  {
    id: "architecture-kube-proxy",
    topic: "Node components",
    difficulty: "beginner",
    question: "What is kube-proxy responsible for on each node?",
    options: [
      { id: "a", text: "Pulling container images from a registry" },
      { id: "b", text: "Programming network rules so traffic sent to a Service reaches one of its Pods" },
      { id: "c", text: "Choosing which node a new Pod runs on" },
      { id: "d", text: "Storing a local copy of all cluster state" },
    ],
    correctOptionId: "b",
    explanation:
      "kube-proxy sets up the node's network rules for Services. Image pulls are done by the container runtime, and node selection is the scheduler's job.",
  },
  {
    id: "architecture-cri",
    topic: "Node components",
    difficulty: "intermediate",
    question: "How does the kubelet tell a container runtime such as containerd or CRI-O to start containers?",
    options: [
      { id: "a", text: "By writing a request into etcd for the runtime to read" },
      { id: "b", text: "Through the Container Network Interface (CNI)" },
      { id: "c", text: "Through the API server, which forwards the request to the runtime" },
      { id: "d", text: "Through the Container Runtime Interface (CRI)" },
    ],
    correctOptionId: "d",
    explanation:
      "CRI is the interface between the kubelet and the container runtime, so any CRI-compatible runtime can be used. CNI is a different interface used to set up Pod networking.",
  },
  {
    id: "architecture-controller-manager",
    topic: "Control plane",
    difficulty: "beginner",
    question: "Which control plane component runs the built-in Deployment and ReplicaSet controllers?",
    options: [
      { id: "a", text: "kube-controller-manager" },
      { id: "b", text: "kube-scheduler" },
      { id: "c", text: "cloud-controller-manager" },
      { id: "d", text: "kubelet" },
    ],
    correctOptionId: "a",
    explanation:
      "kube-controller-manager runs the built-in controllers, including the Deployment, ReplicaSet, and Node controllers. cloud-controller-manager only runs controllers that call a cloud provider's API.",
  },
  {
    id: "architecture-cloud-controller-manager",
    topic: "Control plane",
    difficulty: "intermediate",
    question:
      "On a cloud provider, you create a Service of type LoadBalancer. Which component calls the provider's API to create the load balancer?",
    options: [
      { id: "a", text: "kube-proxy" },
      { id: "b", text: "kube-controller-manager" },
      { id: "c", text: "cloud-controller-manager" },
      { id: "d", text: "The kubelet on the node running the Pods" },
    ],
    correctOptionId: "c",
    explanation:
      "cloud-controller-manager runs the controllers that talk to the cloud provider, such as the one that creates load balancers. kube-proxy only programs rules on each node and never calls the cloud API.",
  },
  {
    id: "architecture-declarative",
    topic: "Declarative model",
    difficulty: "beginner",
    question: "What does it mean that Kubernetes is declarative?",
    options: [
      { id: "a", text: "You send step-by-step commands that run once, in order" },
      { id: "b", text: "You log in to each node and start containers yourself" },
      { id: "c", text: "You store the end state you want, and the cluster keeps working to reach it" },
      { id: "d", text: "You write a script for every change and the API server runs it" },
    ],
    correctOptionId: "c",
    explanation:
      "You describe what should exist, such as three replicas of a Pod, and controllers keep moving the cluster toward that state. Imperative step lists run once and do not repair drift later.",
  },
  {
    id: "architecture-watch",
    topic: "Coordination",
    difficulty: "intermediate",
    question: "The ReplicaSet controller creates a new Pod. How does the scheduler find out that the Pod needs a node?",
    options: [
      { id: "a", text: "The ReplicaSet controller calls the scheduler directly" },
      { id: "b", text: "The scheduler watches the API server and sees a Pod with no node assigned" },
      { id: "c", text: "etcd sends the Pod straight to the scheduler, bypassing the API server" },
      { id: "d", text: "The kubelet asks the scheduler for work" },
    ],
    correctOptionId: "b",
    explanation:
      "Components do not call each other. The controller writes the Pod to the API server, and the scheduler, which is watching for unscheduled Pods, notices it there.",
  },
  {
    id: "architecture-apply-returns",
    topic: "Deployment flow",
    difficulty: "intermediate",
    question:
      "kubectl apply prints deployment.apps/web created, but the image tag in the manifest does not exist. What does that output tell you?",
    options: [
      { id: "a", text: "The Deployment object was stored; the Pods may still fail to start" },
      { id: "b", text: "All three Pods are running" },
      { id: "c", text: "The image was pulled successfully on every node" },
      { id: "d", text: "The scheduler has already placed every Pod" },
    ],
    correctOptionId: "a",
    explanation:
      "kubectl apply returns once the API server has stored the object, before any Pod is scheduled or any image is pulled. Use kubectl get pods to see whether the Pods actually start.",
  },
  {
    id: "architecture-deployment-sequence",
    topic: "Deployment flow",
    difficulty: "advanced",
    question: "After the API server stores a new Deployment, which order of events is correct?",
    options: [
      { id: "a", text: "Scheduler places the Deployment on a node, then the kubelet creates a ReplicaSet, then Pods start" },
      { id: "b", text: "ReplicaSet controller creates Pods, then the Deployment controller creates a ReplicaSet, then the scheduler places Pods" },
      { id: "c", text: "Deployment controller creates a ReplicaSet, ReplicaSet controller creates Pods, scheduler assigns nodes, kubelets start containers" },
      { id: "d", text: "Kubelets start containers, then the scheduler records which node each Pod landed on" },
    ],
    correctOptionId: "c",
    explanation:
      "Each step is a separate component reacting to an object the previous one wrote: Deployment to ReplicaSet, ReplicaSet to Pods, Pods to node assignment, and finally the kubelet starts containers. The scheduler places Pods, never Deployments.",
  },
  {
    id: "architecture-binding",
    topic: "Scheduling",
    difficulty: "advanced",
    question: "Once the scheduler has chosen a node for a Pod, how does it record that decision?",
    options: [
      { id: "a", text: "It starts the Pod's containers on that node itself" },
      { id: "b", text: "It binds the Pod to the node through the API server, which sets the Pod's spec.nodeName" },
      { id: "c", text: "It writes the assignment directly into etcd" },
      { id: "d", text: "It sends a direct message to the kubelet on that node" },
    ],
    correctOptionId: "b",
    explanation:
      "The scheduler only writes the assignment, through the API server, as the Pod's spec.nodeName. The kubelet on that node sees the Pod through its own watch and starts it; the scheduler never touches etcd or the node directly.",
  },
  {
    id: "architecture-control-plane-down",
    topic: "Control plane",
    difficulty: "advanced",
    question: "The control plane becomes unreachable for a few minutes. What happens to Pods that are already running on worker nodes?",
    options: [
      { id: "a", text: "All their containers stop immediately" },
      { id: "b", text: "They are moved to other nodes" },
      { id: "c", text: "The kubelet deletes them because it cannot report status" },
      { id: "d", text: "They keep running, but no new scheduling or replica repair happens until it is back" },
    ],
    correctOptionId: "d",
    explanation:
      "The kubelet and container runtime keep existing containers running without the control plane. What stops is everything that goes through the API server: scheduling, controllers replacing lost Pods, and kubectl changes.",
  },
  {
    id: "architecture-controller-loop",
    topic: "Reconciliation",
    difficulty: "intermediate",
    question: "What does a Kubernetes controller do?",
    options: [
      { id: "a", text: "Runs once when an object is created, then exits" },
      { id: "b", text: "Waits for an administrator to approve each change" },
      { id: "c", text: "Repeatedly compares desired state with observed state and acts to close the gap" },
      { id: "d", text: "Reads and writes etcd directly to change objects" },
    ],
    correctOptionId: "c",
    explanation:
      "A controller is a loop: watch, compare spec with what it observes, take a step, and look again. This is reconciliation, and like every other component it works through the API server rather than etcd.",
  },
  {
    id: "architecture-namespace-names",
    topic: "Namespaces",
    difficulty: "intermediate",
    question: "Can two Deployments both be named web in the same cluster?",
    options: [
      { id: "a", text: "No, object names are unique across the whole cluster" },
      { id: "b", text: "Yes, if they are in different namespaces" },
      { id: "c", text: "Yes, if they have different labels" },
      { id: "d", text: "Yes, if their Pods run on different nodes" },
    ],
    correctOptionId: "b",
    explanation:
      "A name must be unique per kind within a namespace, so web can exist once in each namespace. Labels and node placement have no effect on name uniqueness.",
  },
  {
    id: "architecture-cluster-scoped",
    topic: "Namespaces",
    difficulty: "advanced",
    question: "Which of these objects does not belong to any namespace?",
    options: [
      { id: "a", text: "Pod" },
      { id: "b", text: "Deployment" },
      { id: "c", text: "Service" },
      { id: "d", text: "Node" },
    ],
    correctOptionId: "d",
    explanation:
      "Nodes are cluster-scoped because a machine serves the whole cluster. Pods, Deployments, and Services are namespaced objects.",
  },
  {
    id: "architecture-deployment-apiversion",
    topic: "Manifest YAML",
    difficulty: "intermediate",
    question: "Which apiVersion do you use for a Deployment?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "core/v1" },
      { id: "c", text: "apps/v1" },
      { id: "d", text: "deployments/v1" },
    ],
    correctOptionId: "c",
    explanation:
      "Deployments are in the apps API group, version v1. Plain v1 is the core group, which holds kinds such as Pod and Service but not Deployment.",
  },
  {
    id: "architecture-metadata",
    topic: "Manifest YAML",
    difficulty: "beginner",
    question: "In a manifest, where do an object's name, namespace, and labels go?",
    options: [
      { id: "a", text: "Under spec" },
      { id: "b", text: "Under status" },
      { id: "c", text: "At the top level, next to kind" },
      { id: "d", text: "Under metadata" },
    ],
    correctOptionId: "d",
    explanation:
      "metadata holds identity, and name, namespace, and labels work the same way for every kind. spec holds the desired state, whose fields depend on the kind.",
  },
  {
    id: "architecture-status-applied",
    topic: "Manifest YAML",
    difficulty: "intermediate",
    question: "You add status: { phase: Running } to a Pod manifest and apply it. What happens to that status section?",
    options: [
      { id: "a", text: "The API server ignores it; status is filled in by the components that observe the Pod" },
      { id: "b", text: "The Pod is marked Running without being scheduled" },
      { id: "c", text: "It overrides whatever the kubelet reports later" },
      { id: "d", text: "It becomes the Pod's desired state, replacing spec" },
    ],
    correctOptionId: "a",
    explanation:
      "Status is observed state, written by the kubelet and control plane, not by you. The API server drops a status section you send with the object.",
  },
  {
    id: "architecture-apiversion-mismatch",
    topic: "Manifest YAML",
    difficulty: "advanced",
    question: "A manifest has apiVersion: v1 and kind: Deployment. What happens when you apply it?",
    options: [
      { id: "a", text: "It is created as a Pod, since v1 is the Pod API" },
      { id: "b", text: "It fails, because the core v1 API has no Deployment kind" },
      { id: "c", text: "It is created, with a warning to update the apiVersion" },
      { id: "d", text: "The API server changes the apiVersion to apps/v1 and stores it" },
    ],
    correctOptionId: "b",
    explanation:
      "Each kind belongs to a specific API group and version, and Deployment is only served under apps/v1. Kubernetes does not guess or rewrite the apiVersion; kubectl api-resources shows the group for each kind.",
  },
];
