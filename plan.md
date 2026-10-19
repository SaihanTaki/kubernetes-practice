# Kubernetes Practice Playground — Project Plan

## 1. Project Overview

Build a practice-only website for learning Kubernetes through interactive diagrams, multiple-choice questions, a simulated `kubectl` terminal, guided exercises, and a searchable cheatsheet.

The website is intended for personal learning and should support both beginners and advanced learners.

### Core product principle

Users open a chapter, practice, and leave. Do not implement user accounts, progress tracking, persistent sessions, a database, or an admin/CMS interface.

Temporary state is allowed only while an exercise is active in the browser. Users must be able to reset an exercise to its initial state. State does not need to survive a page refresh or browser restart.

## 2. Goals

- Make Kubernetes concepts easier to understand through interactive visual explanations.
- Let users practice a useful subset of `kubectl` commands without requiring a real cluster.
- Provide guided labs with objectives, hints, validation, and reset functionality.
- Offer chapter-based MCQs with immediate feedback and explanations.
- Provide a searchable cheatsheet with copyable commands and YAML examples.
- Keep the application simple to develop, deploy, and maintain.

## 3. Non-Goals

Do not build the following for the MVP:

- Authentication, user profiles, or accounts.
- Progress tracking, streaks, leaderboards, or saved results.
- Database or backend API.
- Persistent cluster sessions or cloud-synced state.
- Real Kubernetes cluster access.
- Arbitrary shell execution.
- Full Kubernetes API or complete `kubectl` compatibility.
- Admin panel or content-management system.
- AI tutor or AI-generated content at runtime.

## 4. Recommended Technology Stack

Use the following unless the existing repository provides a strong reason to choose otherwise:

- **Framework:** Next.js with App Router
- **Language:** TypeScript with strict type checking
- **Styling:** Tailwind CSS
- **UI components:** shadcn/ui where useful
- **Interactive diagrams:** React Flow (`@xyflow/react`)
- **Terminal UI:** xterm.js or a lightweight custom terminal component
- **YAML parsing:** a maintained YAML parser such as `yaml`
- **Content:** Markdown/MDX and typed TypeScript or JSON data files
- **Schema validation:** Zod
- **Testing:** Vitest for unit tests and Playwright for essential end-to-end tests
- **Package manager:** pnpm

Keep the simulator as a standalone TypeScript module that does not depend on React or browser UI components.

The MVP should be deployable as a static site if the selected Next.js features and hosting configuration allow it. Do not add a server solely for the simulator.

## 5. Main User Experiences

### 5.1 Home Page

Provide a clear entry point to:

- Browse Kubernetes chapters.
- Open the practice playground.
- Open the cheatsheet.
- Discover beginner and advanced topics.

Keep the home page useful and lightweight. No login or dashboard is required.

### 5.2 Chapter Pages

Each chapter should contain:

- Title and short introduction.
- Learning objectives.
- Explanations with headings and diagrams where appropriate.
- Command examples.
- YAML definition walkthrough: a complete, valid manifest for the chapter's resource with each field explained (see below).
- Callouts for common mistakes.
- Embedded or linked MCQs.
- Related practice labs.
- Links to relevant cheatsheet entries.

The initial release must contain exactly these four chapters, in this order:

1. Kubernetes Architecture
2. Pods
3. ReplicaSets
4. Deployments

YAML coverage per chapter:

- **Kubernetes Architecture:** general manifest structure: `apiVersion`, `kind`, `metadata` (name, namespace, labels), `spec` as desired state, and `status` as observed state.
- **Pods:** Pod manifest: `containers`, `image`, `ports`, `env`, `resources`, and `restartPolicy`.
- **ReplicaSets:** ReplicaSet manifest: `replicas`, `selector.matchLabels`, and `template`, including why template labels must match the selector.
- **Deployments:** Deployment manifest: `replicas`, `selector`, `template`, and `strategy` (`RollingUpdate`, `maxSurge`, `maxUnavailable`), and how it differs from a ReplicaSet manifest.

Each chapter should include at least one MCQ about its YAML definition. Manifests shown in chapters must be valid Kubernetes YAML and should be checked by the content tests.

Do not add other top-level chapters to the initial release. Concepts such as labels, selectors, controllers, scheduling, and rollout behavior may be explained within these four chapters when needed. Additional chapters can be added later, but are outside the initial scope. Keep chapter content in the repository, not in a database.

