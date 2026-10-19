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
];
