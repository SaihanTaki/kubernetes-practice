import type { ChapterData } from "../types";
import { quiz } from "./rollouts.quiz";

const apiFile = (image: string, cause: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  annotations:
    kubernetes.io/change-cause: ${cause}
spec:
  replicas: 4
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ${image}
          ports:
            - containerPort: 8080
`;

export const data: ChapterData = {
  objectives: [
    "Say which changes start a rollout and work out how many Pods a RollingUpdate keeps ready and running.",
    "Choose between RollingUpdate and Recreate, and explain how readiness gates a rollout.",
    "Follow a rollout with kubectl rollout status and read its history and change causes.",
    "Recover from a stuck rollout with kubectl rollout undo, including --to-revision.",
    "Batch template changes with pause and resume, and replace Pods with rollout restart.",
  ],
  quiz,
  manifests: [
    {
      id: "rollouts-deployment",
      title: "api-deployment.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  annotations:
    kubernetes.io/change-cause: upgrade to example/api:1.1
spec:
  replicas: 4
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api:1.1
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5`,
      notes: [
        { line: 5, text: "Annotations hold free-form text that tools read. Unlike labels, nothing selects on them." },
        {
          line: 6,
          text: "Shown in the CHANGE-CAUSE column of kubectl rollout history. Changing only this annotation does not start a rollout, because it is outside the template.",
        },
        { line: 8, text: "With 4 replicas, both 25% values below work out to 1 Pod." },
        { line: 12, text: "How Pods are replaced when the template changes. Changing the strategy itself does not start a rollout." },
        { line: 13, text: "RollingUpdate is the default. Recreate removes all old Pods before creating new ones, with downtime in between." },
        { line: 15, text: "25% of 4 is 1, rounded up. At most 5 Pods exist during the rollout." },
        { line: 16, text: "25% of 4 is 1, rounded down. At least 3 Pods stay ready during the rollout." },
        { line: 17, text: "Any change under template creates a new ReplicaSet and a new revision." },
        { line: 24, text: "The usual rollout trigger. Pin a tag so each revision names exactly what it ran." },
        {
          line: 27,
          text: "A new Pod counts toward the rollout only once this probe passes. Until then, no further old Pods are removed.",
        },
        { line: 29, text: "Point readiness at an endpoint that checks the app can serve, not just that the process started." },
      ],
    },
  ],
  labs: [
    {
      id: "rollouts-undo",
      title: "Roll back a stuck release",
      difficulty: "intermediate",
      scenario:
        "The api Deployment ran example/api:1.0, then 1.1. A teammate just applied api-v3.yaml with example/api:2.0, and the rollout has stopped making progress. Get the app back to the last good release and record why.",
      instructions: [
        "Run kubectl rollout status deployment/api and kubectl get pods. Which Pods are failing, and which still serve traffic?",
        "Run kubectl rollout history deployment/api to find the revision that ran example/api:1.1.",
        "Roll back to that revision with kubectl rollout undo and --to-revision.",
        "Run kubectl get pods until all 4 Pods run example/api:1.1 and are ready.",
        "Set the change cause on the Deployment to rollback-to-1.1 with kubectl annotate and --overwrite.",
      ],
      fixture: {
        files: {
          "api-v1.yaml": apiFile("example/api:1.0", "deploy example/api:1.0"),
          "api-v2.yaml": apiFile("example/api:1.1", "upgrade to example/api:1.1"),
          "api-v3.yaml": apiFile("example/api:2.0", "upgrade to example/api:2.0"),
        },
        apply: ["api-v1.yaml", "api-v2.yaml", "api-v3.yaml"],
      },
      objectives: [
        {
          id: "image",
          description: "The api Deployment's template uses example/api:1.1.",
          validator: { kind: "deployment-image", resourceName: "api", expectedValue: "example/api:1.1" },
        },
        {
          id: "complete",
          description: "The rollout is complete: all 4 replicas are updated and ready.",
          validator: { kind: "rollout-complete", resourceName: "api" },
        },
        {
          id: "cause",
          description: "The api Deployment's kubernetes.io/change-cause is rollback-to-1.1.",
          validator: {
            kind: "annotation-equals",
            resourceType: "Deployment",
            resourceName: "api",
            key: "kubernetes.io/change-cause",
            expectedValue: "rollback-to-1.1",
          },
        },
      ],
      hints: [
        "The new Pods are in CrashLoopBackOff. Three old Pods are still Running: maxUnavailable: 1 keeps at least 3 ready.",
        "kubectl rollout history deployment/api lists each revision with its change cause. Revision 2 is example/api:1.1.",
        "kubectl rollout undo deployment/api --to-revision=2. Plain undo also works here, because revision 2 is the previous one.",
        "The rollback is a rolling update too. Run kubectl get pods a few times to let it finish.",
        "kubectl annotate deployment api kubernetes.io/change-cause=rollback-to-1.1 --overwrite",
      ],
      solution: [
        "kubectl rollout history deployment/api",
        "kubectl rollout undo deployment/api --to-revision=2",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl rollout status deployment/api",
        "kubectl annotate deployment api kubernetes.io/change-cause=rollback-to-1.1 --overwrite",
      ],
    },
  ],
  diagrams: [
    {
      id: "rollout-steps",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "st-0",
            label: "Before: example/api:1.0",
            sub: "4 Pods, 4 ready",
            detail: "replicas: 4 with the default 25% bounds. maxSurge rounds up to 1 and maxUnavailable rounds down to 1, so at most 5 Pods and at least 3 ready.",
            children: [
              { id: "st0-old", label: "Old ReplicaSet (1.0)", sub: "4 ready", detail: "The current revision before the change." },
              { id: "st0-new", label: "New ReplicaSet (1.1)", sub: "not created yet", detail: "Created when the template changes." },
            ],
          },
          {
            id: "st-1",
            label: "Surge one, remove one",
            sub: "4 Pods, 3 ready",
            detail: "The new ReplicaSet scales to 1 (5 Pods would be the limit). Because one Pod may be unavailable, one old Pod is removed at once.",
            children: [
              { id: "st1-old", label: "Old ReplicaSet (1.0)", sub: "3 ready", detail: "Scaled from 4 to 3. Ready Pods are now at the minimum of 3." },
              { id: "st1-new", label: "New ReplicaSet (1.1)", sub: "1 starting", detail: "Scaled from 0 to 1. Its Pod is not ready yet, so it does not count." },
            ],
          },
          {
            id: "st-2",
            label: "Use the surge slot",
            sub: "5 Pods, 3 ready",
            detail: "There is room for one more Pod, so the new ReplicaSet scales to 2. No old Pod can go: removing one would leave 2 ready, below the minimum.",
            children: [
              { id: "st2-old", label: "Old ReplicaSet (1.0)", sub: "3 ready", detail: "Held at 3 while no new Pod is ready." },
              { id: "st2-new", label: "New ReplicaSet (1.1)", sub: "2 starting", detail: "Scaled from 1 to 2. Total is 5, the maxSurge limit." },
            ],
          },
          {
            id: "st-3",
            label: "New Pods ready, swap two",
            sub: "5 Pods, 3 ready",
            detail: "Both new Pods are ready, so 5 are ready. Two old Pods can go while keeping 3 ready, which frees two slots for new Pods.",
            children: [
              { id: "st3-old", label: "Old ReplicaSet (1.0)", sub: "1 ready", detail: "Scaled from 3 to 1." },
              { id: "st3-new", label: "New ReplicaSet (1.1)", sub: "2 ready, 2 starting", detail: "Scaled from 2 to 4, its final count." },
            ],
          },
          {
            id: "st-4",
            label: "Done: example/api:1.1",
            sub: "4 Pods, 4 ready",
            detail: "The last new Pods became ready and the last old Pod was removed. kubectl rollout status now reports success.",
            children: [
              { id: "st4-old", label: "Old ReplicaSet (1.0)", sub: "0 replicas, kept", detail: "Kept as revision 1 for rollback, up to revisionHistoryLimit." },
              { id: "st4-new", label: "New ReplicaSet (1.1)", sub: "4 ready", detail: "Revision 2, the Deployment's current ReplicaSet." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Start",
          text: "Four 1.0 Pods are ready. You change the image to 1.1, so the template changes and a new ReplicaSet is created.",
          highlight: ["st-0", "st0-old"],
        },
        {
          title: "First move",
          text: "The new ReplicaSet scales to 1 and the old one drops to 3. Ready Pods fall to 3, the lowest maxUnavailable: 1 allows.",
          highlight: ["st-1", "st1-old", "st1-new"],
        },
        {
          title: "Surge",
          text: "One more new Pod fits under the 5-Pod limit. The old ReplicaSet must wait: none of the new Pods is ready.",
          highlight: ["st-2", "st2-new"],
        },
        {
          title: "Readiness unlocks progress",
          text: "Both new Pods pass readiness. Two old Pods are removed and two more new Pods start, never dropping below 3 ready.",
          highlight: ["st-3", "st3-old", "st3-new"],
        },
        {
          title: "Complete",
          text: "All four new Pods are ready and the old ReplicaSet is at 0. It stays, so you can roll back to it.",
          highlight: ["st-4", "st4-old", "st4-new"],
        },
      ],
    },
    {
      id: "rollout-history",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "h-good",
            label: "After two good releases",
            sub: "revision 2 is current",
            detail: "Each template the Deployment has run has its own ReplicaSet, tagged with a deployment.kubernetes.io/revision annotation.",
            children: [
              { id: "h1-r1", label: "Revision 1", sub: "api:1.0, 0 Pods", detail: "The first release, scaled to 0 and kept for rollback." },
              { id: "h1-r2", label: "Revision 2", sub: "api:1.1, 4 ready", detail: "The current ReplicaSet. Its change cause reads upgrade to example/api:1.1." },
            ],
          },
          {
            id: "h-stuck",
            label: "Release 2.0 is stuck",
            sub: "revision 3 never becomes ready",
            detail: "The 2.0 Pods crash on start. They never become ready, so the old ReplicaSet cannot shrink below 3 and the rollout stops.",
            children: [
              { id: "h2-r1", label: "Revision 1", sub: "api:1.0, 0 Pods", detail: "Unchanged." },
              { id: "h2-r2", label: "Revision 2", sub: "api:1.1, 3 ready", detail: "Lost one Pod to maxUnavailable: 1, then held. These Pods still serve traffic." },
              { id: "h2-r3", label: "Revision 3", sub: "api:2.0, 2 CrashLoopBackOff", detail: "One surge Pod plus one replacement. Without a fix it stays like this until progressDeadlineSeconds marks the rollout failed." },
            ],
          },
          {
            id: "h-undo",
            label: "After rollout undo --to-revision=2",
            sub: "revision 4 is current",
            detail: "Undo copied revision 2's template back into the Deployment. Its ReplicaSet was reused and renumbered, so the history now lists 1, 3, and 4.",
            children: [
              { id: "h3-r1", label: "Revision 1", sub: "api:1.0, 0 Pods", detail: "Still available for --to-revision=1." },
              { id: "h3-r3", label: "Revision 3", sub: "api:2.0, 0 Pods", detail: "Scaled to 0 and kept in the history, so you could inspect it with rollout history --revision=3." },
              { id: "h3-r4", label: "Revision 4", sub: "api:1.1, 4 ready", detail: "The same ReplicaSet that was revision 2, scaled back up to 4. Revision 2 no longer appears in the history." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Two revisions",
          text: "Revision 1 ran 1.0 and is kept at 0 Pods. Revision 2 runs 1.1 with all 4 Pods ready.",
          highlight: ["h-good", "h1-r1", "h1-r2"],
        },
        {
          title: "Bad release",
          text: "Applying 2.0 creates revision 3. Its Pods crash, so 3 Pods of revision 2 keep serving and the rollout is stuck.",
          highlight: ["h-stuck", "h2-r2", "h2-r3"],
        },
        {
          title: "Undo",
          text: "kubectl rollout undo --to-revision=2 rolls the 1.1 template out again. Revision 3 scales to 0.",
          highlight: ["h-undo", "h3-r3"],
        },
        {
          title: "Renumbered",
          text: "The 1.1 ReplicaSet becomes revision 4. Set a new change cause so the history says why.",
          highlight: ["h3-r4"],
        },
      ],
    },
  ],
};
