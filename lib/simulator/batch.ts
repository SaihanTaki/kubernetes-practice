import { age, annotationText, labelText, pad } from "./cli";
import { find, isFinished, list, meta, podsOfOwner, removeResource, spawnPod, suffix } from "./cluster";
import { recordEvent } from "./events";
import { timestamp, wallTime } from "./images";
import { podTemplateLines } from "./podtext";
import type { Cluster, CronJob, Job, JobSpec, Labels, PodTemplate } from "./types";

const JOB_CONTROLLER = "job-controller";
const CRONJOB_CONTROLLER = "cronjob-controller";

// --- Cron schedules ---

type Field = { min: number; max: number; names?: string[] };

const FIELDS: Field[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] },
  // 7 is Sunday too.
  { min: 0, max: 7, names: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] },
];

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

type Cron = { sets: Set<number>[]; anyDay: boolean };

class CronError extends Error {}

function parseField(text: string, f: Field): Set<number> | string {
  const out = new Set<number>();
  const value = (v: string) => {
    const named = f.names?.indexOf(v.toLowerCase()) ?? -1;
    if (named !== -1) return named + (f.min === 1 ? 1 : 0);
    if (/^\d+$/.test(v)) return Number(v);
    throw new CronError(`failed to parse int from ${v}: strconv.Atoi: parsing "${v}": invalid syntax`);
  };
  try {
    for (const part of text.split(",")) {
      const [range, stepText, extra] = part.split("/");
      if (extra !== undefined) return `too many slashes: ${part}`;
      const step = stepText === undefined ? 1 : value(stepText);
      if (step < 1) return `step of range should be a positive number: ${part}`;
      const [a, b, more] = range.split("-");
      if (more !== undefined) return `too many hyphens: ${part}`;
      const star = a === "*" || a === "?";
      const lo = star ? f.min : value(a);
      const hi = star ? f.max : b !== undefined ? value(b) : stepText !== undefined ? f.max : lo;
      if (lo < f.min) return `beginning of range (${lo}) below minimum (${f.min}): ${part}`;
      if (hi > f.max) return `end of range (${hi}) above maximum (${f.max}): ${part}`;
      if (lo > hi) return `beginning of range (${lo}) beyond end of range (${hi}): ${part}`;
      for (let v = lo; v <= hi; v += step) out.add(f.max === 7 && v === 7 ? 0 : v);
    }
  } catch (e) {
    if (e instanceof CronError) return e.message;
    throw e;
  }
  return out;
}

/** A 5-field schedule (or @daily-style macro), or the error message the API server gives. */
export function parseCron(expr: string): Cron | string {
  if (/^(CRON_)?TZ=/.test(expr.trim())) return "cannot use TZ or CRON_TZ in schedule, use timeZone field instead";
  const parts = (MACROS[expr.trim()] ?? expr).trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return `expected exactly 5 fields, found ${parts.length}: ${expr}`;
  const sets: Set<number>[] = [];
  for (const [i, part] of parts.entries()) {
    const set = parseField(part, FIELDS[i]);
    if (typeof set === "string") return set;
    sets.push(set);
  }
  return { sets, anyDay: parts[2].startsWith("*") || parts[4].startsWith("*") };
}

export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Minute, hour, day of month, month, day of week of a moment in the time zone. */
function wallFields(date: Date, tz?: string): number[] {
  if (!tz) return [date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay()];
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", minute: "numeric", hour: "numeric", day: "numeric", month: "numeric", weekday: "short" });
  const part = (type: string) => fmt.formatToParts(date).find((p) => p.type === type)!.value;
  return [Number(part("minute")), Number(part("hour")), Number(part("day")), Number(part("month")), WEEKDAYS.indexOf(part("weekday"))];
}

function cronMatches(cron: Cron, fields: number[]): boolean {
  const [minute, hour, day, month, weekday] = fields;
  const [mins, hours, days, months, weekdays] = cron.sets;
  const dom = days.has(day);
  const dow = weekdays.has(weekday);
  return mins.has(minute) && hours.has(hour) && months.has(month) && (cron.anyDay ? dom && dow : dom || dow);
}

