import type { ChapterData } from "../types";
import { quiz } from "./resources.quiz";

const brokenApps = `apiVersion: apps/v1
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
          resources:
            requests:
              cpu: 100m
              memory: 3Gi
            limits:
              memory: 3Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: memhog
spec:
  replicas: 1
  selector:
    matchLabels:
      app: memhog
  template:
    metadata:
      labels:
        app: memhog
    spec:
      containers:
        - name: memhog
          image: example/memhog:1.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              memory: 256Mi
`;

const [brokenApi, brokenMemhog] = brokenApps.split("---\n");
const fixedApps =
  brokenApi.replaceAll("memory: 3Gi", "memory: 256Mi") + "---\n" + brokenMemhog.replaceAll("memory: 256Mi", "memory: 768Mi");

export const data: ChapterData = {
  objectives: [
    "Explain the difference between a request (used by the scheduler) and a limit (enforced on the node), and write both in CPU and memory units.",
    "Predict what happens at a limit: CPU throttling versus an OOM kill with exit code 137.",
    "Work out whether a Pod fits on a node from its requests and the node's allocatable, and read a FailedScheduling event.",
    "Name a Pod's QoS class and say how it affects eviction under memory pressure.",
    "Use LimitRange and ResourceQuota to set defaults and budgets for a namespace, and check usage with kubectl top and kubectl describe node.",
  ],
  quiz,
  manifests: [
    {
      id: "resources-deployment",
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
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 256Mi`,
      notes: [
        { line: 6, text: "Requests are per Pod. Three replicas reserve 300m CPU and 384Mi memory in total, spread over the nodes they land on." },
        { line: 16, text: "Resources are set per container. A Pod's request is the sum over its containers." },
        { line: 20, text: "resources sits beside image and ports in the container, not at the Pod level." },
        { line: 21, text: "Requests are what the scheduler adds up against each node's allocatable to decide where the Pod fits." },
        { line: 22, text: "100m is a tenth of a core. It is also this container's share of CPU when the node is busy." },
        { line: 23, text: "128Mi is 128 × 1024 × 1024 bytes. Set it near what the app really uses, measured with kubectl top." },
        { line: 24, text: "Limits are enforced on the node while the container runs. The scheduler ignores them." },
        { line: 25, text: "Above 256Mi the container is OOM killed (exit code 137) and restarted. There is no CPU limit, so CPU can burst into idle capacity without throttling. With requests set and limits not equal to them, the QoS class is Burstable." },
      ],
    },
    {
      id: "resources-limitrange",
      title: "limitrange.yaml",
      yaml: `apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: team-a
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      default:
        cpu: 500m
        memory: 256Mi
      min:
        cpu: 10m
        memory: 16Mi
      max:
        cpu: "2"
        memory: 1Gi`,
      notes: [
        { line: 2, text: "A LimitRange is namespaced. It applies to Pods created in team-a after it exists; running Pods are not changed." },
        { line: 8, text: "These rules apply to each container separately. A LimitRange can also have type: Pod, which bounds the sum of a Pod's containers." },
        { line: 9, text: "Filled in as the request for any container that declares none." },
        { line: 12, text: "Filled in as the limit for any container that declares none. Note the key is default, not defaultLimit." },
        { line: 15, text: "A container with a request or limit below these values is rejected." },
        { line: 18, text: "A container with a limit above these values is rejected: maximum memory usage per Container is 1Gi, but limit is 2Gi." },
        { line: 19, text: "Quote whole numbers of cores so YAML reads them as the string the API expects." },
      ],
    },
    {
      id: "resources-quota",
      title: "quota.yaml",
      yaml: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-a
spec:
  hard:
    pods: "10"
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.cpu: "4"
    limits.memory: 8Gi
    count/deployments.apps: "5"`,
      notes: [
        { line: 2, text: "A ResourceQuota caps the total for one namespace. Each new object is checked against what is already used there." },
        { line: 7, text: "Every key under hard is a ceiling. kubectl describe quota shows Used next to each Hard value." },
        { line: 8, text: "At most 10 Pods may exist in team-a, whatever their size." },
        { line: 9, text: "The sum of CPU requests of all Pods in the namespace. Because this key is set, every new Pod must declare a CPU request." },
        { line: 10, text: "The sum of memory requests. A Pod that would push it past 4Gi is rejected with exceeded quota." },
        { line: 12, text: "Limits can be capped too. With this key, a Pod without a memory limit is rejected: must specify limits.memory." },
        { line: 13, text: "Object counts use count/<resource>.<group>. This allows at most 5 Deployments." },
      ],
    },
  ],
  labs: [
    {
      id: "resources-fix-requests-limits",
      title: "Fix a Pending replica and an OOM kill",
      difficulty: "intermediate",
      scenario:
        "apps.yaml holds two Deployments. api (example/api:1.1, about 100Mi of memory in use) asks for 3Gi per replica, and one of its three replicas is stuck Pending. memhog (example/memhog:1.0, needs about 600Mi) has a 256Mi memory limit and keeps getting killed. The workers each have 4Gi allocatable.",
      instructions: [
        "Run kubectl get pods -o wide. Note which api Pod is Pending and what state memhog is in.",
        "Run kubectl describe pod on the Pending api Pod and read the FailedScheduling event.",
        "Run kubectl describe node worker-1 and kubectl describe node worker-2. Compare Allocated resources with the 3Gi the Pending Pod asks for.",
        "Run kubectl describe pod on the memhog Pod. Read Last State, Reason, and Exit Code.",
        "Run kubectl top pods to see what the running Pods really use.",
        "In apps.yaml, set the api container's memory request and limit to 256Mi, and the memhog container's memory request and limit to 768Mi. Then run kubectl apply -f apps.yaml.",
        "Run kubectl get pods until all three api Pods and the memhog Pod are Running and ready.",
      ],
      fixture: { files: { "apps.yaml": brokenApps }, apply: ["apps.yaml"] },
      objectives: [
        {
          id: "api-request",
          description: "The api Deployment requests 256Mi of memory per container.",
          validator: { kind: "container-resource", ownerType: "Deployment", name: "api", field: "requests.memory", expectedValue: "256Mi" },
        },
        {
          id: "api-scheduled",
          description: "No api Pod is Pending.",
          validator: { kind: "pending-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: 0 },
        },
        {
          id: "api-ready",
          description: "3 Pods owned by the api Deployment are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: 3 },
        },
        {
          id: "memhog-limit",
          description: "The memhog Deployment has a 768Mi memory limit.",
          validator: { kind: "container-resource", ownerType: "Deployment", name: "memhog", field: "limits.memory", expectedValue: "768Mi" },
        },
        {
          id: "memhog-ready",
          description: "The memhog Pod is ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "memhog", expectedValue: 1 },
        },
      ],
      hints: [
        "Insufficient memory means the sum of requests on every worker plus 3Gi is more than 4Gi. Actual usage does not matter to the scheduler.",
        "Two api replicas take 3Gi on each worker, leaving 1Gi or less. The third replica cannot fit anywhere.",
        "OOMKilled with exit code 137 means the container went over its memory limit. memhog needs about 600Mi, so 256Mi can never work.",
        "Change memory: 3Gi to memory: 256Mi in both places in the api Deployment, and memory: 256Mi to memory: 768Mi in both places in the memhog Deployment.",
        "Both templates change, so both Deployments roll out new Pods. Keep running kubectl get pods until the old Pods are gone.",
      ],
      solutionFiles: { "apps.yaml": fixedApps },
      solution: [
        "kubectl apply -f apps.yaml",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl get pods -o wide",
      ],
    },
  ],
  diagrams: [
    {
      id: "resources-node-allocatable",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-node",
            label: "worker-1",
            sub: "allocatable 4Gi memory",
            detail: "Capacity is the machine's memory. Allocatable is capacity minus what is reserved for the system, the kubelet, and the eviction threshold. Pods can claim only allocatable.",
            children: [
              { id: "node-reserved", label: "Reserved", sub: "system, kubelet, eviction", detail: "Kept back from Pods so the node itself keeps working. Not part of allocatable." },
              { id: "node-free", label: "Free to request", sub: "4Gi", detail: "No Pods yet, so all of allocatable is available to requests." },
            ],
          },
          {
            id: "stage-placed",
            label: "Two Pods placed",
            sub: "3Gi requested, 1Gi left",
            detail: "Each Pod's memory request is subtracted from what is free. What the Pods actually use does not change this number.",
            children: [
              { id: "placed-web", label: "Pod web", sub: "requests 1Gi, uses 200Mi", detail: "The scheduler counts the full 1Gi request, even though web uses far less right now." },
              { id: "placed-api", label: "Pod api", sub: "requests 2Gi, uses 300Mi", detail: "Same: 2Gi is reserved for api whether or not it uses it." },
              { id: "placed-free", label: "Free to request", sub: "1Gi", detail: "4Gi allocatable minus 1Gi minus 2Gi. About 3.5Gi is idle, but only 1Gi can be requested." },
            ],
          },
          {
            id: "stage-new",
            label: "New Pod report",
            sub: "requests 1.5Gi",
            detail: "The scheduler checks 1Gi + 2Gi + 1.5Gi = 4.5Gi against 4Gi allocatable. It does not fit, so this node is filtered out.",
            children: [
              { id: "new-pod", label: "Pod report", sub: "requests 1.5Gi", detail: "Its request is larger than the 1Gi still free on this node." },
              { id: "new-check", label: "Fit check", sub: "4.5Gi > 4Gi", detail: "Sum of requests on the node plus the new Pod's request, compared with allocatable, for CPU and memory separately." },
            ],
          },
          {
            id: "stage-pending",
            label: "No node fits",
            sub: "Pending",
            detail: "Every node failed some filter, so the Pod stays Pending with no node. The scheduler retries when something changes.",
            children: [
              { id: "pending-pod", label: "Pod report", sub: "Pending, node <none>", detail: "kubectl get pods shows Pending; kubectl get pods -o wide shows NODE <none>." },
              { id: "pending-event", label: "FailedScheduling", sub: "Insufficient memory", detail: "kubectl describe pod shows the event with one reason per node, such as 2 Insufficient memory." },
              { id: "pending-fix", label: "Ways out", sub: "lower request, free room, add node", detail: "Lower the request to what the app uses, delete or shrink other Pods, or add a node. The scheduler then places the Pod." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Allocatable",
          text: "worker-1 offers 4Gi of memory to Pods after the system reservation.",
          highlight: ["stage-node", "node-free"],
        },
        {
          title: "Requests fill the node",
          text: "web and api request 3Gi between them. They use much less, but the scheduler counts requests, so 1Gi is left.",
          highlight: ["stage-placed", "placed-web", "placed-api", "placed-free"],
        },
        {
          title: "A Pod that does not fit",
          text: "report requests 1.5Gi. 1Gi + 2Gi + 1.5Gi is more than 4Gi, so worker-1 is filtered out.",
          highlight: ["stage-new", "new-check"],
        },
        {
          title: "Pending",
          text: "No node passes, so report stays Pending with a FailedScheduling event until room appears.",
          highlight: ["stage-pending", "pending-pod", "pending-event"],
        },
      ],
    },
    {
      id: "resources-qos",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "classes",
            label: "QoS class from requests and limits",
            sub: "status.qosClass",
            detail: "Kubernetes sets the class when the Pod is created, from the requests and limits of all its containers. You cannot set it directly.",
            children: [
              { id: "class-guaranteed", label: "Guaranteed", sub: "requests = limits, CPU and memory", detail: "Every container has CPU and memory limits, and its requests equal its limits." },
              { id: "class-burstable", label: "Burstable", sub: "some request or limit", detail: "At least one container has a request or limit, but the Pod does not meet the Guaranteed rule." },
              { id: "class-besteffort", label: "BestEffort", sub: "nothing set", detail: "No container has any CPU or memory request or limit." },
            ],
          },
          {
            id: "eviction",
            label: "Node low on memory: eviction order",
            sub: "kubelet",
            flow: true,
            detail: "Below its eviction threshold the kubelet evicts Pods until memory is back. Controllers then recreate them, possibly on other nodes.",
            children: [
              { id: "evict-first", label: "1. Over their requests", sub: "BestEffort, busy Burstable", detail: "Pods using more memory than they request go first, ordered by priority, then by how far over. BestEffort requests nothing, so it is always in this group." },
              { id: "evict-last", label: "2. Within their requests", sub: "Guaranteed, quiet Burstable", detail: "Pods using less than they request go last. A Guaranteed Pod is always here, because it cannot use more than its request." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Guaranteed",
          text: "Requests equal limits for CPU and memory in every container. The most protected class.",
          highlight: ["class-guaranteed"],
        },
        {
          title: "Burstable",
          text: "Some requests or limits, but not equal everywhere. Protected while it stays within its requests.",
          highlight: ["class-burstable"],
        },
        {
          title: "BestEffort",
          text: "Nothing set. It gets whatever is free and is the first to go.",
          highlight: ["class-besteffort"],
        },
        {
          title: "Eviction",
          text: "Under memory pressure the kubelet evicts Pods over their requests first, then the rest. Guaranteed Pods are last.",
          highlight: ["eviction", "evict-first", "evict-last"],
        },
      ],
    },
  ],
};
