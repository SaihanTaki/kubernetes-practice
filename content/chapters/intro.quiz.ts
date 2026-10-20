import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "intro-what-problem",
    topic: "Kubernetes",
    difficulty: "beginner",
    question: "Which problem is Kubernetes built to solve?",
    options: [
      { id: "a", text: "Running containers across many machines and keeping them running, scaled, and up to date" },
      { id: "b", text: "Building container images from source code" },
      { id: "c", text: "Replacing the container runtime on a single laptop" },
      { id: "d", text: "Storing application source code and its version history" },
    ],
    correctOptionId: "a",
    explanation:
      "Kubernetes places containers on nodes, restarts or replaces them when they fail, scales them, and rolls out new versions. Building images and storing code are done by other tools.",
  },
  {
    id: "intro-desired-state",
    topic: "Kubernetes",
    difficulty: "beginner",
    question: "What does it mean that Kubernetes works from a declarative desired state?",
    options: [
      { id: "a", text: "You list the exact steps, and Kubernetes runs them once in order" },
      { id: "b", text: "You describe what should exist, and controllers keep working to make the cluster match it" },
      { id: "c", text: "Kubernetes decides on its own which apps you should run" },
      { id: "d", text: "Every change must be declared in a ticket before it is applied" },
    ],
    correctOptionId: "b",
    explanation:
      "You store the end result you want, such as three replicas of an image. Controllers compare that with what is running and keep closing the gap, instead of running a fixed script once.",
  },
  {
    id: "intro-self-heal",
    topic: "Kubernetes",
    difficulty: "beginner",
    question: "A Deployment wants 3 Pods. The node running one of them fails. What happens?",
    options: [
      { id: "a", text: "Nothing until you run kubectl create again" },
      { id: "b", text: "The Deployment is deleted because it no longer matches" },
      { id: "c", text: "A controller sees only 2 Pods and creates a replacement on a healthy node" },
      { id: "d", text: "The other two Pods are stopped so the count stays consistent" },
    ],
    correctOptionId: "c",
    explanation:
      "The desired count is still 3. The ReplicaSet controller notices fewer Pods than wanted and creates a new one, which the scheduler places on a working node. Nobody re-runs a command.",
  },
  {
    id: "intro-objects-api",
    topic: "Objects",
    difficulty: "beginner",
    question: "What does kubectl actually change when you create a Deployment?",
    options: [
      { id: "a", text: "It starts containers directly on a worker node over SSH" },
      { id: "b", text: "It edits a config file on every node" },
      { id: "c", text: "It sends a container image to the scheduler" },
      { id: "d", text: "It stores a Deployment object through the Kubernetes API, and controllers act on it" },
    ],
    correctOptionId: "d",
    explanation:
      "Kubernetes is driven by objects stored in its API. kubectl creates, reads, updates, and deletes those objects; the cluster's components react to them and do the actual work.",
  },
  {
    id: "intro-yaml-pod-apiversion",
    topic: "YAML: apiVersion",
    difficulty: "beginner",
    question: "Which apiVersion goes with kind: Pod?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "core/v1" },
      { id: "d", text: "pods/v1" },
    ],
    correctOptionId: "a",
    explanation:
      "Pod is in the core API group, which has no name in apiVersion, so it is written as plain v1. core/v1 and pods/v1 are not valid apiVersions, and apps/v1 is for Deployments and ReplicaSets.",
  },
  {
    id: "intro-yaml-deployment-apiversion",
    topic: "YAML: apiVersion",
    difficulty: "beginner",
    question: "Which apiVersion goes with kind: Deployment?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "batch/v1" },
      { id: "c", text: "apps/v1" },
      { id: "d", text: "deployments/v1" },
    ],
    correctOptionId: "c",
    explanation:
      "Deployments are in the apps group, version v1. The same group holds ReplicaSets, StatefulSets, and DaemonSets. batch/v1 is for Jobs and CronJobs.",
  },
  {
    id: "intro-yaml-cronjob-group",
    topic: "YAML: API groups",
    difficulty: "intermediate",
    question: "Which apiVersion goes with kind: CronJob?",
    options: [
      { id: "a", text: "apps/v1" },
      { id: "b", text: "batch/v1" },
      { id: "c", text: "v1" },
      { id: "d", text: "cron.k8s.io/v1" },
    ],
    correctOptionId: "b",
    explanation:
      "Job and CronJob are in the batch group, so both use batch/v1. A CronJob creates a Job on a schedule.",
  },
  {
    id: "intro-yaml-ingress",
    topic: "YAML: API groups",
    difficulty: "intermediate",
    question: "Which apiVersion goes with kind: Ingress?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "ingress/v1" },
      { id: "d", text: "networking.k8s.io/v1" },
    ],
    correctOptionId: "d",
    explanation:
      "Ingress is in the networking.k8s.io group. Named groups are written <group>/<version>, so the apiVersion is networking.k8s.io/v1.",
  },
  {
    id: "intro-yaml-hpa",
    topic: "YAML: API groups",
    difficulty: "intermediate",
    question: "Which apiVersion is the current stable one for kind: HorizontalPodAutoscaler?",
    options: [
      { id: "a", text: "autoscaling/v2" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "v1" },
      { id: "d", text: "metrics/v1" },
    ],
    correctOptionId: "a",
    explanation:
      "The HorizontalPodAutoscaler is in the autoscaling group, and its current stable version is v2. Stable versions are not always v1.",
  },
  {
    id: "intro-yaml-core-group",
    topic: "YAML: apiVersion",
    difficulty: "intermediate",
    question: "Why do Pod, Service, and ConfigMap use apiVersion: v1 with no group in front?",
    options: [
      { id: "a", text: "They are older and deprecated, so the group was removed" },
      { id: "b", text: "They are in the core group, which has no name, so only the version is written" },
      { id: "c", text: "The group is optional for every kind and kubectl fills it in" },
      { id: "d", text: "v1 is short for apps/v1" },
    ],
    correctOptionId: "b",
    explanation:
      "The core group is the one group without a name. Its kinds use just the version. Every other kind needs <group>/<version>, and leaving the group out does not work.",
  },
  {
    id: "intro-yaml-mismatch",
    topic: "YAML: apiVersion",
    difficulty: "beginner",
    question: "A manifest says apiVersion: v1 and kind: Deployment. What happens when you apply it?",
    options: [
      { id: "a", text: "It works, because v1 is the newest version" },
      { id: "b", text: "kubectl creates a Pod instead" },
      { id: "c", text: "It is rejected, because Deployment is not in the core v1 group" },
      { id: "d", text: "It is created but never starts any Pods" },
    ],
    correctOptionId: "c",
    explanation:
      "Each kind belongs to one API group. The core v1 group has no Deployment kind, so the request fails. Deployments need apiVersion: apps/v1.",
  },
  {
    id: "intro-yaml-spec-status",
    topic: "YAML: spec and status",
    difficulty: "beginner",
    question: "Who writes the status section of a Pod?",
    options: [
      { id: "a", text: "You, in the manifest file" },
      { id: "b", text: "kubectl, just before it sends the file" },
      { id: "c", text: "Nobody; status is always empty" },
      { id: "d", text: "The cluster: the kubelet and controllers that observe the Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "spec is the desired state you write. status is the observed state, filled in by the components watching the object, such as the kubelet for a Pod.",
  },
  {
    id: "intro-yaml-status-applied",
    topic: "YAML: spec and status",
    difficulty: "intermediate",
    question: "You add a status section with phase: Running to a Pod manifest and apply it. What happens to that section?",
    options: [
      { id: "a", text: "The API server ignores it; status is set by the cluster" },
      { id: "b", text: "The Pod is marked Running immediately, even before it starts" },
      { id: "c", text: "The apply fails because status is a reserved word" },
      { id: "d", text: "kubectl moves it into spec" },
    ],
    correctOptionId: "a",
    explanation:
      "Status reflects what the cluster observes, so values you send in it are discarded. The Pod's phase comes from the kubelet.",
  },
  {
    id: "intro-yaml-metadata",
    topic: "YAML: metadata",
    difficulty: "beginner",
    question: "In which top-level field do an object's name and labels go?",
    options: [
      { id: "a", text: "spec" },
      { id: "b", text: "metadata" },
      { id: "c", text: "status" },
      { id: "d", text: "kind" },
    ],
    correctOptionId: "b",
    explanation:
      "metadata holds identity: name, namespace, and labels. These fields work the same way for every kind. spec holds the desired state.",
  },
  {
    id: "intro-yaml-namespace-omitted",
    topic: "YAML: metadata",
    difficulty: "intermediate",
    question: "A Pod manifest has no metadata.namespace. Where is the Pod created?",
    options: [
      { id: "a", text: "In every namespace" },
      { id: "b", text: "In kube-system" },
      { id: "c", text: "In your current namespace, usually default" },
      { id: "d", text: "Nowhere; the apply fails" },
    ],
    correctOptionId: "c",
    explanation:
      "namespace is optional in metadata. Without it, kubectl uses the namespace of your current context, which is default unless you changed it.",
  },
  {
    id: "intro-yaml-required-fields",
    topic: "YAML: structure",
    difficulty: "beginner",
    question: "Which four top-level fields do you write in a typical manifest such as a Pod or Deployment?",
    options: [
      { id: "a", text: "name, image, replicas, status" },
      { id: "b", text: "kind, spec, status, labels" },
      { id: "c", text: "apiVersion, metadata, containers, status" },
      { id: "d", text: "apiVersion, kind, metadata, spec" },
    ],
    correctOptionId: "d",
    explanation:
      "Every manifest you write starts with apiVersion, kind, metadata, and spec. status is added by the cluster, labels sit inside metadata, and containers sit inside spec.",
  },
  {
    id: "intro-namespaced-node",
    topic: "Objects",
    difficulty: "intermediate",
    question: "Which of these objects is cluster-scoped, not namespaced?",
    options: [
      { id: "a", text: "Node" },
      { id: "b", text: "Pod" },
      { id: "c", text: "Service" },
      { id: "d", text: "ConfigMap" },
    ],
    correctOptionId: "a",
    explanation:
      "A Node is a machine in the cluster and has one name cluster-wide. Pods, Services, and ConfigMaps live inside a namespace.",
  },
  {
    id: "intro-pv-pvc-scope",
    topic: "Objects",
    difficulty: "advanced",
    question: "How do PersistentVolume and PersistentVolumeClaim differ in scope?",
    options: [
      { id: "a", text: "Both are namespaced" },
      { id: "b", text: "The claim is namespaced; the volume is cluster-scoped" },
      { id: "c", text: "The volume is namespaced; the claim is cluster-scoped" },
      { id: "d", text: "Both are cluster-scoped" },
    ],
    correctOptionId: "b",
    explanation:
      "A PersistentVolumeClaim is a request made from a namespace, next to the Pods that use it. The PersistentVolume it binds to is a cluster-wide piece of storage.",
  },
  {
    id: "intro-version-stages",
    topic: "API versions",
    difficulty: "intermediate",
    question: "In which order does a Kubernetes API version mature?",
    options: [
      { id: "a", text: "stable, beta, alpha" },
      { id: "b", text: "beta, alpha, stable" },
      { id: "c", text: "alpha, beta, stable" },
      { id: "d", text: "v1, v2, v3, with no other stages" },
    ],
    correctOptionId: "c",
    explanation:
      "Alpha versions such as v1alpha1 are off by default and may change or be removed. Beta versions such as v1beta1 are well tested but can still change. Stable versions such as v1 are the ones to use.",
  },
  {
    id: "intro-deploy-chain",
    topic: "Objects",
    difficulty: "beginner",
    question: "You create a Deployment. Which chain of objects results?",
    options: [
      { id: "a", text: "Deployment creates Pods directly, with no other object" },
      { id: "b", text: "Deployment creates a Service, which creates Pods" },
      { id: "c", text: "Pods create a ReplicaSet, which creates the Deployment" },
      { id: "d", text: "Deployment creates a ReplicaSet, which creates the Pods" },
    ],
    correctOptionId: "d",
    explanation:
      "A Deployment manages ReplicaSets, and each ReplicaSet keeps a set number of Pods running. A Service never creates Pods; it only sends traffic to them.",
  },
  {
    id: "intro-service-label",
    topic: "Objects",
    difficulty: "beginner",
    question: "How does a Service decide which Pods receive its traffic?",
    options: [
      { id: "a", text: "By a label selector that matches labels on the Pods" },
      { id: "b", text: "By a list of Pod names written in the Service" },
      { id: "c", text: "It sends traffic to every Pod in the namespace" },
      { id: "d", text: "By the Pods' IP addresses, fixed when the Service is created" },
    ],
    correctOptionId: "a",
    explanation:
      "A Service selects Pods by label. Pod names and IPs change when Pods are replaced, but a new Pod with the right label is picked up automatically.",
  },
  {
    id: "intro-imperative-declarative",
    topic: "Workflow",
    difficulty: "beginner",
    question: "Which of these is the declarative way to create a Deployment?",
    options: [
      { id: "a", text: "kubectl create deployment web --image=nginx:1.27" },
      { id: "b", text: "kubectl scale deployment web --replicas=3" },
      { id: "c", text: "kubectl apply -f web.yaml, with the Deployment described in web.yaml" },
      { id: "d", text: "kubectl run web --image=nginx:1.27" },
    ],
    correctOptionId: "c",
    explanation:
      "Declarative means the file describes the desired state and kubectl apply makes the cluster match it. The other commands are imperative: each one performs a single action.",
  },
];