/** The latest schedule time in (from, to], as a clock value. Looks back at most one day, like a missed-start limit. */
function lastDue(cj: CronJob, from: number, to: number): number | undefined {
  const cron = parseCron(cj.schedule);
  if (typeof cron === "string") return undefined;
  const first = Math.max(Math.floor(from / 60) + 1, Math.floor(to / 60) - 24 * 60);
  for (let m = Math.floor(to / 60); m >= first; m--) {
    if (cronMatches(cron, wallFields(wallTime(m * 60), cj.timeZone))) return m * 60;
  }
  return undefined;
}

// --- Jobs ---

export const jobLabels = (name: string): Labels => ({ "batch.kubernetes.io/job-name": name, "job-name": name });

/** A Job object; its Pod template gets the job-name labels, as the API server adds them. */
export function newJob(c: Cluster, name: string, namespace: string, spec: JobSpec, labels: Labels = {}, annotations: Labels = {}, owner?: string): Job {
  const template: PodTemplate = structuredClone(spec.template);
  template.labels = { ...template.labels, ...jobLabels(name) };
  return { ...structuredClone(spec), kind: "Job", metadata: meta(c, name, namespace, labels, annotations), template, ...(owner && { owner }) };
}

const jobPods = (c: Cluster, j: Job) => podsOfOwner(c, "Job", j.metadata.namespace, j.metadata.name) ?? [];

/** Succeeded and failed attempts; a failed attempt is an Error Pod (Never) or a container restart (OnFailure). */
export function jobCounts(c: Cluster, j: Job) {
  const pods = jobPods(c, j);
  const active = pods.filter((p) => !isFinished(p));
  if (j.finished) return { succeeded: j.finished.succeeded, failed: j.finished.failed, active: 0, ready: 0 };
  return {
    succeeded: pods.filter((p) => p.status === "Completed").length,
    failed: pods.filter((p) => p.status === "Error").length + pods.reduce((n, p) => n + p.restarts, 0),
    active: active.length,
    ready: active.filter((p) => p.status === "Running" && p.ready).length,
  };
}

export const jobStatus = (j: Job) => j.finished?.type ?? "Running";

// shortcut: no back-off delay between failed attempts and no ttlSecondsAfterFinished clean-up; both are shown only.
export function reconcileJob(c: Cluster, j: Job) {
  if (j.finished) return;
  const { succeeded, failed } = jobCounts(c, j);
  const active = jobPods(c, j).filter((p) => !isFinished(p));
  const finish = (type: "Complete" | "Failed", reason?: string, message?: string) => {
    j.finished = { type, reason, message, at: c.clock, succeeded, failed };
    for (const p of active) {
      removeResource(c, p);
      recordEvent(c, j, "Normal", "SuccessfulDelete", `Deleted pod: ${p.metadata.name}`, JOB_CONTROLLER);
    }
    if (type === "Complete") recordEvent(c, j, "Normal", "Completed", "Job completed", JOB_CONTROLLER);
    else recordEvent(c, j, "Warning", reason!, message!, JOB_CONTROLLER);
  };
  if (succeeded >= j.completions) return finish("Complete");
  if (failed > j.backoffLimit) return finish("Failed", "BackoffLimitExceeded", "Job has reached the specified backoff limit");
  if (j.activeDeadlineSeconds !== undefined && c.clock - j.metadata.createdAt >= j.activeDeadlineSeconds) {
    return finish("Failed", "DeadlineExceeded", "Job was active longer than specified deadline");
  }
  const wanted = Math.min(j.parallelism, j.completions - succeeded);
  for (let n = active.length; n < wanted && spawnPod(c, j, `${j.metadata.name}-${suffix(c.seq, 5)}`, j.template, JOB_CONTROLLER); n++);
}

// --- CronJobs ---

export const jobsOf = (c: Cluster, cj: CronJob) => list(c, "Job", cj.metadata.namespace).filter((j) => j.owner === cj.metadata.name);

/** Job name for a run: the CronJob name plus the scheduled time in minutes since the epoch. */
const runName = (cj: CronJob, due: number) => `${cj.metadata.name}-${Math.floor(wallTime(due).getTime() / 60000)}`;

