import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "replicasets-ownership",
    topic: "Labels and selectors",
    difficulty: "beginner",
    question: "How does a ReplicaSet decide which Pods count toward its replicas?",
    options: [
      { id: "a", text: "It keeps a list of the Pod names it created" },
      { id: "b", text: "It counts Pods whose labels match its selector" },
      { id: "c", text: "It counts every Pod on the same node" },
      { id: "d", text: "It counts every Pod that uses the same image" },
    ],
    correctOptionId: "b",
    explanation:
      "A ReplicaSet finds its Pods through spec.selector. Names, nodes, and images play no part, which is why a standalone Pod with matching labels can be adopted.",
  },
  {
    id: "replicasets-adopt",
    topic: "Labels and selectors",
    difficulty: "intermediate",
    question:
      "A ReplicaSet with replicas: 3 and selector app=frontend has 3 running Pods. You create a bare Pod labelled app=frontend. What happens?",
    options: [
      { id: "a", text: "The API server rejects the new Pod" },
      { id: "b", text: "The ReplicaSet raises its replicas to 4" },
      { id: "c", text: "The ReplicaSet adopts the Pod, sees 4, and deletes one Pod" },
      { id: "d", text: "The ReplicaSet creates a fourth Pod from its template" },
    ],
    correctOptionId: "c",
    explanation:
      "A Pod with matching labels and no owner is adopted. The ReplicaSet then counts 4 Pods against a desired 3 and deletes one. spec.replicas never changes on its own.",
  },
  {
    id: "replicasets-yaml-labels",
    topic: "ReplicaSet YAML",
    difficulty: "beginner",
    question: "What happens if spec.template.metadata.labels does not match spec.selector.matchLabels?",
    options: [
      { id: "a", text: "The API server rejects the ReplicaSet" },
      { id: "b", text: "The ReplicaSet creates Pods but leaves them unready" },
      { id: "c", text: "Kubernetes copies the selector labels into the template" },
      { id: "d", text: "The ReplicaSet runs with 0 replicas" },
    ],
    correctOptionId: "a",
    explanation:
      "Pods built from such a template would never match the selector, so the ReplicaSet would create Pods forever without counting any. The API server refuses the manifest instead.",
  },
  {
    id: "replicasets-update",
    topic: "ReplicaSets",
    difficulty: "intermediate",
    question: "You change the image in a running ReplicaSet's Pod template. What happens to its existing Pods?",
    options: [
      { id: "a", text: "They are replaced one at a time with the new image" },
      { id: "b", text: "They are all deleted and recreated at once" },
      { id: "c", text: "Their containers restart with the new image" },
      { id: "d", text: "Nothing. Only Pods created later use the new image" },
    ],
    correctOptionId: "d",
    explanation:
      "A ReplicaSet only checks the Pod count. It does not update existing Pods. Rolling out a new template is what a Deployment adds on top.",
  },
];
