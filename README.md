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

`pnpm build` writes a fully static site to `out/`. Upload that folder to any static host. To preview it locally:

```bash
pnpm build
pnpm serve out
```

### GitHub Pages

`.github/workflows/pages.yml` tests, builds, and publishes the site on every push to `main`.

1. In the repository, open Settings → Pages and set Source to **GitHub Actions**.
2. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

The workflow sets `BASE_PATH=/<repo>` so assets and links get that prefix. Builds without it (local, tests) serve from `/`.

## Simulator

The terminal is a simulated `kubectl`; input is never executed. Type `kubectl help` in any lab for the full list. It models Pods, ReplicaSets, Deployments, Services, ConfigMaps, Secrets, and Namespaces, including `apply -f`, labels and annotations, rolling updates and rollbacks, and readiness/liveness/startup probes.

Known limits, on purpose:

- No `logs`, `exec`, `edit`, `port-forward`, volumes, or `revisionHistoryLimit`.
- New Pods show `ContainerCreating` for one command; a rolling update moves one step per command.
- `kubectl rollout status` on a stuck rollout fails at once instead of after the progress deadline.
- Pods are spread over two fake worker nodes. There is no real scheduling.
- At most 20 replicas per workload.
- Output follows real `kubectl` formatting but is not identical in every detail.

## Project layout

```text
app/                 routes: home, chapters/[slug], cheatsheet
components/          terminal, lab, diagram, quiz, YAML walkthrough
content/             chapters (MDX), labs, quizzes, manifests, cheatsheet
lib/simulator/       the kubectl simulator, no React
lib/labs.ts          declarative lab validators
lib/manifest-schema.ts  Zod subset of the Kubernetes schema
tests/               simulator, content, and e2e tests
plan.md              product plan and roadmap
```

Content is plain data in the repository. The content tests check that every manifest is valid, every quiz answer exists, every lab solution completes its lab, and every cheatsheet command marked as simulated runs in the simulator.