### 5.3 Interactive Diagrams

Use React Flow for diagrams with clickable nodes, edges, pan, and zoom.

Initial diagrams should support the four launch chapters:

- **Kubernetes Architecture:** control plane, worker nodes, and how a request to create a workload is processed.
- **Pods:** Pod anatomy, containers within a Pod, and a simplified Pod lifecycle.
- **ReplicaSets:** how a ReplicaSet maintains a desired number of matching Pods.
- **Deployments:** Deployment → ReplicaSet → Pods relationship, scaling, and a simplified rollout sequence.

Do not build standalone Service or networking chapters/diagrams for the initial release.

Diagram requirements:

- Nodes should have readable labels and concise explanations.
- Clicking a node should show details in a side panel or popover.
- Where useful, provide step-by-step progression through an event sequence.
- Use the same terminology and examples as the related chapter.
- Diagrams may have temporary UI state, but do not save it across sessions.
- Ensure diagrams remain usable on smaller screens.

Do not try to make every diagram a fully simulated cluster. Use focused, purpose-built visualizations where they teach a concept better.

### 5.4 MCQ Quizzes

Support:

- Single-answer multiple-choice questions for the MVP.
- Immediate correct/incorrect feedback.
- Explanation after answering.
- Retry/reset functionality.
- Topic and difficulty labels.
- Optional randomization of question order and options.

Do not save scores or attempts after the current exercise ends.

Question content should be authored as data files and validated during development/build. Each question must have a valid answer and an explanation. Avoid ambiguous questions and distractors that are accidentally correct.

### 5.5 Simulated `kubectl` Terminal

The terminal is a **simulator**, not a real shell and not a real Kubernetes cluster.

Users should be able to enter supported commands and receive plausible, consistent output based on temporary in-memory cluster state.

Core interaction:

1. Load a lab fixture or an empty cluster.
2. Enter a supported command.
3. Parse and validate the command.
4. Execute the simulated operation.
5. Update the in-memory state if appropriate.
6. Render terminal output and update any connected resource visualization.
7. Allow the user to reset the lab.

The terminal should clearly communicate that it is simulated. Never claim that simulated behavior is identical to a real Kubernetes cluster.

#### Initial command scope

Implement commands incrementally. The first usable version should support:

- `kubectl help` or a custom help command.
- `kubectl get pods`
- `kubectl get deployments`
- `kubectl get replicasets`
- `kubectl get namespaces`
- `kubectl describe pod <name>`
- `kubectl describe deployment <name>`
- `kubectl scale deployment <name> --replicas=<n>`
- `kubectl scale replicaset <name> --replicas=<n>`
- `kubectl delete pod <name>`
- `kubectl delete deployment <name>`
- `kubectl get <resource> -o yaml`
- Basic namespace flags and resource filtering, when supported.

Add further commands only when the simulator can model their effects consistently.

Later candidates:

- `kubectl apply -f` with YAML parsing and a deliberately limited set of supported resource schemas.
- `kubectl create deployment`
- `kubectl run`
- Services, `kubectl get services`, and `kubectl expose`.
- `kubectl logs`
- `kubectl get events`
- Labels and selectors.
- ConfigMaps and Secrets.
- Rollout status/history/undo in a simplified model.

Every supported command must have tests. Unsupported commands should return a helpful error that explains the supported subset.

#### Safety and correctness requirements

- Never execute terminal input using a host shell, `eval`, or `Function`.
- Never pass user-entered commands to an operating-system process.
- Parse input into tokens/structured arguments and dispatch only to explicitly implemented handlers.
- Validate resource names, arguments, flags, and numeric values.
- Handle malformed input without crashing the application.
- Use a controlled command allowlist.
- Do not imply that the simulator offers real security isolation; no real cluster or shell is involved.

### 5.6 Temporary Cluster Model

Keep cluster state in browser memory for the active playground/lab only. It may reset on reload.

Model only the resources required by the supported exercises. Start with:

- Namespace
- Node (simplified)
- Pod
- ReplicaSet
- Deployment

Add Services, ConfigMaps, Secrets, and events when their associated chapters or labs are implemented.

A resource should have a stable identity within the current simulation, a name, namespace where applicable, and the fields needed by supported commands.

