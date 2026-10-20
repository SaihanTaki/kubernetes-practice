import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, find, list, run, type Cluster, type Fixture } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const wait = (c: Cluster, n: number) => exec(c, ...Array(n).fill("kubectl get pods")).c;

const pod = (command: string, restartPolicy?: string, image = "busybox:1.36") => `apiVersion: v1
kind: Pod
metadata:
  name: task
spec:${restartPolicy ? `\n  restartPolicy: ${restartPolicy}` : ""}
  containers:
    - name: task
      image: ${image}
      command: ${command}
`;

const job = (opts: { completions?: number; parallelism?: number; backoffLimit?: number; command?: string; restartPolicy?: string; extra?: string } = {}) => `apiVersion: batch/v1
kind: Job
metadata:
  name: report
spec:
  completions: ${opts.completions ?? 1}
  parallelism: ${opts.parallelism ?? 1}
  backoffLimit: ${opts.backoffLimit ?? 6}${opts.extra ?? ""}
  template:
    spec:
      restartPolicy: ${opts.restartPolicy ?? "Never"}
      containers:
        - name: report
          image: busybox:1.36
          command: ${opts.command ?? `["sh", "-c", "echo done"]`}
`;

const cronjob = (schedule: string, extra = "") => `apiVersion: batch/v1
kind: CronJob
metadata:
  name: tick
spec:
  schedule: "${schedule}"${extra}
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: tick
              image: busybox:1.36
              command: ["sh", "-c", "echo tick"]
`;

const files = (text: string, extra: Fixture = {}) => createCluster({ files: { "x.yaml": text }, ...extra });
const applied = (text: string) => exec(files(text), "kubectl apply -f x.yaml");
const podStatus = (c: Cluster) => find(c, "Pod", "default", "task")!;

describe("run-to-completion containers", () => {
  it("runs a busybox command once: Running, then Completed with its echo output as logs", () => {
    let { c } = applied(pod(`["sh", "-c", "echo 'hello world'; echo bye"]`, "Never"));
    c = wait(c, 1);
    expect(podStatus(c).status).toBe("Running");
    const r = exec(c, "kubectl get pods", "kubectl get pods");
    expect(r.output).toMatch(/task\s+0\/1\s+Completed\s+0/);
    expect(exec(r.c, "kubectl logs task").output).toBe("hello world\nbye");
  });

  it("fails on exit <n> or false, and keeps running on sleep", () => {
    expect(podStatus(wait(applied(pod(`["sh", "-c", "exit 2"]`, "Never")).c, 2)).status).toBe("Error");
    expect(podStatus(wait(applied(pod(`["false"]`, "Never")).c, 2)).status).toBe("Error");
    expect(podStatus(wait(applied(pod(`["sh", "-c", "false && echo no"]`, "Never")).c, 2)).status).toBe("Error");
    expect(podStatus(wait(applied(pod(`["sh", "-c", "false || echo yes"]`, "Never")).c, 2)).status).toBe("Completed");
    expect(podStatus(wait(applied(pod(`["sleep", "3600"]`, "Never")).c, 5)).status).toBe("Running");
    expect(podStatus(wait(applied(pod(`["perl", "-Mbignum=bpi", "-wle", "print bpi(5)"]`, "Never", "perl:5.34")).c, 2)).status).toBe("Completed");
  });

  it("restarts by restartPolicy: Always restarts any exit, OnFailure only failures, Never none", () => {
    const always = podStatus(wait(applied(pod(`["echo", "hi"]`)).c, 3));
    expect(always).toMatchObject({ status: "CrashLoopBackOff", restarts: 2 });
    expect(podStatus(wait(applied(pod(`["echo", "hi"]`, "OnFailure")).c, 3))).toMatchObject({ status: "Completed", restarts: 0 });
    const onFailure = wait(applied(pod(`["sh", "-c", "exit 1"]`, "OnFailure")).c, 3);
    expect(podStatus(onFailure)).toMatchObject({ status: "CrashLoopBackOff", restarts: 2 });
    expect(exec(onFailure, "kubectl describe pod task").output).toMatch(/Last State:\s+Terminated\n\s+Reason:\s+Error\n\s+Exit Code:\s+1/);
  });

  it("leaves busybox without a command and other images serving", () => {
    expect(podStatus(wait(applied(pod(`["echo", "hi"]`, "Never", "nginx:1.27")).c, 3)).status).toBe("Running");
  });

  it("frees quota once finished", () => {
    let c = exec(createCluster(), "kubectl create quota q --hard=pods=1").c;
    c.files["x.yaml"] = pod(`["echo", "hi"]`, "Never");
    c = wait(exec(c, "kubectl apply -f x.yaml").c, 2);
    expect(exec(c, "kubectl run other --image=nginx").error).toBe(false);
  });
});

