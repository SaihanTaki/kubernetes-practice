import { data as architecture } from "./chapters/architecture.data";
import { data as deployments } from "./chapters/deployments.data";
import { data as pods } from "./chapters/pods.data";
import { data as replicasets } from "./chapters/replicasets.data";
import type { ChapterData, Difficulty } from "./types";

export type Chapter = {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  /** False until the chapter's MDX and data are written. */
  ready: boolean;
  data: ChapterData;
};

export const chapters: Chapter[] = [
  {
    slug: "architecture",
    title: "Kubernetes Architecture",
    summary: "The control plane, worker nodes, and what happens when you ask for a workload.",
    difficulty: "beginner",
    ready: false,
    data: architecture,
  },
  {
    slug: "pods",
    title: "Pods",
    summary: "The smallest unit Kubernetes runs: containers that share a network and lifecycle.",
    difficulty: "beginner",
    ready: false,
    data: pods,
  },
  {
    slug: "replicasets",
    title: "ReplicaSets",
    summary: "How Kubernetes keeps a fixed number of matching Pods running.",
    difficulty: "beginner",
    ready: true,
    data: replicasets,
  },
  {
    slug: "deployments",
    title: "Deployments",
    summary: "Scale and update an application through a Deployment and the ReplicaSets it manages.",
    difficulty: "intermediate",
    ready: true,
    data: deployments,
  },
];

const all = chapters.map((c) => c.data);
export const quizzes = Object.fromEntries(chapters.map((c) => [c.slug, c.data.quiz]));
export const labs = all.flatMap((d) => d.labs);
export const manifests = Object.fromEntries(all.flatMap((d) => d.manifests).map((m) => [m.id, m]));
export const diagrams = Object.fromEntries(all.flatMap((d) => d.diagrams).map((d) => [d.id, d]));