function startRun(c: Cluster, cj: CronJob, due: number) {
  const ns = cj.metadata.namespace;
  const active = jobsOf(c, cj).filter((j) => !j.finished);
  if (active.length && cj.concurrencyPolicy === "Forbid") {
    recordEvent(c, cj, "Normal", "JobAlreadyActive", "Not starting job because prior execution is running and concurrency policy is Forbid", CRONJOB_CONTROLLER);
    return;
  }
  if (cj.concurrencyPolicy === "Replace") {
    for (const j of active) {
      removeResource(c, j);
      recordEvent(c, cj, "Normal", "SuccessfulDelete", `Deleted job ${j.metadata.name}`, CRONJOB_CONTROLLER);
    }
  }
  const name = runName(cj, due);
  if (find(c, "Job", ns, name)) return;
  c.resources.push(newJob(c, name, ns, cj.jobTemplate, {}, {}, cj.metadata.name));
  cj.lastScheduleTime = due;
  recordEvent(c, cj, "Normal", "SuccessfulCreate", `Created job ${name}`, CRONJOB_CONTROLLER);
}

function trimHistory(c: Cluster, cj: CronJob) {
  const limits = [["Complete", cj.successfulJobsHistoryLimit], ["Failed", cj.failedJobsHistoryLimit]] as const;
  for (const [type, limit] of limits) {
    const done = jobsOf(c, cj)
      .filter((j) => j.finished?.type === type)
      .sort((a, b) => b.metadata.createdAt - a.metadata.createdAt || Number(b.metadata.uid) - Number(a.metadata.uid));
    for (const j of done.slice(limit)) {
      removeResource(c, j);
      recordEvent(c, cj, "Normal", "SuccessfulDelete", `Deleted job ${j.metadata.name}`, CRONJOB_CONTROLLER);
    }
  }
}

// shortcut: no startingDeadlineSeconds; runs missed while suspended are skipped, not started on resume.
export function reconcileCronJob(c: Cluster, cj: CronJob) {
  const due = lastDue(cj, cj.checkedAt, c.clock);
  cj.checkedAt = c.clock;
  if (due !== undefined && !cj.suspend) startRun(c, cj, due);
  trimHistory(c, cj);
}

// --- Output ---

export const JOB_HEADER = ["NAME", "STATUS", "COMPLETIONS", "DURATION", "AGE"];
export const CRONJOB_HEADER = ["NAME", "SCHEDULE", "TIMEZONE", "SUSPEND", "ACTIVE", "LAST SCHEDULE", "AGE"];

/** Like kubectl's duration column: 45s, 2m30s, 12m, 3h. */
function duration(s: number): string {
  if (s < 120) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 10) return s % 60 ? `${m}m${s % 60}s` : `${m}m`;
  if (m < 180) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

const jobSelector = (j: Job) => labelText({ "batch.kubernetes.io/job-name": j.metadata.name });

export function jobRow(c: Cluster, j: Job, wide: boolean): string[] {
  const { succeeded } = jobCounts(c, j);
  const end = j.finished?.at ?? c.clock;
  const row = [j.metadata.name, jobStatus(j), `${succeeded}/${j.completions}`, duration(end - j.metadata.createdAt), age(c, j.metadata.createdAt)];
  return wide ? [...row, j.template.container.name, j.template.image, jobSelector(j)] : row;
}

export function cronJobRow(c: Cluster, cj: CronJob, wide: boolean): string[] {
  const active = jobsOf(c, cj).filter((j) => !j.finished).length;
  const last = cj.lastScheduleTime === undefined ? "<none>" : age(c, cj.lastScheduleTime);
  const row = [cj.metadata.name, cj.schedule, cj.timeZone ?? "<none>", cj.suspend ? "True" : "False", String(active), last, age(c, cj.metadata.createdAt)];
  return wide ? [...row, cj.jobTemplate.template.container.name, cj.jobTemplate.template.image, "<none>"] : row;
}

const jobSpecYaml = (s: JobSpec) => ({
  completions: s.completions,
  parallelism: s.parallelism,
  backoffLimit: s.backoffLimit,
  activeDeadlineSeconds: s.activeDeadlineSeconds,
  ttlSecondsAfterFinished: s.ttlSecondsAfterFinished,
});

