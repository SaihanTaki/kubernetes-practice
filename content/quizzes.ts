import type { Difficulty } from "./chapters";

export type QuizQuestion = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
};

export const quizzes: Record<string, QuizQuestion[]> = {
  deployments: [
    {
      id: "deploy-owner",
      topic: "Deployments",
      difficulty: "beginner",
      question: "Which object creates the Pods for a Deployment?",
      options: [
        { id: "a", text: "The Deployment creates them directly" },
        { id: "b", text: "A ReplicaSet owned by the Deployment" },
        { id: "c", text: "The kube-scheduler" },
        { id: "d", text: "The kubelet on the control plane node" },
      ],
      correctOptionId: "b",
      explanation:
        "A Deployment manages ReplicaSets, and each ReplicaSet creates and removes Pods to match its replica count. The scheduler only picks a node for a Pod that already exists.",
    },
    {
      id: "deploy-delete-pod",
      topic: "Deployments",
      difficulty: "beginner",
      question: "A Deployment has replicas: 3. You delete one of its Pods. What happens next?",
      options: [
        { id: "a", text: "The Deployment drops to 2 replicas" },
        { id: "b", text: "Nothing until you run kubectl apply again" },
        { id: "c", text: "The ReplicaSet creates a new Pod with a new name" },
        { id: "d", text: "The deleted Pod restarts with the same name" },
      ],
      correctOptionId: "c",
      explanation:
        "Desired state is still 3. The ReplicaSet sees only 2 matching Pods and creates a replacement. The new Pod gets a new generated name.",
    },
    {
      id: "deploy-selector",
      topic: "Deployment YAML",
      difficulty: "intermediate",
      question: "In a Deployment manifest, spec.selector.matchLabels must match which field?",
      options: [
        { id: "a", text: "metadata.labels of the Deployment" },
        { id: "b", text: "spec.template.metadata.labels" },
        { id: "c", text: "The container name" },
        { id: "d", text: "metadata.name of the Deployment" },
      ],
      correctOptionId: "b",
      explanation:
        "The selector decides which Pods belong to the Deployment, so the Pod template must carry those labels. If they do not match, the API server rejects the manifest. The Deployment's own labels are free to differ.",
    },
    {
      id: "deploy-surge",
      topic: "Deployment YAML",
      difficulty: "advanced",
      question:
        "A Deployment has replicas: 4, maxSurge: 1, and maxUnavailable: 0. During a rolling update, what is the most Pods that can exist at once?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
        { id: "d", text: "8" },
      ],
      correctOptionId: "b",
      explanation:
        "maxSurge: 1 allows one Pod above the desired 4. maxUnavailable: 0 means an old Pod is only removed after a new one is ready, so the count never exceeds 5.",
    },
  ],
};
