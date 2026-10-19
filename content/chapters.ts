export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Chapter = {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  objectives: string[];
  /** False until the chapter's MDX file is written. */
  ready: boolean;
};

export const chapters: Chapter[] = [
  {
    slug: "architecture",
    title: "Kubernetes Architecture",
    summary: "The control plane, worker nodes, and what happens when you ask for a workload.",
    difficulty: "beginner",
    objectives: [],
    ready: false,
  },
  {
    slug: "pods",
    title: "Pods",
    summary: "The smallest unit Kubernetes runs: containers that share a network and lifecycle.",
    difficulty: "beginner",
    objectives: [],
    ready: false,
  },
  {
    slug: "replicasets",
    title: "ReplicaSets",
    summary: "How Kubernetes keeps a fixed number of matching Pods running.",
    difficulty: "beginner",
    objectives: [],
    ready: false,
  },
  {
    slug: "deployments",
    title: "Deployments",
    summary: "Scale and update an application through a Deployment and the ReplicaSets it manages.",
    difficulty: "intermediate",
    objectives: [
      "Explain how a Deployment, its ReplicaSet, and its Pods relate.",
      "Tell desired state apart from observed state in kubectl output.",
      "Scale a Deployment and confirm the new Pods are ready.",
      "Read every field of a Deployment manifest, including the update strategy.",
    ],
    ready: true,
  },
];
