import { data as architecture } from "./chapters/architecture.data";
import { data as declarative } from "./chapters/declarative.data";
import { data as deployments } from "./chapters/deployments.data";
import { data as imperative } from "./chapters/imperative.data";
import { data as namespaces } from "./chapters/namespaces.data";
import { data as pods } from "./chapters/pods.data";
import { data as replicasets } from "./chapters/replicasets.data";
import type { ChapterData, Difficulty } from "./types";

export type Chapter = {
  slug: string;
  /** Group on the home page, e.g. "Basics". */
  section: string;
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
    section: "Basics",
    title: "Kubernetes Architecture",
    summary: "The control plane, worker nodes, and what happens when you ask for a workload.",
    difficulty: "beginner",
    ready: true,
    data: architecture,
  },
  {
    slug: "pods",
    section: "Basics",
    title: "Pods",
    summary: "The smallest unit Kubernetes runs: containers that share a network and lifecycle.",
    difficulty: "beginner",
    ready: true,
    data: pods,
  },
  {
    slug: "replicasets",
    section: "Basics",
    title: "ReplicaSets",
    summary: "How Kubernetes keeps a fixed number of matching Pods running.",
    difficulty: "beginner",
    ready: true,
    data: replicasets,
  },
  {
    slug: "deployments",
    section: "Basics",
    title: "Deployments",
    summary: "Scale and update an application through a Deployment and the ReplicaSets it manages.",
    difficulty: "intermediate",
    ready: true,
    data: deployments,
  },
  {
    slug: "namespaces",
    section: "Basics",
    title: "Namespaces",
    summary: "Split one cluster into named groups of resources, and target them with -n.",
    difficulty: "beginner",
    ready: true,
    data: namespaces,
  },
  {
    slug: "imperative",
    section: "Basics",
    title: "Imperative Commands",
    summary: "Create and change objects directly with kubectl run, create, scale, and set.",
    difficulty: "beginner",
    ready: true,
    data: imperative,
  },
  {
    slug: "declarative",
    section: "Basics",
    title: "Declarative YAML",
    summary: "Keep the state you want in files and let kubectl apply make the cluster match.",
    difficulty: "intermediate",
    ready: true,
    data: declarative,
  },
];

export const sections = [...new Set(chapters.map((c) => c.section))];

const all = chapters.map((c) => c.data);
export const quizzes = Object.fromEntries(chapters.map((c) => [c.slug, c.data.quiz]));
export const labs = all.flatMap((d) => d.labs);
export const manifests = Object.fromEntries(all.flatMap((d) => d.manifests).map((m) => [m.id, m]));
export const diagrams = Object.fromEntries(all.flatMap((d) => d.diagrams).map((d) => [d.id, d]));
