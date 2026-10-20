import { data as architecture } from "./chapters/architecture.data";
import { data as declarative } from "./chapters/declarative.data";
import { data as deployments } from "./chapters/deployments.data";
import { data as imperative } from "./chapters/imperative.data";
import { data as intro } from "./chapters/intro.data";
import { data as namespaces } from "./chapters/namespaces.data";
import { data as pods } from "./chapters/pods.data";
import { data as replicasets } from "./chapters/replicasets.data";
import { data as services } from "./chapters/services.data";
import { data as labels } from "./chapters/labels.data";
import { data as rollouts } from "./chapters/rollouts.data";
import { data as config } from "./chapters/config.data";
import { data as healthChecks } from "./chapters/health-checks.data";
import { data as jobs } from "./chapters/jobs.data";
import { data as ingress } from "./chapters/ingress.data";
import { data as networkPolicies } from "./chapters/network-policies.data";
import { data as resources } from "./chapters/resources.data";
import { data as volumes } from "./chapters/volumes.data";
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
    slug: "intro",
    section: "Basics",
    title: "Introduction to Kubernetes",
    summary: "What Kubernetes does, the objects you will use, and how a manifest names them.",
    difficulty: "beginner",
    ready: true,
    data: intro,
  },
  {
    slug: "architecture",
    section: "Basics",
    title: "Kubernetes Architecture",
    summary: "The control plane, the worker nodes, and the container runtime that actually runs your containers.",
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
  {
    slug: "services",
    section: "Workloads & Networking",
    title: "Services",
    summary: "Give a changing set of Pods one stable address, and route traffic to them inside and outside the cluster.",
    difficulty: "beginner",
    ready: true,
    data: services,
  },
  {
    slug: "labels",
    section: "Workloads & Networking",
    title: "Labels, Selectors, and Annotations",
    summary: "Tag objects with labels, pick them with selectors, and attach notes for tools with annotations.",
    difficulty: "beginner",
    ready: true,
    data: labels,
  },
  {
    slug: "rollouts",
    section: "Workloads & Networking",
    title: "Rolling Updates and Rollbacks",
    summary: "Control how a Deployment replaces Pods, watch a rollout, and undo a bad release.",
    difficulty: "intermediate",
    ready: true,
    data: rollouts,
  },
  {
    slug: "jobs",
    section: "Workloads & Networking",
    title: "Jobs and CronJobs",
    summary: "Run work to completion, retry failures, and start it on a schedule.",
    difficulty: "intermediate",
    ready: true,
    data: jobs,
  },
  {
    slug: "ingress",
    section: "Workloads & Networking",
    title: "Ingress",
    summary: "Route HTTP traffic from outside the cluster to Services by host name and path.",
    difficulty: "intermediate",
    ready: true,
    data: ingress,
  },
  {
    slug: "network-policies",
    section: "Workloads & Networking",
    title: "Network Policies",
    summary: "Decide which Pods may talk to which, and block everything else.",
    difficulty: "advanced",
    ready: true,
    data: networkPolicies,
  },
  {
    slug: "config",
    section: "Configuration",
    title: "ConfigMaps and Secrets",
    summary: "Keep settings and credentials out of the image and hand them to Pods as environment variables or files.",
    difficulty: "beginner",
    ready: true,
    data: config,
  },
  {
    slug: "health-checks",
    section: "Configuration",
    title: "Health Checks: Probes",
    summary: "Tell Kubernetes when a container is started, ready for traffic, or stuck and in need of a restart.",
    difficulty: "intermediate",
    ready: true,
    data: healthChecks,
  },
  {
    slug: "resources",
    section: "Configuration",
    title: "Resource Requests and Limits",
    summary: "Reserve CPU and memory for a container, cap what it may use, and see what happens when it does not fit.",
    difficulty: "intermediate",
    ready: true,
    data: resources,
  },
  {
    slug: "volumes",
    section: "Storage & Scheduling",
    title: "Volumes and Persistent Storage",
    summary: "Keep data beyond a container's life with volumes, PersistentVolumeClaims, and StorageClasses.",
    difficulty: "intermediate",
    ready: true,
    data: volumes,
  },
];

export const sections = [...new Set(chapters.map((c) => c.section))];

const all = chapters.map((c) => c.data);
export const quizzes = Object.fromEntries(chapters.map((c) => [c.slug, c.data.quiz]));
export const labs = all.flatMap((d) => d.labs);
export const manifests = Object.fromEntries(all.flatMap((d) => d.manifests).map((m) => [m.id, m]));
export const diagrams = Object.fromEntries(all.flatMap((d) => d.diagrams).map((d) => [d.id, d]));
