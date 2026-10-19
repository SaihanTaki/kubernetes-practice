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

/** A box in an HTML diagram. A box with children is a group; one without is a card. */
export type DiagramBox = {
  id: string;
  /** Empty for a layout-only group with no border or heading. */
  label: string;
  /** Small second line, such as a status or "one IP per Pod". */
  sub?: string;
  /** Shown in the Details panel when the box is selected. */
  detail?: string;
  /** Children side by side (default) or stacked. */
  layout?: "row" | "column";
  /** Draw arrows between children, for a sequence or a request path. */
  flow?: boolean;
  children?: DiagramBox[];
};

export type DiagramDef = {
  id: string;
  root: DiagramBox;
  /** Optional walkthrough: each step highlights some boxes by id. */
  steps?: { title: string; text: string; highlight: string[] }[];
};

/** Everything a chapter needs besides its MDX prose. */
export type ChapterData = {
  objectives: string[];
  quiz: QuizQuestion[];
  manifests: Manifest[];
  labs: LabDefinition[];
  diagrams: DiagramDef[];
};
