import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { chapters, diagrams, labs, manifests, quizzes } from "@/content/chapters";
import { cheatsheet } from "@/content/cheatsheet";
import { check } from "@/lib/labs";
import { manifestSchema } from "@/lib/manifest-schema";
import { createCluster, run } from "@/lib/simulator";

const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);

describe("chapters", () => {
  it("has the four launch chapters in order", () => {
    expect(chapters.map((c) => c.slug)).toEqual(["architecture", "pods", "replicasets", "deployments"]);
  });

  it.each(chapters.filter((c) => c.ready))("$slug has content, objectives, and a YAML question", (c) => {
    expect(existsSync(`content/chapters/${c.slug}.mdx`)).toBe(true);
    expect(c.data.objectives.length).toBeGreaterThan(0);
    expect(c.data.quiz.length).toBe(4);
    expect(c.data.quiz.some((q) => /yaml/i.test(q.topic))).toBe(true);
    expect(c.data.manifests.length).toBeGreaterThan(0);
  });
});

describe("manifests", () => {
  it("has unique ids", () => unique(chapters.flatMap((c) => c.data.manifests.map((m) => m.id))));

  it.each(Object.values(manifests))("$id is valid Kubernetes YAML with notes on real lines", (m) => {
    const result = manifestSchema.safeParse(parse(m.yaml));
    expect(result.error?.issues).toBeUndefined();
    const lineCount = m.yaml.split("\n").length;
    for (const n of m.notes) {
      expect(n.line).toBeGreaterThanOrEqual(1);
      expect(n.line).toBeLessThanOrEqual(lineCount);
    }
  });

  it("rejects a selector that does not match the template", () => {
    const bad = parse(manifests.deployment.yaml);
    bad.spec.selector.matchLabels.app = "other";
    expect(manifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("diagrams", () => {
  it("has unique ids", () => unique(Object.keys(diagrams)));

  it.each(Object.values(diagrams))("$id references only its own nodes", (d) => {
    const ids = d.nodes.map((n) => n.id);
    unique(ids);
    for (const e of d.edges) expect(ids).toEqual(expect.arrayContaining([e.from, e.to]));
    for (const s of d.steps ?? []) expect(ids).toEqual(expect.arrayContaining(s.nodes));
  });
});

describe("quizzes", () => {
  const all = Object.values(quizzes).flat();
  it("has unique question ids", () => unique(all.map((q) => q.id)));

  it.each(all)("$id has a valid answer and explanation", (q) => {
    unique(q.options.map((o) => o.id));
    expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
    expect(q.explanation.length).toBeGreaterThan(20);
  });
});

describe("labs", () => {
  it("has unique ids", () => unique(labs.map((l) => l.id)));

  it.each(labs)("$id fixture is valid", (lab) => {
    expect(() => createCluster(lab.fixture)).not.toThrow();
  });

  it.each(labs)("$id starts incomplete and its solution completes it", (lab) => {
    let c = createCluster(lab.fixture);
    expect(lab.objectives.every((o) => check(c, o.validator))).toBe(false);
    for (const cmd of lab.solution) {
      const r = run(c, cmd);
      expect(r.error, `${cmd}: ${r.output}`).toBe(false);
      c = r.cluster;
    }
    for (const o of lab.objectives) expect(check(c, o.validator), o.id).toBe(true);
  });
});

describe("cheatsheet", () => {
  it("has unique ids and real chapter links", () => {
    unique(cheatsheet.map((e) => e.id));
    for (const e of cheatsheet) if (e.relatedChapter) expect(chapters.map((c) => c.slug)).toContain(e.relatedChapter);
  });

  it.each(cheatsheet.filter((e) => e.simulated))("$id runs in the simulator", (e) => {
    let c = createCluster({
      deployments: [{ name: "web", replicas: 2, image: "nginx:1.27", labels: { app: "web" } }],
      replicaSets: [{ name: "frontend", replicas: 2, image: "nginx:1.27", labels: { app: "frontend" } }],
      pods: [{ name: "toolbox", image: "busybox:1.36" }],
    });
    for (const cmd of e.code.split("\n")) {
      const r = run(c, cmd);
      expect(r.error, `${cmd}: ${r.output}`).toBe(false);
      c = r.cluster;
    }
  });

  it.each(cheatsheet.filter((e) => e.language === "yaml"))("$id is valid Kubernetes YAML", (e) => {
    expect(manifestSchema.safeParse(parse(e.code)).error?.issues).toBeUndefined();
  });
});