describe("Job", () => {
  it("runs parallelism Pods until completions succeed, labelled job-name", () => {
    const created = applied(job({ completions: 3, parallelism: 2 }));
    expect(created.output).toBe("job.batch/report created");
    let c = created.c;
    expect(list(c, "Pod")).toHaveLength(2);
    expect(list(c, "Pod").every((p) => p.metadata.labels["job-name"] === "report" && /^report-[a-z0-9]{5}$/.test(p.metadata.name))).toBe(true);
    c = wait(c, 2);
    expect(exec(c, "kubectl get jobs").output).toMatch(/^NAME\s+STATUS\s+COMPLETIONS\s+DURATION\s+AGE\nreport\s+Running\s+2\/3\s+/);
    c = wait(c, 2);
    const r = exec(c, "kubectl get jobs");
    expect(r.output).toMatch(/report\s+Complete\s+3\/3\s+\d+s\s+\d+s/);
    expect(list(r.c, "Pod")).toHaveLength(3);
    expect(check(r.c, { kind: "job-status", jobName: "report", expectedValue: "Complete" })).toBe(true);
    expect(check(r.c, { kind: "job-succeeded", jobName: "report", expectedValue: 3 })).toBe(true);
    const d = exec(r.c, "kubectl describe job report").output;
    expect(d).toMatch(/Parallelism:\s+2\nCompletions:\s+3/);
    expect(d).toMatch(/Pods Statuses:\s+0 Active \(0 Ready\) \/ 3 Succeeded \/ 0 Failed/);
    expect(d).toMatch(/Normal\s+Completed\s+.*Job completed/);
  });

  it("fails with BackoffLimitExceeded once failures pass backoffLimit (Never: one Pod per attempt)", () => {
    let { c } = applied(job({ backoffLimit: 1, command: `["sh", "-c", "echo boom; exit 1"]` }));
    c = wait(c, 6);
    expect(check(c, { kind: "job-status", jobName: "report", expectedValue: "Failed" })).toBe(true);
    expect(list(c, "Pod").map((p) => p.status)).toEqual(["Error", "Error"]);
    expect(exec(c, "kubectl get jobs").output).toMatch(/report\s+Failed\s+0\/1/);
    expect(exec(c, "kubectl describe job report").output).toMatch(/Warning\s+BackoffLimitExceeded\s+.*Job has reached the specified backoff limit/);
    expect(exec(c, "kubectl logs job/report").output).toMatch(/boom$/);
    expect(exec(c, "kubectl get pods -l job-name=report").output.split("\n")).toHaveLength(3);
  });

  it("counts container restarts as failures with OnFailure", () => {
    const c = wait(applied(job({ backoffLimit: 2, restartPolicy: "OnFailure", command: `["false"]` })).c, 6);
    expect(check(c, { kind: "job-status", jobName: "report", expectedValue: "Failed" })).toBe(true);
    expect(list(c, "Pod")).toHaveLength(0);
  });

  it("fails with DeadlineExceeded after activeDeadlineSeconds", () => {
    const c = wait(applied(job({ command: `["sleep", "100"]`, extra: "\n  activeDeadlineSeconds: 10" })).c, 3);
    expect(find(c, "Job", "default", "report")!.finished).toMatchObject({ type: "Failed", reason: "DeadlineExceeded" });
    expect(list(c, "Pod")).toHaveLength(0);
  });

  it("requires restartPolicy Never or OnFailure and keeps the template immutable", () => {
    expect(applied(job({ restartPolicy: "Always" })).output).toBe(
      'The Job "report" is invalid: spec.template.spec.restartPolicy: Unsupported value: "Always": supported values: "OnFailure", "Never"',
    );
    expect(applied(job().replace("      restartPolicy: Never\n", "")).output).toBe(
      'The Job "report" is invalid: spec.template.spec.restartPolicy: Required value: valid values: "OnFailure", "Never"',
    );
    const r = applied(job());
    r.c.files["x.yaml"] = job({ command: `["echo", "changed"]` });
    expect(exec(r.c, "kubectl apply -f x.yaml").output).toMatch(/^The Job "report" is invalid: spec\.template: .*field is immutable$/);
    expect(exec(r.c, "kubectl delete job report").output).toBe('job.batch "report" deleted');
    expect(list(exec(r.c, "kubectl delete job report").c, "Pod")).toHaveLength(0);
  });

  it("creates Jobs from the command line", () => {
    let r = exec(createCluster(), "kubectl create job hello --image=busybox:1.36 -- echo hi there");
    expect(r.output).toBe("job.batch/hello created");
    const j = find(r.c, "Job", "default", "hello")!;
    expect(j.template).toMatchObject({ image: "busybox:1.36", container: { name: "hello", command: ["echo", "hi", "there"] }, spec: { restartPolicy: "Never" } });
    r = exec(r.c, "kubectl get pods", "kubectl get pods", "kubectl logs job/hello");
    expect(r.output).toBe("hi there");
    expect(exec(createCluster(), "kubectl create job x").output).toMatch(/--image/);
    expect(exec(createCluster(), "kubectl create deployment x --image=nginx -- echo").error).toBe(true);
    expect(exec(createCluster(), "kubectl get pods -- echo").error).toBe(true);
    expect(exec(createCluster(), "kubectl create job x --from=cronjob/nope").output).toBe('Error from server (NotFound): cronjobs.batch "nope" not found');
    expect(exec(createCluster(), "kubectl create job x --from=deploy/web").error).toBe(true);
    const dry = exec(createCluster(), "kubectl create job x --image=busybox --dry-run=client -o yaml").output;
    expect(dry).toMatch(/^apiVersion: batch\/v1\nkind: Job/);
  });
});