For workload resources, distinguish desired state from observed state. For example, a Deployment may desire three replicas while only two Pods are ready.

Use deterministic, simplified reconciliation rather than attempting to reproduce all Kubernetes controller behavior. Document model limitations.

When a Deployment is scaled, update its desired replica count and simulate the resulting ReplicaSet/Pod count. When a Pod is deleted, behavior should be determined by whether a managing controller exists in the model. A managed Pod may be recreated by simplified reconciliation; an unmanaged Pod should remain deleted.

### 5.7 Guided Labs

A lab should include:

- Title and difficulty.
- Brief scenario and objective.
- Initial cluster fixture.
- Task instructions.
- Optional hints.
- Automated validation of the resulting simulated state.
- Reset button.
- Optional solution reveal after the user chooses to view it.

Do not grade based only on an exact command string. Validate the resulting state so that multiple valid command sequences can complete a task.

Use declarative validators, not arbitrary JavaScript execution from content files.

Initial labs must align with the launch chapters that use the terminal:

1. **Pods:** list and inspect Pods; find the failing Pod and delete it.
2. **ReplicaSets:** scale a ReplicaSet to five replicas and verify the resulting Pod count.
3. **Deployments:** scale a Deployment to three replicas and inspect its ReplicaSet and Pods.
4. **Deployments:** correct a simple Deployment YAML file, if `apply -f` is implemented and tested.

The Kubernetes Architecture chapter has no terminal lab; it is practiced through its interactive diagram and MCQs.

These are practice exercises, not persistent assignments. Implement only labs the simulator can accurately support.

### 5.8 Cheatsheet

Provide a searchable, categorized reference for:

- `kubectl get`, `describe`, `scale`, and `delete`.
- Pods, ReplicaSets, and Deployments.
- Namespaces, labels, and selectors.
- YAML examples for Pods, ReplicaSets, and Deployments.
- Basic Pod troubleshooting.

Add categories such as Services, logs, requests/limits, and probes only alongside the chapters that cover them.

Each entry should include a title, short explanation, command or YAML example, and optional related chapter link.

Requirements:

- Search by title, command, category, and keywords.
- Copy command/code to clipboard.
- Keep examples consistent with the simulator's supported features.
- Clearly distinguish simulator-supported behavior from real Kubernetes behavior where they differ.

## 6. Architecture

Use a simple frontend-first architecture:

```text
Next.js application
├── Chapter renderer
├── Interactive diagrams
├── MCQ component
├── Terminal UI
├── Lab instructions and validator UI
└── Cheatsheet search
        |
        v
Shared client-side practice context
├── Active lab definition
├── Temporary simulated cluster
├── Terminal history
└── Current exercise UI state
        |
        v
Standalone TypeScript simulator
├── Command tokenizer/parser
├── Command validation
├── Command handlers
├── Resource model
├── Simplified reconciliation
├── Event/output generation
└── Reset/fixture loader

Static repository content
├── Chapters
├── Diagram definitions
├── Quiz questions
├── Lab definitions and fixtures
└── Cheatsheet entries
```

Important boundaries:

- The simulator must not import React components.
- Content definitions must not contain arbitrary executable code.
- The terminal and resource inspector must use the same active simulator instance/state.
- Each lab should load its own fixture and be resettable.
- Avoid global mutable state shared accidentally between unrelated exercises.
- Keep temporary state in memory; do not write it to localStorage, IndexedDB, cookies, or a server.
- Do not introduce a backend or database for the MVP.

## 7. Suggested Repository Structure

Adapt this to the actual repository if one already exists:

```text
k8s-playground/
├── app/
│   ├── page.tsx
│   ├── chapters/
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── playground/
│   │   └── page.tsx
│   └── cheatsheet/
│       └── page.tsx
├── components/
│   ├── layout/
│   ├── chapter/
│   ├── diagrams/
│   ├── quiz/
│   ├── terminal/
│   ├── labs/
│   └── cheatsheet/
├── content/
│   ├── chapters/
│   ├── diagrams/
│   ├── quizzes/
│   ├── labs/
│   └── cheatsheet/
├── lib/
│   ├── content/
│   └── simulator/
│       ├── types.ts
│       ├── parser.ts
│       ├── commands/
│       ├── resources/
│       ├── reconcile.ts
│       ├── fixtures.ts
│       └── index.ts
├── tests/
│   ├── simulator/
│   ├── content/
│   └── e2e/
├── package.json
└── README.md
```