export function jobManifest(c: Cluster, j: Job, metadata: Record<string, unknown>, template: object, live: boolean) {
  const { succeeded, failed, active } = jobCounts(c, j);
  const condition = j.finished && { type: j.finished.type, status: "True", reason: j.finished.reason, message: j.finished.message };
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata,
    spec: { ...jobSpecYaml(j), template },
    ...(live && {
      status: {
        startTime: timestamp(j.metadata.createdAt),
        completionTime: j.finished?.type === "Complete" ? timestamp(j.finished.at) : undefined,
        active: active || undefined,
        succeeded: succeeded || undefined,
        failed: failed || undefined,
        conditions: condition ? [condition] : undefined,
      },
    }),
  };
}

export function cronJobManifest(cj: CronJob, metadata: Record<string, unknown>, template: object, live: boolean) {
  return {
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata,
    spec: {
      schedule: cj.schedule,
      timeZone: cj.timeZone,
      suspend: cj.suspend,
      concurrencyPolicy: cj.concurrencyPolicy,
      successfulJobsHistoryLimit: cj.successfulJobsHistoryLimit,
      failedJobsHistoryLimit: cj.failedJobsHistoryLimit,
      jobTemplate: { spec: { ...jobSpecYaml(cj.jobTemplate), template } },
    },
    ...(live && { status: cj.lastScheduleTime === undefined ? {} : { lastScheduleTime: timestamp(cj.lastScheduleTime) } }),
  };
}

const head = (r: Job | CronJob): [string, string][] => [
  ["Name", r.metadata.name],
  ["Namespace", r.metadata.namespace],
  ["Labels", labelText(r.metadata.labels)],
  ["Annotations", annotationText(r.metadata.annotations)],
];

export function describeJob(c: Cluster, j: Job): string {
  const { succeeded, failed, active, ready } = jobCounts(c, j);
  return [
    pad([
      ["Name", j.metadata.name],
      ["Namespace", j.metadata.namespace],
      ["Selector", jobSelector(j)],
      ...head(j).slice(2),
      ["Controlled By", j.owner ? `CronJob/${j.owner}` : undefined],
      ["Parallelism", String(j.parallelism)],
      ["Completions", String(j.completions)],
      ["Completion Mode", "NonIndexed"],
      ["Suspend", "false"],
      ["Backoff Limit", String(j.backoffLimit)],
      ["Active Deadline Seconds", j.activeDeadlineSeconds === undefined ? undefined : `${j.activeDeadlineSeconds}s`],
      ["TTL Seconds After Finished", j.ttlSecondsAfterFinished === undefined ? undefined : String(j.ttlSecondsAfterFinished)],
      ["Start Time", timestamp(j.metadata.createdAt)],
      ["Completed At", j.finished?.type === "Complete" ? timestamp(j.finished.at) : undefined],
      ["Duration", j.finished ? duration(j.finished.at - j.metadata.createdAt) : undefined],
      ["Pods Statuses", `${active} Active (${ready} Ready) / ${succeeded} Succeeded / ${failed} Failed`],
    ]),
    "Pod Template:",
    ...podTemplateLines(j.template),
  ].join("\n");
}

export function describeCronJob(c: Cluster, cj: CronJob): string {
  const t = cj.jobTemplate;
  const active = jobsOf(c, cj).filter((j) => !j.finished).map((j) => j.metadata.name);
  return [
    pad([
      ...head(cj),
      ["Schedule", cj.schedule],
      ["TimeZone", cj.timeZone],
      ["Concurrency Policy", cj.concurrencyPolicy],
      ["Suspend", cj.suspend ? "True" : "False"],
      ["Successful Job History Limit", String(cj.successfulJobsHistoryLimit)],
      ["Failed Job History Limit", String(cj.failedJobsHistoryLimit)],
      ["Starting Deadline Seconds", "<unset>"],
      ["Selector", "<unset>"],
      ["Parallelism", String(t.parallelism)],
      ["Completions", String(t.completions)],
      ["Backoff Limit", String(t.backoffLimit)],
    ]),
    "Pod Template:",
    ...podTemplateLines(t.template),
    pad([
      ["Last Schedule Time", cj.lastScheduleTime === undefined ? "<unset>" : timestamp(cj.lastScheduleTime)],
      ["Active Jobs", active.join(", ") || "<none>"],
    ]),
  ].join("\n");
}
