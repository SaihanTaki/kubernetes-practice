import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "pods-shared-network",
    topic: "Pods",
    difficulty: "beginner",
    question: "A Pod runs two containers. How can the first container reach a server listening on port 9000 in the second?",
    options: [
      { id: "a", text: "localhost:9000, because both containers share the Pod's network namespace" },
      { id: "b", text: "Only through a Service created for the second container" },
      { id: "c", text: "Each container has its own IP, so it must use the second container's IP" },
      { id: "d", text: "Containers in the same Pod cannot talk to each other" },
    ],
    correctOptionId: "a",
    explanation:
      "All containers in a Pod share one network namespace and one IP address, so they reach each other on localhost. This is also why two containers in one Pod cannot listen on the same port.",
  },
  {
    id: "pods-standalone-delete",
    topic: "Pods",
    difficulty: "beginner",
    question: "You created a Pod directly with no Deployment or ReplicaSet, then deleted it. What happens?",
    options: [
      { id: "a", text: "Kubernetes recreates it on another node" },
      { id: "b", text: "The kubelet restarts it with the same name" },
      { id: "c", text: "It is gone. Nothing recreates a standalone Pod" },
      { id: "d", text: "The scheduler recreates it once the node has free resources" },
    ],
    correctOptionId: "c",
    explanation:
      "Only a controller such as a ReplicaSet recreates Pods. restartPolicy restarts containers inside a Pod that still exists; it does not bring back a deleted Pod.",
  },
  {
    id: "pods-crashloop",
    topic: "Pods",
    difficulty: "intermediate",
    question: "kubectl get pods shows a Pod with STATUS CrashLoopBackOff and RESTARTS 6. What does this mean?",
    options: [
      { id: "a", text: "The image could not be pulled from the registry" },
      { id: "b", text: "The container keeps exiting, and the kubelet waits longer between each restart" },
      { id: "c", text: "The scheduler has not found a node for the Pod yet" },
      { id: "d", text: "The Pod finished its work successfully six times" },
    ],
    correctOptionId: "b",
    explanation:
      "CrashLoopBackOff means the container started, exited, and was restarted repeatedly, with a growing back-off delay. A pull failure shows ImagePullBackOff, and an unscheduled Pod stays Pending.",
  },
  {
    id: "pods-yaml-limits",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A container sets resources.limits.memory: \"256Mi\" and tries to use 400Mi. What happens?",
    options: [
      { id: "a", text: "The scheduler moves the Pod to a node with more memory" },
      { id: "b", text: "Nothing, limits are only used for scheduling" },
      { id: "c", text: "The container is killed for exceeding its memory limit (OOMKilled)" },
      { id: "d", text: "Kubernetes raises the limit to 400Mi automatically" },
    ],
    correctOptionId: "c",
    explanation:
      "Memory limits are enforced at runtime: a container that goes over is killed and shows OOMKilled, then restartPolicy decides whether it restarts. The scheduler uses requests, not limits, to place Pods.",
  },
];