A monorepo is not required for the MVP. If package separation would slow development, keep `lib/simulator` as a clean standalone module within the app and extract it later.

## 8. Content Data Contracts

Use TypeScript types and runtime schema validation for content. Suggested contracts:

```typescript
type Difficulty = "beginner" | "intermediate" | "advanced";

type Chapter = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  objectives: string[];
  contentFile: string;
  diagramIds?: string[];
  quizIds?: string[];
  labIds?: string[];
};

type QuizQuestion = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
};

type LabObjective = {
  id: string;
  description: string;
  validator:
    | {
        kind: "resource-exists";
        resourceType: string;
        resourceName: string;
      }
    | {
        kind: "replica-count";
        resourceType: "Deployment" | "ReplicaSet";
        resourceName: string;
        expectedValue: number;
      }
    | {
        kind: "resource-absent";
        resourceType: string;
        resourceName: string;
      }
    | {
        kind: "ready-pod-count";
        ownerType: "Deployment" | "ReplicaSet";
        ownerName: string;
        expectedValue: number;
      };
};

type LabDefinition = {
  id: string;
  title: string;
  difficulty: Difficulty;
  instructions: string[];
  initialStateFixture: string;
  objectives: LabObjective[];
  hints: string[];
  solution?: string[];
};

type CheatsheetEntry = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  explanation: string;
  code: string;
  language: "bash" | "yaml";
  relatedChapterIds?: string[];
};
```

Adjust contracts to match actual implementation. Prefer explicit validator types over arbitrary functions in data. Validate references and duplicate IDs during tests or build.

## 9. Visual and Interaction Guidelines

- Aim for a clean developer-tool aesthetic rather than a gamified children's learning site.
- Use a consistent layout, clear typography, restrained colors, and accessible contrast.
- Make the chapter content readable and the interactive area easy to find.
- Use a split-pane layout for terminal exercises on desktop: instructions/resource inspector on one side, terminal on the other.
- On mobile, stack panels vertically and avoid requiring horizontal scrolling.
- Provide keyboard-friendly controls, visible focus states, and accessible labels.
- Keep terminal output selectable and easy to copy.
- Show clear success, failure, and unsupported-command messages.
- Add reset controls near the practice area.
- Do not add visual elements that have no functional purpose.

## 10. Implementation Roadmap

Work in small, testable milestones. Do not attempt to implement the entire Kubernetes command surface before delivering a working website.

### Milestone 1 — App foundation

- Inspect the repository and follow existing conventions if applicable.
- Set up Next.js, TypeScript strict mode, styling, and component primitives.
- Create global layout, navigation, home page, chapter route, playground route, and cheatsheet route.
- Add a small sample chapter and establish content types.
- Add linting, formatting, and type-check scripts.

**Acceptance criteria:** the app runs locally; routes work; layout is responsive; no backend or persistence layer exists.

### Milestone 2 — Four initial chapters and cheatsheet

- Implement Markdown/MDX chapter rendering for exactly four chapters: Kubernetes Architecture, Pods, ReplicaSets, and Deployments.
- Add chapter navigation and related-content links.
- Implement searchable cheatsheet entries and copy buttons for concepts and commands covered by these chapters.
- Add a content validation test for duplicate IDs, missing chapter content, and broken references.

**Acceptance criteria:** all four chapters render correctly, each with its YAML definition walkthrough; no extra top-level chapters appear in the initial release; cheatsheet search works; code can be copied; invalid content is caught by tests.

### Milestone 3 — MCQs and diagrams

- Implement MCQs with immediate feedback, explanations, and reset.
- Build diagrams for Kubernetes Architecture, Pods, ReplicaSets, and Deployments.
- Add clickable nodes with explanatory details.
- Add step-by-step diagram mode for at least one lifecycle or controller workflow.

**Acceptance criteria:** quiz answers are checked correctly; diagrams are interactive and usable on desktop and mobile; no progress is persisted.

### Milestone 4 — Simulator foundation

- Define cluster/resource types and fixture loading.
- Implement command tokenizer/parser and controlled dispatch.
- Implement `get`, `describe`, `scale`, and `delete` for the initial resource set.
- Add terminal history, helpful errors, and reset.
- Add unit tests for parsing, invalid commands, state transitions, and output.

