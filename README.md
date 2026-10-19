# Kubernetes Practice

A practice site for learning Kubernetes: chapters with YAML walkthroughs, quizzes, and a simulated `kubectl` terminal with a live diagram. No accounts, no backend, nothing saved. Reload a page and every exercise starts fresh.

The terminal is a simulator. It parses a small set of `kubectl` commands and runs them against an in-memory cluster in the browser. It never runs a shell and never talks to a real cluster.

## Requirements

- Node.js 20 or newer
- pnpm 11 (`corepack enable` or `npm i -g pnpm`)

## Run it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server with hot reload |
| `pnpm test` | Unit and content tests (Vitest) |
| `pnpm test:e2e` | Browser tests (Playwright). Builds the site and serves it on port 3100 first |
| `pnpm typecheck` | TypeScript check |
| `pnpm lint` | ESLint |
| `pnpm build` | Static export to `out/` |

Before the first e2e run, install the browser once:

```bash
pnpm exec playwright install chromium
```

## Deploy

`pnpm build` writes a fully static site to `out/`. Upload that folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket). To preview it locally:

```bash
pnpm build
pnpm serve out
```

## Simulator

Supported commands:

```text
kubectl get <pods|replicasets|deployments|namespaces|nodes> [name]
kubectl describe <pod|replicaset|deployment> <name>
kubectl scale <deployment|replicaset> <name> --replicas=<n>
kubectl delete <pod|deployment> <name>
kubectl help
clear
```

Flags: `-n/--namespace`, `-A/--all-namespaces`, `-l/--selector key=value`, `-o yaml`. Short names (`po`, `rs`, `deploy`, `ns`) and the `type/name` form work.

Known limits, on purpose:

- Only Pods, ReplicaSets, and Deployments are modelled. No Services, ConfigMaps, or Secrets yet.
- No `apply`, `create`, `logs`, `rollout`, or events.
- New Pods show `ContainerCreating` for one command, then become `Running`. Real clusters take a variable amount of time.
- Pods are spread over two fake worker nodes. There is no real scheduling.
- At most 20 replicas per workload.
- Output follows real `kubectl` formatting but is not identical in every detail.

## Project layout

```text
app/                 routes: home, chapters/[slug], playground, cheatsheet
components/          terminal, lab, diagram, quiz, YAML walkthrough
content/             chapters (MDX), labs, quizzes, manifests, cheatsheet
lib/simulator/       the kubectl simulator, no React
lib/labs.ts          declarative lab validators
lib/manifest-schema.ts  Zod subset of the Kubernetes schema
tests/               simulator, content, and e2e tests
plan.md              product plan and roadmap
```

Content is plain data in the repository. The content tests check that every manifest is valid, every quiz answer exists, every lab solution completes its lab, and every cheatsheet command marked as simulated runs in the simulator.
