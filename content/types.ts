import type { LabDefinition } from "@/lib/labs";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type QuizQuestion = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
};

export type Manifest = {
  id: string;
  title: string;
  yaml: string;
  /** Explanations keyed by 1-based line number. */
  notes: { line: number; text: string }[];
};

export type DiagramDef = {
  id: string;
  /** Background boxes such as "Control plane". Drawn behind nodes, not clickable. */
  groups?: { id: string; label: string; x: number; y: number; width: number; height: number }[];
  nodes: { id: string; label: string; x: number; y: number; detail: string }[];
  edges: { from: string; to: string; label?: string }[];
  /** Optional walkthrough: each step highlights some nodes. */
  steps?: { title: string; text: string; nodes: string[] }[];
};

/** Everything a chapter needs besides its MDX prose. */
export type ChapterData = {
  objectives: string[];
  quiz: QuizQuestion[];
  manifests: Manifest[];
  labs: LabDefinition[];
  diagrams: DiagramDef[];
};
