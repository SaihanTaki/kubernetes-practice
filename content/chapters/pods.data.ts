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
      root: {
        id: "layout",
        label: "",
        flow: true,
        children: [
          {
            id: "kubelet",
            label: "Node: kubelet",
            sub: "starts and restarts containers",
            detail: "The agent on the node the Pod was scheduled to. It pulls images, starts containers, and restarts them according to restartPolicy.",
          },
          {
            id: "pod",
            label: "Pod api",
            sub: "one IP address, shared by every container",
            detail: "The smallest unit Kubernetes schedules. Everything inside is placed on the same node and shares one network identity.",
            layout: "column",
            children: [
              {
                id: "containers",
                label: "",
                children: [
                  {
                    id: "main",
                    label: "Main container: api",
                    sub: "listens on :8080",
                    detail: "Runs the application image. Most Pods have only this one container.",
                  },
                  {
                    id: "sidecar",
                    label: "Sidecar container",
                    sub: "optional, e.g. log shipper",
                    detail: "A helper such as a log shipper or proxy. It starts, stops, and is scheduled together with the main container.",
                  },
                ],
              },
              {
                id: "shared",
                label: "",
                children: [
                  {
                    id: "network",
                    label: "Shared network",
                    sub: "same IP, reach each other on localhost",
                    detail: "Every container in the Pod uses the same IP address and reaches the others on localhost, so two containers cannot listen on the same port.",
                  },
                  {
                    id: "volume",
                    label: "Shared volume",
                    sub: "mounted by both containers",
                    detail: "A volume declared in the Pod can be mounted by several containers, so they can exchange files.",
                  },
                ],
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Scheduled (Pending)",
          text: "The scheduler assigns the Pod to a node. The Pod is Pending until all its containers have been created.",
          highlight: ["kubelet", "pod"],
        },
        {
          title: "Image pulled, containers created (ContainerCreating)",
          text: "The kubelet on that node pulls the images, sets up the shared network and volumes, and creates the containers. kubectl get pods shows ContainerCreating. If the pull fails it shows ImagePullBackOff.",
          highlight: ["kubelet", "network", "volume"],
        },
        {
          title: "Running",
          text: "The containers have started. They share the Pod's IP and the mounted volume.",
          highlight: ["main", "sidecar", "network", "volume"],
        },
        {
          title: "Crash and restart",
          text: "If the main container exits, the kubelet restarts it in place according to restartPolicy. If it keeps crashing, the kubelet waits longer between restarts and the Pod shows CrashLoopBackOff.",
          highlight: ["kubelet", "main"],
        },
      ],
    },
    {
      id: "pod-lifecycle",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "pending",
            label: "Phase: Pending",
            sub: "accepted, containers not running yet",
            detail: "The API server has stored the Pod, but not all of its containers have started. This covers waiting for a node and pulling images.",
            children: [
              {
                id: "unscheduled",
                label: "Waiting for a node",
                sub: "STATUS: Pending",
                detail: "The scheduler has not placed the Pod yet. If no node has enough free requested CPU and memory, the Pod stays here.",
              },
              {
                id: "creating",
                label: "ContainerCreating",
                sub: "node assigned, pulling images",
                detail: "The Pod is bound to a node. The kubelet there pulls the images and creates the containers.",
              },
              {
                id: "image-pull",
                label: "ImagePullBackOff",
                sub: "image cannot be pulled",
                detail: "A waiting reason, not a phase. The pull failed, for example a wrong tag or missing registry credentials, and the kubelet retries with growing delays.",
              },
            ],
          },
          {
            id: "running",
            label: "Phase: Running",
            sub: "bound to a node, a container is running or restarting",
            detail: "At least one container is running, or is starting or restarting. A Pod in CrashLoopBackOff is still in this phase.",
            children: [
              {
                id: "up",
                label: "Containers running",
                sub: "STATUS: Running",
                detail: "The normal state for a server. The RESTARTS column stays at 0 while nothing crashes.",
              },
              {
                id: "crash-loop",
                label: "CrashLoopBackOff",
                sub: "container keeps exiting",
                detail: "A waiting reason, not a phase. The container exited and is restarted after a delay that doubles each time, up to five minutes. RESTARTS keeps climbing.",
              },
            ],
          },
          {
            id: "ended",
            label: "Ended",
            sub: "all containers exited and will not restart",
            detail: "Only reached when restartPolicy allows containers to stay stopped (OnFailure or Never). With Always the Pod stays Running.",
            children: [
              {
                id: "succeeded",
                label: "Phase: Succeeded",
                sub: "STATUS: Completed",
                detail: "Every container exited with code 0. Typical for one-off tasks.",
              },
              {
                id: "failed",
                label: "Phase: Failed",
                sub: "STATUS: Error",
                detail: "All containers have exited and at least one exited with a non-zero code or was killed by the system.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Created, waiting for a node",
          text: "You create the Pod. Until the scheduler binds it to a node, it is Pending.",
          highlight: ["pending", "unscheduled"],
        },
        {
          title: "ContainerCreating",
          text: "The Pod has a node. The kubelet pulls the image and creates the containers. The phase is still Pending.",
          highlight: ["pending", "creating"],
        },
        {
          title: "Image pull fails",
          text: "If the image cannot be pulled, the container waits with reason ImagePullBackOff and the Pod stays Pending until the pull succeeds.",
          highlight: ["pending", "image-pull"],
        },
        {
          title: "Running",
          text: "The containers start and the Pod moves to Running. This is where a healthy server stays.",
          highlight: ["running", "up"],
        },
        {
          title: "Crash loop",
          text: "The container exits and the kubelet restarts it. If it keeps exiting, each restart waits longer and STATUS shows CrashLoopBackOff, while the phase stays Running.",
          highlight: ["running", "crash-loop"],
        },
        {
          title: "Ended",
          text: "With restartPolicy OnFailure or Never, the Pod can finish: Succeeded if every container exited with 0, Failed otherwise.",
          highlight: ["ended", "succeeded", "failed"],
        },
      ],
    },
    {
      id: "restart-policy",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "always",
            label: "Always",
            sub: "the default",
            detail: "For long-running servers. The container is restarted after every exit, so the Pod never reaches Succeeded or Failed on its own.",
            layout: "column",
            children: [
              {
                id: "always-zero",
                label: "Exit code 0",
                sub: "restarted",
                detail: "Even a clean exit is treated as something to undo: the kubelet starts the container again.",
              },
              {
                id: "always-nonzero",
                label: "Exit code non-zero",
                sub: "restarted, with back-off",
                detail: "The container is restarted. Repeated crashes lead to CrashLoopBackOff.",
              },
            ],
          },
          {
            id: "on-failure",
            label: "OnFailure",
            sub: "retry until it succeeds",
            detail: "For tasks that should run to completion but may fail and be retried.",
            layout: "column",
            children: [
              {
                id: "on-failure-zero",
                label: "Exit code 0",
                sub: "not restarted",
                detail: "The container is done. When every container has exited with 0, the Pod is Succeeded.",
              },
              {
                id: "on-failure-nonzero",
                label: "Exit code non-zero",
                sub: "restarted, with back-off",
                detail: "The kubelet restarts the container in the same Pod, waiting longer after each failure.",
              },
            ],
          },
          {
            id: "never",
            label: "Never",
            sub: "run once",
            detail: "The kubelet never restarts a container. The Pod ends as Succeeded or Failed.",
            layout: "column",
            children: [
              {
                id: "never-zero",
                label: "Exit code 0",
                sub: "not restarted",
                detail: "The container stays stopped. If every container exited with 0, the Pod is Succeeded.",
              },
              {
                id: "never-nonzero",
                label: "Exit code non-zero",
                sub: "not restarted, Pod Failed",
                detail: "The container stays stopped and the Pod ends as Failed once all containers have exited.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Clean exit (code 0)",
          text: "Only Always restarts a container that finished successfully. OnFailure and Never leave it stopped.",
          highlight: ["always-zero", "on-failure-zero", "never-zero"],
        },
        {
          title: "Crash (non-zero code)",
          text: "Always and OnFailure restart the container with a growing delay. Never leaves it stopped and the Pod ends as Failed.",
          highlight: ["always-nonzero", "on-failure-nonzero", "never-nonzero"],
        },
      ],
    },
    {
      id: "requests-limits",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "spec",
            label: "Container resources",
            sub: "from the Pod manifest",
            detail: "Each container declares requests and limits for CPU and memory.",
            children: [
              {
                id: "requests",
                label: "requests",
                sub: "cpu 100m, memory 128Mi",
                detail: "The amount reserved for the container. Only used when placing the Pod.",
              },
              {
                id: "limits",
                label: "limits",
                sub: "cpu 500m, memory 256Mi",
                detail: "The most the container may use. Enforced on the node while it runs.",
              },
            ],
          },
          {
            id: "scheduler",
            label: "kube-scheduler",
            sub: "places the Pod using requests",
            detail: "Picks a node whose allocatable CPU and memory minus the requests of Pods already there can fit this Pod's requests. Actual usage is not considered. If no node fits, the Pod stays Pending.",
          },
          {
            id: "node",
            label: "Node: kubelet and container runtime",
            sub: "enforce limits at runtime",
            detail: "The node configures the container's cgroup with the limits, and the kernel enforces them.",
            children: [
              {
                id: "cpu-over",
                label: "CPU over limit",
                sub: "throttled, keeps running",
                detail: "The container gets no more CPU time than the limit allows, so it runs slower but is not killed.",
              },
              {
                id: "memory-over",
                label: "Memory over limit",
                sub: "OOMKilled",
                detail: "The kernel kills the process. The container shows reason OOMKilled and is restarted according to restartPolicy.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Scheduling uses requests",
          text: "The scheduler only looks at requests and picks a node with enough unreserved capacity. Limits play no part here.",
          highlight: ["requests", "scheduler"],
        },
        {
          title: "Running enforces limits",
          text: "On the node, the limits become hard caps for the running container.",
          highlight: ["limits", "node"],
        },
        {
          title: "Going over",
          text: "Too much CPU is throttled. Too much memory gets the container killed with OOMKilled.",
          highlight: ["cpu-over", "memory-over"],
        },
      ],
    },
  ],
};
