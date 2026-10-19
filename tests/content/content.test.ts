import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { chapters } from "@/content/chapters";
import { labs } from "@/content/labs";
import { manifests } from "@/content/manifests";
import { quizzes } from "@/content/quizzes";
import { check } from "@/lib/labs";
import { manifestSchema } from "@/lib/manifest-schema";
import { createCluster, run } from "@/lib/simulator";

const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);

describe("chapters", () => {
  it("has the four launch chapters in order", () => {
    expect(chapters.map((c) => c.slug)).toEqual(["architecture", "pods", "replicasets", "deployments"]);
  });

  it.each(chapters.filter((c) => c.ready))("$slug has content and objectives", (c) => {
    expect(existsSync(`content/chapters/${c.slug}.mdx`)).toBe(true);
    expect(c.objectives.length).toBeGreaterThan(0);
  });
});

describe("manifests", () => {
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
