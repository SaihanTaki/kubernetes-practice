import type { ChapterData } from "../types";
import { quiz } from "./troubleshooting.quiz";

const brokenDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
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
          image: example/api:1.11
          ports:
            - containerPort: 8080
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: api-config
                  key: db_host
          resources:
            requests:
              cpu: "8"
              memory: 32Mi
            limits:
              memory: 64Mi
          readinessProbe:
            httpGet:
              path: /ready
              port: 80`;

const brokenService = `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api-server
  ports:
    - port: 80
      targetPort: 80`;

const workerYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: worker-config
data:
  QUEUE_ULR: amqp://queue:5672
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  labels:
    app: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
        - name: worker
          image: example/worker:1.0
          envFrom:
            - configMapRef:
                name: worker-config
`;

const shopYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.72
          ports:
            - containerPort: 80
          resources:
            requests:
              memory: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`;

export const data: ChapterData = {
  objectives: [
    "Work through a failing app in a fixed order: status, describe and events, logs, exec, then the owner and the Service.",
    "Map a Pod status or error message to its usual cause and the command that confirms it.",
    "Follow a request from the client through the Ingress, Service, and endpoints to a Pod and find where it stops.",
    "Fix several faults in one set of manifests and confirm the app answers.",
  ],
  quiz,
  manifests: [
    {
      id: "troubleshooting-broken-deployment",
      title: "api-deployment.yaml (broken)",
      yaml: brokenDeployment,
      notes: [
        { line: 4, text: "Nothing wrong here. Start reading from the Pod template down, because that is what the kubelet runs." },
        { line: 15, text: "Pods get app: api. Keep this in mind: the Service below must select exactly this label." },
        { line: 19, text: "Defect: tag 1.11 does not exist (the app ships 1.0, 1.1, 2.0). The Pod shows ErrImagePull, then ImagePullBackOff. Fix: example/api:1.1." },
        { line: 21, text: "The app listens on 8080. Probes and the Service targetPort must use this number." },
        { line: 27, text: "Defect: the ConfigMap api-config has the key DB_HOST, not db_host. Keys are case-sensitive, so the container is never created: CreateContainerConfigError." },
        { line: 30, text: "Defect: no node has 8 CPUs to offer, so the scheduler cannot place the Pod. It stays Pending with a FailedScheduling event that says Insufficient cpu. Fix: 250m." },
        { line: 33, text: "Defect: example/api uses about 100Mi. Above a 64Mi limit the kernel kills it: OOMKilled, exit code 137, then CrashLoopBackOff. Fix: 128Mi or more." },
        { line: 37, text: "Defect: the probe checks port 80, where nothing listens. The Pod runs but stays 0/1 and never joins the Service endpoints. Fix: 8080." },
      ],
    },
    {
      id: "troubleshooting-broken-service",
      title: "api-service.yaml (broken)",
      yaml: brokenService,
      notes: [
        { line: 4, text: "Clients use this name: http://api inside the namespace." },
        { line: 7, text: "Defect: no Pod has app: api-server, so the Service has no endpoints. kubectl get endpoints api shows <none>. Fix: app: api." },
        { line: 9, text: "The port clients connect to. 80 is fine here." },
        { line: 10, text: "Defect: traffic is sent to port 80 on the Pod, but the container listens on 8080. Endpoints exist, yet every request is refused. Fix: targetPort: 8080." },
      ],
    },
  ],
  labs: [
    {
      id: "troubleshooting-worker",
      title: "Fix the crashing worker",
      difficulty: "intermediate",
      scenario:
        "The worker Deployment (example/worker:1.0) and its ConfigMap were applied from worker.yaml. Both Pods keep restarting. The worker needs QUEUE_URL set to amqp://queue:5672.",
      instructions: [
        "Run kubectl get pods and note STATUS and RESTARTS.",
        "Run kubectl logs on one worker Pod with --previous to read why the last container exited.",
        "Run kubectl describe configmap worker-config, or cat worker.yaml, and compare the key with the variable the app wants.",
        "Fix the key in worker.yaml in the Files panel, then run kubectl apply -f worker.yaml.",
        "Run kubectl rollout restart deployment/worker so new containers read the corrected ConfigMap.",
        "Run kubectl get pods until two Pods are Running and ready, then check kubectl logs deployment/worker.",
      ],
      fixture: { files: { "worker.yaml": workerYaml }, apply: ["worker.yaml"] },
      objectives: [
        {
          id: "env",
          description: "The worker Pods have QUEUE_URL=amqp://queue:5672.",
          validator: { kind: "env-value", ownerType: "Deployment", ownerName: "worker", envName: "QUEUE_URL", expectedValue: "amqp://queue:5672" },
        },
        {
          id: "ready",
          description: "2 Pods owned by worker are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "worker", expectedValue: 2 },
        },
      ],
      hints: [
        "CrashLoopBackOff means the container starts and then exits. The reason is in the logs of the container that exited, so use --previous.",
        "The log says error: QUEUE_URL is not set. The Deployment loads every key of worker-config with envFrom.",
        "The ConfigMap key is spelled QUEUE_ULR. envFrom turns each key into a variable with the same name, so the app gets QUEUE_ULR and no QUEUE_URL.",
        "This is not CreateContainerConfigError: the ConfigMap exists, so Kubernetes has nothing to complain about. Only the app notices.",
        "Change QUEUE_ULR to QUEUE_URL in worker.yaml, apply it, then kubectl rollout restart deployment/worker.",
        "Keep running kubectl get pods. Old Pods are replaced one at a time.",
      ],
      solutionFiles: { "worker.yaml": workerYaml.replace("QUEUE_ULR:", "QUEUE_URL:") },
      solution: [
        "kubectl apply -f worker.yaml",
        "kubectl rollout restart deployment/worker",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
      ],
    },
    {
      id: "troubleshooting-shop",
      title: "Get the shop online",
      difficulty: "advanced",
      scenario:
        "shop.yaml holds the web Deployment (nginx, port 80), its Service, and an Ingress for shop.example.com. It was applied, but curl http://shop.example.com/ does not return the page. There are three separate faults.",
      instructions: [
        "Run curl http://shop.example.com/ to see the symptom.",
        "Run kubectl get pods, then kubectl describe pod on one web Pod and read the Events.",
        "Check the request path: kubectl describe ingress shop, kubectl get endpoints web, and the Service ports in shop.yaml.",
        "Fix every fault in shop.yaml in the Files panel and run kubectl apply -f shop.yaml. You can fix them one at a time and apply after each.",
        "Run kubectl get pods until two web Pods are ready, then run curl http://shop.example.com/ again.",
      ],
      fixture: { files: { "shop.yaml": shopYaml }, apply: ["shop.yaml"] },
      objectives: [
        {
          id: "http",
          description: "curl http://shop.example.com/ returns 200.",
          validator: { kind: "http-get", url: "http://shop.example.com/", expectedStatus: 200 },
        },
        {
          id: "ready",
          description: "2 Pods owned by web are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 2 },
        },
      ],
      hints: [
        "The Pods are Pending. describe pod shows a FailedScheduling event: no worker has 10Gi of memory to give. A few tens of Mi is plenty for nginx.",
        "Once the Pods are scheduled, they hit ImagePullBackOff. The Events name the image that failed: nginx:1.72 does not exist. Use nginx:1.27.",
        "With ready Pods the endpoints exist, but they point at port 8080. nginx listens on 80, so the Service targetPort must be 80.",
        "The Ingress itself is fine: shop.example.com, path / with Prefix, backend web on port 80.",
        "Changing the Pod template rolls out new Pods. Keep running kubectl get pods until both are ready before you curl.",
      ],
      solutionFiles: {
        "shop.yaml": shopYaml
          .replace("image: nginx:1.72", "image: nginx:1.27")
          .replace("memory: 10Gi", "memory: 64Mi")
          .replace("targetPort: 8080", "targetPort: 80"),
      },
      solution: [
        "kubectl apply -f shop.yaml",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get endpoints web",
        "curl http://shop.example.com/",
      ],
    },
  ],
  diagrams: [
    {
      id: "troubleshooting-decision-tree",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "start",
            label: "kubectl get pods",
            sub: "read STATUS, READY, RESTARTS",
            detail: "Always the first command. Add -o wide to see the node and Pod IP. The STATUS column decides which command comes next.",
          },
          {
            id: "branches",
            label: "STATUS points to the next command",
            sub: "select a status",
            detail: "Each status is reported by a different part of the system, so each has its evidence in a different place.",
            children: [
              {
                id: "pending",
                label: "Pending",
                sub: "kubectl describe pod",
                detail: "The scheduler found no node. The FailedScheduling event lists why per node: Insufficient cpu or memory, untolerated taints, nodeSelector mismatch.",
              },
              {
                id: "pull",
                label: "ImagePullBackOff",
                sub: "kubectl describe pod",
                detail: "The kubelet could not pull the image. The Failed event names the exact image: check the repository, the tag, and pull credentials.",
              },
              {
                id: "config",
                label: "CreateContainerConfigError",
                sub: "kubectl describe pod",
                detail: "A ConfigMap, Secret, or key referenced in env or envFrom does not exist. The event message names it.",
              },
              {
                id: "crash",
                label: "CrashLoopBackOff",
                sub: "kubectl logs --previous",
                detail: "The container starts and exits. Its last words are in the previous container's logs. If the logs end abruptly, check Last State in describe for OOMKilled.",
              },
              {
                id: "not-ready",
                label: "Running, 0/1",
                sub: "kubectl describe pod",
                detail: "The readiness probe fails. Unhealthy events show the probe URL and the error: connection refused, 404, or a timeout.",
              },
              {
                id: "running",
                label: "Running, 1/1",
                sub: "exec, endpoints, Ingress",
                detail: "The Pod is fine as far as Kubernetes knows. Test from inside with kubectl exec, then follow the request path through the Service and Ingress.",
              },
            ],
          },
        ],
      },
      steps: [
        { title: "Start with status", text: "kubectl get pods shows every Pod with its STATUS, READY count, and restarts. That one line usually tells you which layer failed.", highlight: ["start"] },
        { title: "Pending", text: "No node was chosen. kubectl describe pod and read the FailedScheduling event; logs do not exist yet because no container ran.", highlight: ["pending"] },
        { title: "Image problems", text: "The node could not pull the image. kubectl describe pod shows the image name it tried. Compare it character by character.", highlight: ["pull"] },
        { title: "Missing configuration", text: "The container was never created. kubectl describe pod names the missing ConfigMap, Secret, or key.", highlight: ["config"] },
        { title: "Crashes", text: "The app ran and exited. kubectl logs <pod> --previous shows what it printed before it died. OOMKilled in describe means the memory limit stopped it.", highlight: ["crash"] },
        { title: "Not ready", text: "Running but 0/1 means readiness fails and the Pod gets no traffic. kubectl describe pod shows the probe and its failures.", highlight: ["not-ready"] },
        { title: "Healthy but broken", text: "If the Pod is 1/1 and requests still fail, the problem is on the path to it: test with kubectl exec, then check endpoints, the Service, and the Ingress.", highlight: ["running"] },
      ],
    },
    {
      id: "troubleshooting-request-path",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "client",
            label: "Client",
            sub: "curl http://shop.example.com/",
            detail: "Could not resolve host means DNS has no record for the name. A 404 or 503 from nginx means the request reached the Ingress controller.",
          },
          {
            id: "ingress",
            label: "Ingress shop",
            sub: "kubectl describe ingress shop",
            detail: "Check the class, the host, and the path. 404: no rule matched. 503: the backend Service is missing or has no ready endpoints; the Backends column shows which.",
          },
          {
            id: "service",
            label: "Service web",
            sub: "kubectl describe service web",
            detail: "Check that the Ingress uses the Service's port and that targetPort is the port the container listens on.",
          },
          {
            id: "endpoints",
            label: "Endpoints",
            sub: "kubectl get endpoints web",
            detail: "<none> means no ready Pod matches the selector: compare it with kubectl get pods --show-labels, then check readiness. The listed ports should be the container port.",
          },
          {
            id: "pod",
            label: "Pod",
            sub: "kubectl exec ... -- wget",
            detail: "Call the app from another Pod by Pod IP and port. If that works and the Service call times out, look for a NetworkPolicy.",
          },
        ],
      },
      steps: [
        { title: "From the client", text: "Run the failing request yourself and keep the exact error. Name resolution, a 404, a 503, and a timeout each point at a different hop.", highlight: ["client"] },
        { title: "Ingress", text: "kubectl describe ingress shows each host and path with its backend Service and the endpoints behind it, or an error if they do not exist.", highlight: ["ingress"] },
        { title: "Service", text: "The Ingress backend port must be a port of the Service, and the Service targetPort must be the container port.", highlight: ["service"] },
        { title: "Endpoints", text: "kubectl get endpoints lists the ready Pod IPs and ports. Empty means a selector or readiness problem, not a networking one.", highlight: ["endpoints"] },
        { title: "Pod", text: "Test the last hop from inside the cluster with kubectl exec. A timeout here, with Running Pods and correct ports, is the signature of a NetworkPolicy.", highlight: ["pod"] },
      ],
    },
  ],
};
