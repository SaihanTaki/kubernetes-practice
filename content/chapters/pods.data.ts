import type { ChapterData } from "../types";
import { quiz } from "./pods.quiz";

export const data: ChapterData = {
  objectives: [
    "Explain what containers in the same Pod share and why most Pods run one main container.",
    "Describe what happens to a standalone Pod when it fails or is deleted, and how that differs from a managed Pod.",
    "Read Pod status values such as Pending, ContainerCreating, Running, CrashLoopBackOff, and ImagePullBackOff.",
    "Inspect Pods with kubectl get and kubectl describe to find why one is failing.",
    "Read every field of a Pod manifest, including resources and restartPolicy.",
  ],
  quiz,
  manifests: [
    {
      id: "pod",
      title: "api-pod.yaml",
      yaml: `apiVersion: v1
kind: Pod
metadata:
  name: api
  labels:
    app: api
spec:
  restartPolicy: Always
  containers:
    - name: api
      image: nginx:1.27
      ports:
        - containerPort: 80
      env:
        - name: LOG_LEVEL
          value: "info"
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"`,
      notes: [
        { line: 1, text: "Pods are in the core API group, so the version is plain v1." },
        { line: 4, text: "The Pod name. It must be unique in the namespace. A standalone Pod keeps exactly this name." },
        { line: 6, text: "Labels let controllers and Services find this Pod. They are not required for a standalone Pod." },
        { line: 8, text: "What the kubelet does when a container exits: Always (the default), OnFailure (only on a non-zero exit code), or Never. It applies to every container in the Pod." },
        { line: 9, text: "A list of containers. Most Pods have one; extra containers here share the Pod's network and volumes." },
        { line: 10, text: "Container name, unique within the Pod. kubectl describe and logs refer to containers by this name." },
        { line: 11, text: "The image to run. Pin a tag. If the kubelet cannot pull it, the Pod shows ImagePullBackOff." },
        { line: 13, text: "The port the container listens on. This is informational: the container can listen on other ports too." },
        { line: 14, text: "Environment variables set inside the container." },
        { line: 16, text: "Values are strings, so quote numbers and booleans." },
        { line: 18, text: "Requests are what the scheduler reserves on a node. The Pod only goes to a node with this much unreserved capacity." },
        { line: 19, text: "CPU in millicores: 100m is a tenth of one CPU core." },
        { line: 20, text: "Memory in bytes with a suffix. Mi is mebibytes." },
        { line: 21, text: "Limits are enforced at runtime. Over the CPU limit the container is throttled; over the memory limit it is killed (OOMKilled)." },
      ],
    },
  ],
  labs: [
    {
      id: "pods-broken",
      title: "Find and remove a failing Pod",
      difficulty: "beginner",
      scenario:
        "Three standalone Pods run in the default namespace. Someone reports that one of them keeps crashing. Find it and delete it without touching the healthy ones.",
      instructions: [
        "List the Pods and look at the STATUS and RESTARTS columns.",
        "Describe the suspicious Pod to see its waiting reason and restart count.",
        "Delete the failing Pod. Leave api and worker running.",
      ],
      fixture: {
        pods: [
          { name: "api", image: "nginx:1.27", labels: { app: "api" } },
          { name: "worker", image: "busybox:1.36", labels: { app: "worker" } },
          {
            name: "broken-pod",
            image: "busybox:1.36",
            labels: { app: "broken" },
            status: "CrashLoopBackOff",
            restarts: 6,
          },
        ],
      },
      objectives: [
        {
          id: "broken-gone",
          description: "The failing Pod broken-pod is deleted.",
          validator: { kind: "resource-absent", resourceType: "Pod", resourceName: "broken-pod" },
        },
        {
          id: "api-kept",
          description: "The api Pod still exists.",
          validator: { kind: "resource-exists", resourceType: "Pod", resourceName: "api" },
        },
        {
          id: "worker-kept",
          description: "The worker Pod still exists.",
          validator: { kind: "resource-exists", resourceType: "Pod", resourceName: "worker" },
        },
      ],
      hints: [
        "Start with kubectl get pods. A healthy Pod shows Running with few or no restarts.",
        "Run kubectl describe pod <name> on the Pod that is not Running. The State line shows the waiting reason and Restart Count shows how often it crashed.",
        "kubectl delete pod <name> removes one Pod. These Pods have no controller, so nothing recreates it.",
      ],
      solution: ["kubectl get pods", "kubectl describe pod broken-pod", "kubectl delete pod broken-pod"],
    },
  ],
  diagrams: [
    {
      id: "pod-anatomy",
      groups: [{ id: "pod", label: "Pod api (one IP)", x: 0, y: 0, width: 400, height: 250 }],
      nodes: [
        {
          id: "main",
          label: "Main container: api",
          x: 20,
          y: 40,
          detail: "Runs the application image. Most Pods have only this one container.",
        },
        {
          id: "sidecar",
          label: "Sidecar container (optional)",
          x: 210,
          y: 40,
          detail: "A helper such as a log shipper or proxy. It starts, stops, and is scheduled together with the main container.",
        },
        {
          id: "network",
          label: "Shared network",
          x: 20,
          y: 150,
          detail: "Every container in the Pod uses the same IP address and reaches the others on localhost.",
        },
        {
          id: "volume",
          label: "Shared volume",
          x: 210,
          y: 150,
          detail: "A volume declared in the Pod can be mounted by several containers, so they can exchange files.",
        },
        {
          id: "kubelet",
          label: "Node: kubelet",
          x: 500,
          y: 95,
          detail: "The agent on the node the Pod was scheduled to. It pulls images, starts containers, and restarts them according to restartPolicy.",
        },
      ],
      edges: [
        { from: "kubelet", to: "main", label: "starts, restarts" },
        { from: "kubelet", to: "sidecar" },
        { from: "main", to: "network", label: "localhost" },
        { from: "sidecar", to: "network" },
        { from: "main", to: "volume", label: "mounts" },
        { from: "sidecar", to: "volume" },
      ],
      steps: [
        {
          title: "Scheduled (Pending)",
          text: "The scheduler assigns the Pod to a node. The Pod is Pending until all its containers have been created.",
          nodes: ["kubelet"],
        },
        {
          title: "Image pulled, containers created (ContainerCreating)",
          text: "The kubelet on that node pulls the images, sets up the shared network and volumes, and creates the containers. kubectl get pods shows ContainerCreating. If the pull fails it shows ImagePullBackOff.",
          nodes: ["kubelet", "network", "volume"],
        },
        {
          title: "Running",
          text: "The containers have started. They share the Pod's IP and the mounted volume.",
          nodes: ["main", "sidecar", "network", "volume"],
        },
        {
          title: "Crash and restart",
          text: "If the main container exits, the kubelet restarts it in place according to restartPolicy. If it keeps crashing, the kubelet waits longer between restarts and the Pod shows CrashLoopBackOff.",
          nodes: ["kubelet", "main"],
        },
      ],
    },
  ],
};