describe("CronJob", () => {
  it("never fires a nightly schedule during a lab (the clock starts at 10:00 UTC)", () => {
    const c = wait(applied(cronjob("0 3 * * *")).c, 30);
    expect(list(c, "Job")).toHaveLength(0);
    expect(exec(c, "kubectl get cronjobs").output).toMatch(/^NAME\s+SCHEDULE\s+TIMEZONE\s+SUSPEND\s+ACTIVE\s+LAST SCHEDULE\s+AGE\ntick\s+0 3 \* \* \*\s+<none>\s+False\s+0\s+<none>\s+/);
  });

  it("creates a Job <cronjob>-<minutes> each time the clock crosses a schedule time", () => {
    let c = applied(cronjob("* * * * *")).c;
    c = wait(c, 12);
    const jobs = list(c, "Job");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].metadata.name).toMatch(/^tick-\d{8}$/);
    expect(jobs[0].owner).toBe("tick");
    c = wait(c, 3);
    expect(exec(c, "kubectl get cj").output).toMatch(/tick\s+\* \* \* \* \*\s+<none>\s+False\s+0\s+\d+s/);
    expect(exec(c, "kubectl describe cj tick").output).toMatch(/Normal\s+SuccessfulCreate\s+.*Created job tick-\d+/);
  });

  it("keeps successfulJobsHistoryLimit finished Jobs", () => {
    const c = wait(applied(cronjob("* * * * *", "\n  successfulJobsHistoryLimit: 1")).c, 40);
    expect(list(c, "Job")).toHaveLength(1);
    expect(list(c, "Pod")).toHaveLength(1);
  });

  it("skips a run with Forbid while the last one is active", () => {
    const sleepy = cronjob("* * * * *", "\n  concurrencyPolicy: Forbid").replace(`"echo tick"`, `"sleep 1000"`);
    const c = wait(applied(sleepy).c, 30);
    expect(list(c, "Job")).toHaveLength(1);
    expect(exec(c, "kubectl describe cj tick").output).toMatch(/JobAlreadyActive/);
  });

  it("stops scheduling while suspended; patch flips it", () => {
    let r = applied(cronjob("* * * * *"));
    r = exec(r.c, `kubectl patch cronjob tick -p '{"spec":{"suspend":true}}'`);
    expect(r.output).toBe("cronjob.batch/tick patched");
    expect(check(r.c, { kind: "cronjob-suspended", cronJobName: "tick", expectedValue: true })).toBe(true);
    expect(exec(r.c, `kubectl patch cj tick -p '{"spec":{"suspend":true}}'`).output).toBe("cronjob.batch/tick patched (no change)");
    expect(list(wait(r.c, 15), "Job")).toHaveLength(0);
    expect(exec(r.c, "kubectl get cj").output).toMatch(/tick\s+\S+ \S+ \S+ \S+ \S+\s+<none>\s+True/);
    expect(exec(r.c, `kubectl patch cronjob tick -p '{"spec":{"schedule":"* * * * *"}}'`).output).toMatch(/only supports kubectl patch cronjob/);
    expect(exec(r.c, `kubectl patch deployment tick -p '{}'`).error).toBe(true);
    expect(exec(r.c, "kubectl patch cronjob tick -p 'nope'").output).toMatch(/must be JSON/);
    expect(exec(r.c, "kubectl patch cronjob tick").error).toBe(true);
  });

  it("starts a manual run with create job --from, even while suspended", () => {
    let r = applied(cronjob("0 3 * * *", "\n  suspend: true"));
    r = exec(r.c, "kubectl create job now --from=cronjob/tick");
    expect(r.output).toBe("job.batch/now created");
    const j = find(r.c, "Job", "default", "now")!;
    expect(j).toMatchObject({ owner: "tick", metadata: { annotations: { "cronjob.kubernetes.io/instantiate": "manual" } } });
    expect(check(wait(r.c, 2), { kind: "job-status", jobName: "now", expectedValue: "Complete" })).toBe(true);
  });

  it("validates schedules and time zones, and shows the time zone", () => {
    expect(applied(cronjob("61 * * * *")).output).toBe('The CronJob "tick" is invalid: spec.schedule: Invalid value: "61 * * * *": end of range (61) above maximum (59): 61');
    expect(applied(cronjob("* * *")).output).toMatch(/expected exactly 5 fields, found 3/);
    expect(applied(cronjob("TZ=UTC 0 3 * * *")).output).toMatch(/use timeZone field instead/);
    expect(applied(cronjob("0 3 * * *", "\n  timeZone: Mars/Base")).output).toBe('The CronJob "tick" is invalid: spec.timeZone: Invalid value: "Mars/Base": unknown time zone Mars/Base');
    expect(applied(cronjob("@daily")).error).toBe(false);
    expect(applied(cronjob("*/15 9-17 * jan-dec mon-fri")).error).toBe(false);
    const tz = applied(cronjob("30 2 * * *", "\n  timeZone: Europe/Berlin"));
    expect(exec(tz.c, "kubectl get cj").output).toMatch(/tick\s+30 2 \* \* \*\s+Europe\/Berlin\s+False/);
  });

  it("fires in its time zone", () => {
    // 10:00 UTC is 11:00 in Berlin in January.
    const c = wait(applied(cronjob("1 11 * * *", "\n  timeZone: Europe/Berlin")).c, 13);
    expect(list(c, "Job")).toHaveLength(1);
  });

  it("creates CronJobs from the command line", () => {
    const r = exec(createCluster(), "kubectl create cronjob nightly --image=busybox:1.36 --schedule='0 2 * * *' -- echo hi");
    expect(r.output).toBe("cronjob.batch/nightly created");
    expect(find(r.c, "CronJob", "default", "nightly")!.jobTemplate.template).toMatchObject({ container: { name: "nightly", command: ["echo", "hi"] }, spec: { restartPolicy: "OnFailure" } });
    expect(exec(createCluster(), "kubectl create cronjob x --image=busybox").output).toMatch(/--schedule/);
    expect(exec(createCluster(), "kubectl create cronjob x --image=busybox --schedule='bad'").error).toBe(true);
    expect(exec(createCluster(), "kubectl create deployment x --image=nginx --schedule='* * * * *'").error).toBe(true);
  });

  it("deletes its Jobs and their Pods with it", () => {
    const c = wait(applied(cronjob("* * * * *")).c, 13);
    expect(list(c, "Job")).toHaveLength(1);
    const r = exec(c, "kubectl delete cronjob tick");
    expect(r.output).toBe('cronjob.batch "tick" deleted');
    expect(list(r.c, "Job")).toHaveLength(0);
    expect(list(r.c, "Pod")).toHaveLength(0);
  });
});