**Acceptance criteria:** commands operate on temporary state consistently; invalid input does not crash the app; no user input executes as a real shell command.

### Milestone 5 — Labs and YAML

- Define declarative lab fixtures and objective validators.
- Build guided lab UI with hints, reset, and solution reveal.
- Add YAML parsing and validation for a limited set of supported resources.
- Implement `apply -f` only for resource kinds and fields covered by tests.
- Connect the simulator to a resource inspector and at least one diagram.

**Acceptance criteria:** a lab can be completed through different valid command sequences; validation checks resulting state; reset restores the exact fixture.

### Milestone 6 — Polish and release

- Polish the four launch chapters: Kubernetes Architecture, Pods, ReplicaSets, and Deployments.
- Include beginner explanations and selected intermediate/advanced details within those chapters rather than adding more top-level chapters.
- Add end-to-end tests for browsing a chapter, answering a quiz, completing a lab, and resetting it.
- Check keyboard navigation, accessibility, responsive layout, and error states.
- Document the simulator's supported commands and known limitations.
- Add deployment instructions.

**Acceptance criteria:** a user can open the website, learn a concept, explore a diagram, complete a lab, answer a quiz, search the cheatsheet, and leave without creating an account or saving data.

## 11. Testing Strategy

### Unit tests

- Command parsing, flags, and malformed input.
- Each implemented command handler.
- Resource creation, updates, and deletion.
- Desired versus observed replica state.
- Simplified reconciliation behavior.
- Fixture loading and reset.
- Lab validators and partial completion.
- Content schemas and cross-references.

### Integration tests

- Terminal command updates the same state shown by the resource inspector.
- Diagram updates when relevant resource state changes.
- Reset restores initial state and clears terminal output if intended.
- Unsupported commands return understandable messages.
- Invalid YAML does not mutate cluster state.

### End-to-end tests

- Navigate from the home page to a chapter.
- Answer an MCQ and view its explanation.
- Open a lab and execute a supported command.
- Complete and reset a lab.
- Search and copy a cheatsheet entry.

## 12. Definition of Done

The MVP is done when:

- [ ] The website works without accounts, a database, or a backend service.
- [ ] Chapters, diagrams, MCQs, labs, and cheatsheet are accessible through clear navigation.
- [ ] All four chapter diagrams are interactive.
- [ ] MCQs provide immediate feedback and explanations.
- [ ] The terminal supports a documented, tested subset of `kubectl`.
- [ ] Lab fixtures and state can be reset reliably.
- [ ] The terminal, resource inspector, and diagrams stay consistent where connected.
- [ ] User-entered commands never execute on the host machine.
- [ ] No learning progress or practice state is persisted.
- [ ] Tests, type checking, and linting pass.
- [ ] README explains setup, development, testing, deployment, and simulator limitations.

## 13. Instructions for the Coding Agent

1. Inspect the existing repository before changing files. If it is empty, scaffold the project using the recommended stack.
2. Implement the project in milestones. Do not create every placeholder page and call the project complete.
3. Prioritize a polished, functional vertical slice over a large amount of incomplete content.
4. Keep the simulator deterministic, testable, and isolated from UI code.
5. Do not add authentication, a database, progress tracking, analytics, or backend infrastructure.
6. Do not execute terminal input as a real shell command.
7. Use typed interfaces and validate content data.
8. Add tests as each simulator command or behavior is implemented.
9. Keep dependencies and abstractions proportional to this personal project's scope.
10. At the end of each milestone, report what was implemented, tests run, known limitations, and the next milestone.

**Recommended first vertical slice:** build the four initial chapter entries—Kubernetes Architecture, Pods, ReplicaSets, and Deployments—then make the Deployments chapter the first fully integrated vertical slice. It should contain an interactive Deployment → ReplicaSet → Pods diagram, a four-question MCQ, and a lab where the learner scales a Deployment using the simulated terminal. The diagram and terminal should share the same temporary exercise state. This slice pulls the minimum needed from Milestones 2–5 (one chapter, one diagram, `get`/`scale`, one lab); build it right after Milestone 1, then complete those milestones for the other chapters. Do not add additional top-level chapters in the initial release.
