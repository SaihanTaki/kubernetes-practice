import type { Cluster, ClusterEvent, Labels, PortRef, ServiceType } from "./types";

export class CommandError extends Error {}

export function fail(message: string): never {
  throw new CommandError(message);
}

export type Requirement = { key: string; op: "=" | "!=" | "exists" | "!exists" | "in" | "notin"; values: string[] };

export type Parsed = {
  verb: string;
  args: string[];
  namespace: string;
  allNamespaces: boolean;
  selector?: Requirement[];
  showLabels: boolean;
  output?: "yaml" | "wide";
  replicas?: number;
  image?: string;
  filename?: string;
  dryRun: boolean;
  port?: number;
  targetPort?: PortRef;
  type?: ServiceType;
  name?: string;
  tcp: string[];
  literals: string[];
  overwrite: boolean;
  revision?: number;
  toRevision?: number;
  /** logs -c */
  container?: string;
  previous: boolean;
  tail?: number;
  fieldSelector?: string;
  /** create quota --hard */
  hard?: string;
  force: boolean;
  ignoreDaemonsets: boolean;
  deleteEmptydirData: boolean;
  /** Words after `--` (exec, create job, create cronjob). */
  command?: string[];
  /** create cronjob --schedule */
  schedule?: string;
  /** create job --from=cronjob/<name> */
  from?: string;
  /** patch -p */
  patch?: string;
};

export function selects(labels: Labels, reqs: Requirement[]): boolean {
  return reqs.every(({ key, op, values }) => {
    const has = Object.hasOwn(labels, key);
    if (op === "=") return has && labels[key] === values[0];
    if (op === "!=") return !has || labels[key] !== values[0];
    if (op === "exists") return has;
    if (op === "!exists") return !has;
    if (op === "in") return has && values.includes(labels[key]);
    return !has || !values.includes(labels[key]);
  });
}

export function age(c: Cluster, createdAt: number): string {
  const s = c.clock - createdAt;
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function table(rows: string[][]): string {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((cell, i) => cell.padEnd(widths[i])).join("   ").trimEnd()).join("\n");
}

export const labelText = (labels: Labels) =>
  Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(",") || "<none>";

export const annotationText = (annotations: Labels) =>
  Object.entries(annotations).map(([k, v]) => `${k}: ${v}`).join("\n                ") || "<none>";

export const pad = (pairs: [string, string | undefined][]) =>
  pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `${(k + ":").padEnd(Math.max(16, k.length + 3))}${v}`.trimEnd()).join("\n");

/** "5s", or "5s (x3 over 20s)" for a repeated event, as describe and get events show it. */
export const eventAge = (c: Cluster, e: ClusterEvent) =>
  e.count > 1 ? `${age(c, e.lastSeen)} (x${e.count} over ${age(c, e.firstSeen)})` : age(c, e.lastSeen);

/** The Events section that ends describe output. */
export function eventsSection(c: Cluster, events: ClusterEvent[]): string {
  if (!events.length) return "Events:         <none>";
  const rows = events.map((e) => [e.type, e.reason, eventAge(c, e), e.source, e.message]);
  const all = [["Type", "Reason", "Age", "From", "Message"], ["----", "------", "----", "----", "-------"], ...rows];
  return `Events:\n${table(all).replace(/^/gm, "  ")}`;
}
