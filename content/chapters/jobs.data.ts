import type { ChapterData } from "../types";
import { quiz } from "./jobs.quiz";

const brokenReport = `apiVersion: batch/v1
kind: Job
metadata:
  name: report
spec:
  completions: 3
  parallelism: 3
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: report
          image: busybox:1.36
          command: ["sh", "-c", "echo 'error: report step not implemented'; exit 1"]`;

const cleanup = `apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup
spec:
  schedule: "0 3 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: busybox:1.36
              command: ["sh", "-c", "echo 'removed expired sessions'"]`;

export const data: ChapterData = {
  objectives: [
    "Explain why batch work belongs in a Job and not a Deployment.",
    "Set completions, parallelism, backoffLimit, and the time limits on a Job, and choose between restartPolicy Never and OnFailure.",
    "Find a failed Job's Pods by the job-name label and read their logs.",
    "Write a CronJob schedule, control overlapping runs, suspend it, and start a run by hand.",
  ],
  quiz,
  manifests: [
    {
      id: "job",
      title: "resize-images-job.yaml",
      yaml: `apiVersion: batch/v1
kind: Job
metadata:
  name: resize-images
spec:
  completions: 4
  parallelism: 2
  backoffLimit: 3
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: resize
          image: busybox:1.36
          command: ["sh", "-c", "echo 'resized one batch of images'"]`,
      notes: [
        { line: 1, text: "Jobs and CronJobs belong to the batch API group, version v1." },
        { line: 4, text: "Each Pod is named resize-images-<suffix> and labelled job-name=resize-images." },
        { line: 6, text: "The Job is Complete once 4 Pods have exited with code 0. Default 1." },
        { line: 7, text: "At most 2 Pods run at once. Default 1. The Job never runs more Pods than it still needs." },
        { line: 8, text: "After 3 failed attempts the next failure marks the Job Failed with reason BackoffLimitExceeded. Default 6." },
        { line: 9, text: "Hard time limit for the whole Job: after 600 seconds running Pods are stopped and the Job fails with DeadlineExceeded." },
        { line: 10, text: "Delete the Job and its Pods one hour after it finishes, whether it succeeded or failed." },
        { line: 11, text: "An ordinary Pod template. It cannot be changed after the Job is created; delete and re-create the Job instead." },
        { line: 13, text: "Never or OnFailure. Never keeps each failed Pod and its logs; Always is rejected." },
        { line: 17, text: "The work itself. Exit code 0 counts as a success, anything else as a failure." },
      ],
    },
    {
      id: "cronjob",
      title: "nightly-report-cronjob.yaml",
      yaml: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "30 2 * * *"
  timeZone: Europe/Berlin
  concurrencyPolicy: Forbid
  suspend: false
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 1800
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: busybox:1.36
              command: ["sh", "-c", "echo 'report for yesterday written'"]`,
      notes: [
        { line: 2, text: "A CronJob creates Jobs. It never creates Pods directly." },
        { line: 4, text: "Jobs are named nightly-report-<scheduled time in minutes>, so each run is easy to find." },
        { line: 6, text: "Minute, hour, day of month, month, day of week: 02:30 every day. Quote it so YAML does not read * as an alias." },
        { line: 7, text: "Without timeZone the schedule uses the controller manager's time zone, usually UTC." },
        { line: 8, text: "If last night's Job is still running at 02:30, skip tonight's run. Allow (default) would run both; Replace would stop the old one." },
        { line: 9, text: "true stops new runs without deleting anything. kubectl patch is the quick way to flip it." },
        { line: 10, text: "Keep the last 3 successful Jobs and their Pods for inspection. Default 3." },
        { line: 11, text: "Keep only the last failed Job. Default 1." },
        { line: 12, text: "The template for each Job. Its spec takes the same fields as a Job's spec." },
        { line: 15, text: "A run that takes longer than 30 minutes is stopped and marked Failed." },
        { line: 18, text: "OnFailure restarts the container in the same Pod, so retries do not pile up Pods." },
      ],
    },
  ],
  labs: [
    {
      id: "jobs-fix-and-trigger",
      title: "Fix a failing Job and trigger a CronJob",
      difficulty: "intermediate",
      scenario:
        "report.yaml defines the report Job: 3 completions, backoffLimit 2, restartPolicy Never. It was just applied and its Pods keep failing. The cleanup CronJob from cleanup.yaml runs every night at 03:00, and you need to pause it and run it once now.",
      instructions: [
        "Run kubectl get jobs and kubectl get pods a few times until the report Job shows Failed.",
        "Run kubectl describe job report to see the reason, then list its Pods with kubectl get pods -l job-name=report.",
        "Read the logs of one failed Pod with kubectl logs <pod> or kubectl logs job/report.",
        "Edit report.yaml in the Files panel: change the command so it prints report written and exits 0 (remove the exit 1).",
        "A Job's template cannot be changed in place. Delete the report Job, apply report.yaml again, and run kubectl get pods until all 3 Pods are Completed.",
        "Suspend the cleanup CronJob with kubectl patch.",
        "Start one run of cleanup now with kubectl create job cleanup-manual --from=cronjob/cleanup and watch it complete.",
      ],
      fixture: { files: { "report.yaml": brokenReport, "cleanup.yaml": cleanup }, apply: ["report.yaml", "cleanup.yaml"] },
      objectives: [
        {
          id: "report-complete",
          description: "The report Job is Complete.",
          validator: { kind: "job-status", jobName: "report", expectedValue: "Complete" },
        },
        {
          id: "report-succeeded",
          description: "3 report Pods succeeded.",
          validator: { kind: "job-succeeded", jobName: "report", expectedValue: 3 },
        },
        {
          id: "cleanup-suspended",
          description: "The cleanup CronJob is suspended.",
          validator: { kind: "cronjob-suspended", cronJobName: "cleanup", expectedValue: true },
        },
        {
          id: "cleanup-manual",
          description: "A cleanup-manual Job made from the CronJob is Complete.",
          validator: { kind: "job-status", jobName: "cleanup-manual", expectedValue: "Complete" },
        },
      ],
      hints: [
        "With restartPolicy Never every failed attempt is its own Pod in Error status, and its logs stay readable.",
        "The logs say error: report step not implemented, and the command ends in exit 1. That exit code is what fails the Pod.",
        "Change the command line to: command: [\"sh\", \"-c\", \"echo 'report written'\"]",
        "kubectl apply on the existing Job fails because spec.template is immutable. Run kubectl delete job report first, then kubectl apply -f report.yaml.",
        "kubectl patch cronjob cleanup -p '{\"spec\":{\"suspend\":true}}' pauses the schedule. kubectl create job cleanup-manual --from=cronjob/cleanup still works while it is suspended.",
      ],
      solutionFiles: {
        "report.yaml": brokenReport.replace(
          `"echo 'error: report step not implemented'; exit 1"`,
          `"echo 'report written'"`,
        ),
      },
      solution: [
        "kubectl delete job report",
        "kubectl apply -f report.yaml",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get jobs",
        "kubectl patch cronjob cleanup -p '{\"spec\":{\"suspend\":true}}'",
        "kubectl create job cleanup-manual --from=cronjob/cleanup",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get jobs",
      ],
    },
  ],
  diagrams: [
    {
      id: "job-progress",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-0",
            label: "Job created",
            sub: "0/4 succeeded",
            detail: "parallelism: 2 and completions: 4, restartPolicy: Never. The Job starts two Pods at once.",
            children: [
              { id: "s0-a", label: "Pod a", sub: "Running", detail: "Labelled job-name=resize-images like every Pod of this Job." },
              { id: "s0-b", label: "Pod b", sub: "Running", detail: "Runs at the same time as Pod a because parallelism is 2." },
            ],
          },
          {
            id: "stage-1",
            label: "Pod a succeeds",
            sub: "1/4 succeeded",
            detail: "Pod a exited with code 0. 3 completions are still needed, so the Job starts Pod c to keep 2 running.",
            children: [
              { id: "s1-a", label: "Pod a", sub: "Completed", detail: "Finished Pods are kept so you can read their logs." },
              { id: "s1-b", label: "Pod b", sub: "Running", detail: "Still working." },
              { id: "s1-c", label: "Pod c", sub: "Running", detail: "Started to take Pod a's slot." },
            ],
          },
          {
            id: "stage-2",
            label: "Pod c fails",
            sub: "1/4 succeeded, 1 failed",
            detail: "Pod c exited non-zero. With Never it stays as Error and counts 1 against backoffLimit. The Job starts Pod d after a back-off delay.",
            children: [
              { id: "s2-b", label: "Pod b", sub: "Running", detail: "Unaffected by Pod c's failure." },
              { id: "s2-c", label: "Pod c", sub: "Error", detail: "Kept with its logs. kubectl logs on it shows why it failed." },
              { id: "s2-d", label: "Pod d", sub: "Running", detail: "A new Pod from the same template, not a restart of Pod c." },
            ],
          },
          {
            id: "stage-3",
            label: "Two more succeed",
            sub: "3/4 succeeded",
            detail: "Pods b and d succeeded. Only 1 completion is left, so the Job runs 1 Pod, not 2.",
            children: [
              { id: "s3-done", label: "Pods a, b, d", sub: "Completed", detail: "Three successes so far." },
              { id: "s3-e", label: "Pod e", sub: "Running", detail: "The last Pod the Job needs." },
            ],
          },
          {
            id: "stage-4",
            label: "Job Complete",
            sub: "4/4 succeeded",
            detail: "The fourth success finishes the Job. No more Pods are created. ttlSecondsAfterFinished, if set, starts counting now.",
            children: [
              { id: "s4-done", label: "Pods a, b, d, e", sub: "Completed", detail: "Kept until the Job is deleted." },
              { id: "s4-c", label: "Pod c", sub: "Error", detail: "The failure stays visible but did not stop the Job, because 1 is below backoffLimit." },
            ],
          },
        ],
      },
      steps: [
        { title: "Start", text: "The Job starts parallelism: 2 Pods.", highlight: ["stage-0", "s0-a", "s0-b"] },
        { title: "First success", text: "Pod a exits 0. The Job starts Pod c so two Pods keep running.", highlight: ["stage-1", "s1-a", "s1-c"] },
        { title: "A failure", text: "Pod c exits 1. It stays as Error, counts toward backoffLimit, and Pod d replaces it.", highlight: ["stage-2", "s2-c", "s2-d"] },
        { title: "Almost done", text: "Three successes. Only one is still needed, so only one Pod runs.", highlight: ["stage-3", "s3-done", "s3-e"] },
        { title: "Complete", text: "Four successes: the Job is Complete and creates no more Pods.", highlight: ["stage-4", "s4-done"] },
      ],
    },
    {
      id: "cronjob-ownership",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "cronjob",
            label: "CronJob nightly-report",
            sub: "schedule 30 2 * * *",
            detail: "Holds the schedule and a Job template. At each schedule time it creates a Job, unless it is suspended or concurrencyPolicy says to skip.",
          },
          {
            id: "jobs",
            label: "Jobs",
            sub: "one per run",
            detail: "Named after the CronJob plus the scheduled time in minutes. successfulJobsHistoryLimit and failedJobsHistoryLimit decide how many finished ones are kept.",
            children: [
              { id: "job-1", label: "nightly-report-29345250", sub: "Complete", detail: "Yesterday's run. Kept because of successfulJobsHistoryLimit." },
              { id: "job-2", label: "nightly-report-29346690", sub: "Running", detail: "Tonight's run. With concurrencyPolicy: Forbid no other run starts until it finishes." },
            ],
          },
          {
            id: "pods",
            label: "Pods",
            sub: "do the work",
            detail: "Each Job creates its own Pods, labelled job-name=<job>. Deleting a Job deletes its Pods.",
            children: [
              { id: "pod-1", label: "nightly-report-29345250-k8d2x", sub: "Completed", detail: "Belongs to yesterday's Job. kubectl logs still works on it." },
              { id: "pod-2", label: "nightly-report-29346690-p7qzn", sub: "Running", detail: "Belongs to tonight's Job." },
            ],
          },
        ],
      },
      steps: [
        { title: "The schedule fires", text: "At 02:30 the CronJob creates a Job from its jobTemplate.", highlight: ["cronjob", "job-2"] },
        { title: "The Job runs Pods", text: "The Job creates Pods and counts successes, exactly like a Job you applied yourself.", highlight: ["job-2", "pod-2"] },
        { title: "History is kept", text: "Finished Jobs and their Pods stay up to the history limits, then the oldest are deleted.", highlight: ["job-1", "pod-1"] },
      ],
    },
  ],
};
