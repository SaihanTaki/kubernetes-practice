import type { ChapterData } from "../types";
import { quiz } from "./health-checks.quiz";

const brokenApi = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
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
              port: 80
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 8080
`;

export const data: ChapterData = {
  objectives: [
    "Explain what startup, readiness, and liveness probes each control: delaying the others, traffic, and restarts.",
    "Configure httpGet, tcpSocket, exec, and grpc probes and work out from the timing fields how long a restart takes.",
    "Describe how readiness decides which Pods a Service sends traffic to and when a rolling update can proceed.",
    "Find a failing probe with kubectl get and kubectl describe, and fix it in the manifest.",
  ],
  quiz,
  manifests: [
    {
      id: "health-checks-deployment",
      title: "api-deployment.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
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
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 5
            failureThreshold: 24
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
            failureThreshold: 2
            successThreshold: 2
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3`,
      notes: [
        { line: 1, text: "Probes live in the Pod template, so they work the same in a Deployment, a ReplicaSet, or a bare Pod." },
        { line: 17, text: "example/api serves HTTP on 8080 with three paths: /, /healthz, and /ready." },
        { line: 19, text: "The port the app listens on. Every probe below targets this port, not a Service port." },
        { line: 20, text: "Runs first. Liveness and readiness are not checked until this passes once, then it never runs again." },
        { line: 21, text: "httpGet sends GET http://<pod-ip>:8080/healthz. Any status from 200 to 399 is a pass." },
        { line: 24, text: "Check every 5 seconds while the app boots." },
        { line: 25, text: "24 failures × 5 seconds = 120 seconds to start. After that the container is restarted." },
        { line: 26, text: "Runs for the whole life of the container and decides whether the Pod is in Service endpoints." },
        { line: 28, text: "A separate path from liveness. /ready can say no while the app is busy or warming a cache without getting it killed." },
        { line: 31, text: "2 failures in a row, about 10 seconds, take the Pod out of rotation." },
        { line: 32, text: "2 passes in a row to rejoin, so a flapping Pod does not bounce in and out. Only readiness may set this above 1." },
        { line: 33, text: "Restarts the container if it stops answering. Keep the check cheap and local to this process." },
        { line: 35, text: "/healthz should only report whether this process works, never whether a database or other service is up." },
        { line: 37, text: "Liveness runs less often than readiness, so traffic is moved away before a restart happens." },
        { line: 38, text: "Wait up to 2 seconds for an answer. The default is 1, which is easy to exceed under load." },
        { line: 39, text: "3 failures at 10-second intervals: a hung container is restarted after about 30 seconds." },
      ],
    },
  ],
  labs: [
    {
      id: "health-checks-fix-probes",
      title: "Fix the api probes",
      difficulty: "intermediate",
      scenario:
        "The api Deployment (example/api:1.1, listening on 8080) and its Service were applied from api.yaml. The Service has no endpoints and the Pods keep restarting. Both problems are in the probes.",
      instructions: [
        "Run kubectl get pods and kubectl get endpoints api. Note READY, STATUS, and RESTARTS.",
        "Run kubectl describe pod on one of the api Pods and read its probe settings.",
        "Read api.yaml with cat. The app serves /, /healthz, and /ready on port 8080.",
        "Fix the readiness probe port and the liveness probe path in api.yaml in the Files panel, then run kubectl apply -f api.yaml.",
        "Run kubectl get pods and kubectl get endpoints api until two new Pods are ready and the Service has two endpoints.",
      ],
      fixture: { files: { "api.yaml": brokenApi }, apply: ["api.yaml"] },
      objectives: [
        {
          id: "endpoints",
          description: "The api Service has 2 endpoints.",
          validator: { kind: "endpoint-count", serviceName: "api", expectedValue: 2 },
        },
        {
          id: "ready",
          description: "2 Pods owned by the api Deployment are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: 2 },
        },
      ],
      hints: [
        "READY 0/1 with no restarts points at readiness. Climbing RESTARTS and CrashLoopBackOff point at liveness or startup.",
        "The readiness probe uses port 80. That is the Service port; the kubelet probes the container directly, which listens on 8080.",
        "The liveness probe asks for /health. The app serves /healthz.",
        "Change the readiness port to 8080 and the liveness path to /healthz, then apply. Leave the Service's port: 80 alone.",
        "The fix changes the Pod template, so the Deployment rolls out new Pods. Keep running kubectl get pods until the rollout finishes.",
      ],
      solutionFiles: {
        "api.yaml": brokenApi
          .replace("path: /ready\n              port: 80\n", "path: /ready\n              port: 8080\n")
          .replace("path: /health\n", "path: /healthz\n"),
      },
      solution: [
        "kubectl apply -f api.yaml",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get endpoints api",
      ],
    },
  ],
  diagrams: [
    {
      id: "probe-timeline",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-boot",
            label: "Container starts",
            sub: "t = 0s",
            detail: "The kubelet starts the container. Only the startup probe runs; the Pod is not ready and gets no traffic.",
            children: [
              { id: "boot-startup", label: "Startup probe", sub: "checking every 5s", detail: "GET /healthz on 8080. Failures are expected while the app boots, up to failureThreshold × periodSeconds." },
              { id: "boot-ready", label: "Readiness probe", sub: "on hold", detail: "Not run until the startup probe passes." },
              { id: "boot-live", label: "Liveness probe", sub: "on hold", detail: "Not run until the startup probe passes, so a slow start cannot trigger a restart." },
            ],
          },
          {
            id: "stage-started",
            label: "Startup probe passes",
            sub: "t ≈ 20s",
            detail: "One success is enough. The startup probe is done for the life of this container.",
            children: [
              { id: "started-startup", label: "Startup probe", sub: "passed, stops", detail: "It runs again only if the container restarts." },
              { id: "started-ready", label: "Readiness probe", sub: "starts checking", detail: "First checks may fail while the app warms up. The Pod stays out of endpoints." },
              { id: "started-live", label: "Liveness probe", sub: "starts checking", detail: "From now on, failureThreshold failures in a row restart the container." },
            ],
          },
          {
            id: "stage-ready",
            label: "Readiness passes",
            sub: "READY 1/1",
            detail: "After successThreshold passes the Pod is marked ready and its IP is added to the endpoints of matching Services.",
            children: [
              { id: "ready-startup", label: "Startup probe", sub: "done", detail: "Already passed." },
              { id: "ready-ready", label: "Readiness probe", sub: "passing, in endpoints", detail: "Traffic from Services now reaches this Pod. A rolling update counts it as available." },
              { id: "ready-live", label: "Liveness probe", sub: "passing", detail: "Checks every periodSeconds and does nothing while it passes." },
            ],
          },
          {
            id: "stage-run",
            label: "Steady state",
            sub: "both probes keep running",
            detail: "Readiness and liveness run for the whole life of the container, each on its own period.",
            children: [
              { id: "run-startup", label: "Startup probe", sub: "done", detail: "Never runs again for this container." },
              { id: "run-ready", label: "Readiness probe", sub: "fail → out of endpoints", detail: "A failure removes the Pod from Services without restarting it. It rejoins after successThreshold passes." },
              { id: "run-live", label: "Liveness probe", sub: "fail → restart", detail: "failureThreshold failures in a row and the kubelet kills the container. It restarts, and the timeline starts again from the top." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Boot",
          text: "Only the startup probe runs. Readiness and liveness wait, so a slow boot is not mistaken for a hang.",
          highlight: ["stage-boot", "boot-startup"],
        },
        {
          title: "Started",
          text: "The startup probe passes once and stops. Readiness and liveness begin checking.",
          highlight: ["stage-started", "started-ready", "started-live"],
        },
        {
          title: "Ready",
          text: "Readiness passes, so the Pod shows READY 1/1 and joins the Service endpoints.",
          highlight: ["stage-ready", "ready-ready"],
        },
        {
          title: "Running",
          text: "From here, a readiness failure moves traffic away and a liveness failure restarts the container.",
          highlight: ["stage-run", "run-ready", "run-live"],
        },
      ],
    },
    {
      id: "probe-readiness-service",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "svc-all",
            label: "Both Pods ready",
            sub: "2 endpoints",
            detail: "The Service selects app: api. Both Pods match and both pass readiness, so both IPs are endpoints.",
            children: [
              { id: "all-svc", label: "Service api", sub: "endpoints: 2", detail: "Traffic to the Service is spread over 10.244.1.4:8080 and 10.244.2.6:8080." },
              { id: "all-a", label: "Pod api-a", sub: "1/1 Running", detail: "Readiness passes. Receives traffic." },
              { id: "all-b", label: "Pod api-b", sub: "1/1 Running", detail: "Readiness passes. Receives traffic." },
            ],
          },
          {
            id: "svc-one",
            label: "api-b fails readiness",
            sub: "1 endpoint",
            detail: "api-b's /ready returns 503, for example while it reloads data. After failureThreshold failures it is marked not ready.",
            children: [
              { id: "one-svc", label: "Service api", sub: "endpoints: 1", detail: "api-b's IP is removed. All traffic goes to api-a." },
              { id: "one-a", label: "Pod api-a", sub: "1/1 Running", detail: "Unchanged. Now carries all the traffic." },
              { id: "one-b", label: "Pod api-b", sub: "0/1 Running", detail: "Still running and not restarted. Its labels still match; only readiness keeps it out." },
            ],
          },
          {
            id: "svc-back",
            label: "api-b recovers",
            sub: "2 endpoints",
            detail: "/ready answers 200 again. After successThreshold passes api-b is ready and rejoins.",
            children: [
              { id: "back-svc", label: "Service api", sub: "endpoints: 2", detail: "api-b's IP is added back without any action from you." },
              { id: "back-a", label: "Pod api-a", sub: "1/1 Running", detail: "Unchanged." },
              { id: "back-b", label: "Pod api-b", sub: "1/1 Running", detail: "Same Pod, same IP, RESTARTS still 0." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Both ready",
          text: "The Service's endpoints are the ready Pods that match its selector: both api Pods.",
          highlight: ["svc-all", "all-svc"],
        },
        {
          title: "One fails",
          text: "api-b fails readiness. It keeps running, but its IP leaves the endpoints and api-a takes all traffic.",
          highlight: ["svc-one", "one-svc", "one-b"],
        },
        {
          title: "Recovered",
          text: "api-b passes again and is added back. Nothing was restarted or recreated.",
          highlight: ["svc-back", "back-svc", "back-b"],
        },
      ],
    },
  ],
};
