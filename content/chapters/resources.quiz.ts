import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "resources-request-vs-limit",
    topic: "Requests and limits",
    difficulty: "beginner",
    question: "Which component uses a container's resource requests to decide where a Pod runs?",
    options: [
      { id: "a", text: "The scheduler" },
      { id: "b", text: "The container runtime" },
      { id: "c", text: "The Deployment controller" },
      { id: "d", text: "kube-proxy" },
    ],
    correctOptionId: "a",
    explanation:
      "The scheduler adds up the requests of Pods on each node and only places a Pod where its requests still fit within allocatable. Limits are enforced later, on the node, by the kubelet and the container runtime.",
  },
  {
    id: "resources-cpu-over-limit",
    topic: "Requests and limits",
    difficulty: "beginner",
    question: "A container tries to use more CPU than its CPU limit. What happens?",
    options: [
      { id: "a", text: "It is killed with exit code 137" },
      { id: "b", text: "It is throttled and runs slower, but keeps running" },
      { id: "c", text: "The Pod is evicted from the node" },
      { id: "d", text: "The scheduler moves it to a node with more CPU" },
    ],
    correctOptionId: "b",
    explanation:
      "CPU is compressible. The kernel gives the container its quota of CPU time per period and pauses it until the next one. That shows up as latency, not as a kill or a restart.",
  },
  {
    id: "resources-memory-over-limit",
    topic: "Requests and limits",
    difficulty: "beginner",
    question: "A container uses more memory than its memory limit. What does kubectl describe pod show afterwards?",
    options: [
      { id: "a", text: "Reason: Evicted, Exit Code: 1" },
      { id: "b", text: "Reason: Throttled, Exit Code: 0" },
      { id: "c", text: "Reason: OOMKilled, Exit Code: 137" },
      { id: "d", text: "Reason: Completed, Exit Code: 143" },
    ],
    correctOptionId: "c",
    explanation:
      "Memory cannot be throttled, so the kernel's OOM killer kills the process with SIGKILL. 137 is 128 + 9 (SIGKILL), and the reason is OOMKilled.",
  },
  {
    id: "resources-cpu-units",
    topic: "Units",
    difficulty: "beginner",
    question: "Which CPU value is the same as 0.25?",
    options: [
      { id: "a", text: "25m" },
      { id: "b", text: "2500m" },
      { id: "c", text: "0.25Mi" },
      { id: "d", text: "250m" },
    ],
    correctOptionId: "d",
    explanation: "1 CPU is 1000 millicores, so 0.25 is 250m. Mi is a memory suffix and has no meaning for CPU.",
  },
  {
    id: "resources-memory-units",
    topic: "Units",
    difficulty: "intermediate",
    question: "How do 1Gi and 1G compare?",
    options: [
      { id: "a", text: "1Gi is 1024³ bytes and 1G is 1000³ bytes, so 1Gi is larger" },
      { id: "b", text: "They are the same; the i is optional" },
      { id: "c", text: "1G is larger because it counts gigabits" },
      { id: "d", text: "1G is not a valid memory quantity" },
    ],
    correctOptionId: "a",
    explanation:
      "Ki, Mi, and Gi are powers of 1024; k, M, and G are powers of 1000. 1Gi is 1,073,741,824 bytes and 1G is 1,000,000,000 bytes. Both are valid.",
  },
  {
    id: "resources-memory-m",
    topic: "Units",
    difficulty: "intermediate",
    question: "A manifest sets memory: 512m. What does Kubernetes read?",
    options: [
      { id: "a", text: "512 megabytes" },
      { id: "b", text: "512 mebibytes" },
      { id: "c", text: "0.512 bytes, which is almost certainly a mistake" },
      { id: "d", text: "512 millicores of CPU" },
    ],
    correctOptionId: "c",
    explanation:
      "m is the milli suffix, so 512m means 0.512 of the unit, and the unit for memory is bytes. Use Mi or M for memory. The field is memory, so it is never read as CPU.",
  },
  {
    id: "resources-scheduler-usage",
    topic: "Scheduling",
    difficulty: "intermediate",
    question:
      "A worker has 4Gi allocatable memory. Its Pods request 3.5Gi in total but use only 600Mi. Will a new Pod requesting 1Gi be placed there?",
    options: [
      { id: "a", text: "Yes, because 600Mi + 1Gi is well under 4Gi" },
      { id: "b", text: "Yes, but only if the new Pod has no limit" },
      { id: "c", text: "Only after the scheduler measures usage with metrics-server" },
      { id: "d", text: "No, because 3.5Gi + 1Gi of requests exceeds 4Gi" },
    ],
    correctOptionId: "d",
    explanation:
      "The scheduler compares the sum of requests with allocatable. Actual usage is not part of the check, so the node is full for a 1Gi request.",
  },
  {
    id: "resources-failedscheduling",
    topic: "Scheduling",
    difficulty: "beginner",
    question: "A Pod stays Pending with a FailedScheduling event that says 2 Insufficient memory. What is the most likely cause?",
    options: [
      { id: "a", text: "The image is too large to pull" },
      { id: "b", text: "Its memory request is more than any eligible node has left unrequested" },
      { id: "c", text: "Its memory limit is lower than the app needs" },
      { id: "d", text: "The node ran out of memory and killed it" },
    ],
    correctOptionId: "b",
    explanation:
      "Insufficient memory is a scheduler filter: on those two nodes the existing requests plus this Pod's request exceed allocatable. A low limit causes OOM kills after the Pod runs, not Pending.",
  },
  {
    id: "resources-allocatable",
    topic: "Scheduling",
    difficulty: "intermediate",
    question: "What is a node's allocatable?",
    options: [
      { id: "a", text: "The memory and CPU currently unused on the node" },
      { id: "b", text: "The node's hardware capacity" },
      { id: "c", text: "Capacity minus what is reserved for the system, the kubelet, and the eviction threshold" },
      { id: "d", text: "The sum of the limits of the Pods on the node" },
    ],
    correctOptionId: "c",
    explanation:
      "Allocatable is what Pods may claim with requests. It is capacity minus the reservations that keep the node itself running. It does not change with current usage.",
  },
  {
    id: "resources-overcommit",
    topic: "Scheduling",
    difficulty: "advanced",
    question: "kubectl describe node shows memory Limits at 130%. What does that mean?",
    options: [
      { id: "a", text: "The node is broken and will be cordoned" },
      { id: "b", text: "Requests on the node exceed allocatable" },
      { id: "c", text: "The Pods are using 130% of the node's memory" },
      { id: "d", text: "The limits of its Pods add up to more than allocatable, which is allowed overcommit" },
    ],
    correctOptionId: "d",
    explanation:
      "The scheduler only sums requests, so limits can add up to more than the node has. If many Pods use memory up to their limits at once, the node comes under memory pressure and evicts.",
  },
  {
    id: "resources-only-limit",
    topic: "Requests and limits",
    difficulty: "intermediate",
    question: "A container sets limits.memory: 512Mi and no request. What memory request does it get?",
    options: [
      { id: "a", text: "512Mi, copied from the limit" },
      { id: "b", text: "0, so the scheduler ignores its memory" },
      { id: "c", text: "Half the limit, 256Mi" },
      { id: "d", text: "The Pod is rejected for missing a request" },
    ],
    correctOptionId: "a",
    explanation:
      "When a container sets a limit but no request for a resource, Kubernetes uses the limit as the request.",
  },
  {
    id: "resources-qos-guaranteed",
    topic: "QoS",
    difficulty: "beginner",
    question: "Which Pod has QoS class Guaranteed?",
    options: [
      { id: "a", text: "One container with only CPU and memory requests" },
      { id: "b", text: "One container with CPU and memory limits, and requests equal to those limits" },
      { id: "c", text: "One container with no resources at all" },
      { id: "d", text: "One container with a memory limit and request equal, but no CPU values" },
    ],
    correctOptionId: "b",
    explanation:
      "Guaranteed needs both CPU and memory limits in every container, with requests equal to limits. Missing CPU values makes it Burstable; no values at all makes it BestEffort.",
  },
  {
    id: "resources-qos-besteffort",
    topic: "QoS",
    difficulty: "intermediate",
    question: "Under memory pressure, which Pods does the kubelet evict first?",
    options: [
      { id: "a", text: "Guaranteed Pods, because they reserve the most" },
      { id: "b", text: "The newest Pods, regardless of resources" },
      { id: "c", text: "Pods using more memory than they request, which always includes BestEffort Pods" },
      { id: "d", text: "Pods with the highest CPU usage" },
    ],
    correctOptionId: "c",
    explanation:
      "The kubelet first considers Pods whose usage exceeds their requests, ordered by priority and then by how far over they are. BestEffort Pods request nothing, so they are always over. Guaranteed Pods go last.",
  },
  {
    id: "resources-qos-burstable",
    topic: "QoS",
    difficulty: "intermediate",
    question: "A Pod has two containers. One has requests equal to limits for CPU and memory; the other sets nothing. What is its QoS class?",
    options: [
      { id: "a", text: "Guaranteed" },
      { id: "b", text: "BestEffort" },
      { id: "c", text: "Each container gets its own class" },
      { id: "d", text: "Burstable" },
    ],
    correctOptionId: "d",
    explanation:
      "QoS is per Pod. Guaranteed needs every container to qualify, and BestEffort needs every container to set nothing. Anything in between is Burstable.",
  },
  {
    id: "resources-limitrange-default",
    topic: "LimitRange",
    difficulty: "intermediate",
    question: "A namespace has a LimitRange with default and defaultRequest set. A Pod is created with no resources. What happens?",
    options: [
      { id: "a", text: "The Pod is rejected for missing values" },
      { id: "b", text: "The Pod gets the defaultRequest as its requests and the default as its limits" },
      { id: "c", text: "The Pod runs as BestEffort; LimitRange only affects new namespaces" },
      { id: "d", text: "The LimitRange edits the Deployment's template" },
    ],
    correctOptionId: "b",
    explanation:
      "LimitRange is applied when the Pod is created and fills in missing values on the Pod itself. The Deployment template is not changed, and Pods that already exist are not touched.",
  },
  {
    id: "resources-limitrange-reject",
    topic: "LimitRange",
    difficulty: "advanced",
    question:
      "A LimitRange sets max memory 1Gi per container. A Deployment's template asks for a 2Gi limit. What do you see after applying it?",
    options: [
      { id: "a", text: "kubectl apply fails with a Forbidden error" },
      { id: "b", text: "The Pods are created with the limit lowered to 1Gi" },
      { id: "c", text: "The Deployment is created, no Pods appear, and the ReplicaSet has a FailedCreate event" },
      { id: "d", text: "The Pods run and are OOM killed at 1Gi" },
    ],
    correctOptionId: "c",
    explanation:
      "The LimitRange checks Pods, not Deployments. The Deployment and ReplicaSet are created, but each Pod the ReplicaSet tries to make is rejected, which is recorded as a FailedCreate event on the ReplicaSet.",
  },
  {
    id: "resources-quota-forces",
    topic: "ResourceQuota",
    difficulty: "intermediate",
    question: "A ResourceQuota sets limits.memory: 8Gi. A Pod with no memory limit is created and there is no LimitRange. What happens?",
    options: [
      { id: "a", text: "It is rejected with must specify limits.memory" },
      { id: "b", text: "It is admitted and counts as 0 against the quota" },
      { id: "c", text: "It is admitted with a limit of 8Gi" },
      { id: "d", text: "It is admitted as BestEffort and evicted first" },
    ],
    correctOptionId: "a",
    explanation:
      "A quota cannot count a value that is not there, so once a quota covers a compute resource, every new Pod must declare it. A LimitRange with defaults is the usual way to make that automatic.",
  },
  {
    id: "resources-quota-scope",
    topic: "ResourceQuota",
    difficulty: "beginner",
    question: "What does a ResourceQuota limit?",
    options: [
      { id: "a", text: "The resources a single container may use" },
      { id: "b", text: "The resources of one node" },
      { id: "c", text: "How fast Pods are created" },
      { id: "d", text: "Totals for one namespace, such as summed requests and object counts" },
    ],
    correctOptionId: "d",
    explanation:
      "A ResourceQuota is a budget for a namespace: the sum of requests and limits of its Pods, and counts of objects. Per-container bounds are LimitRange's job.",
  },
  {
    id: "resources-top",
    topic: "Observing",
    difficulty: "beginner",
    question: "On a real cluster, kubectl top pods returns error: Metrics API not available. What is missing?",
    options: [
      { id: "a", text: "A LimitRange in the namespace" },
      { id: "b", text: "metrics-server" },
      { id: "c", text: "Resource requests on the Pods" },
      { id: "d", text: "The kubelet on the control plane" },
    ],
    correctOptionId: "b",
    explanation:
      "kubectl top reads the Metrics API, which metrics-server provides by collecting usage from each kubelet. Requests and LimitRanges have nothing to do with it.",
  },
  {
    id: "resources-right-size",
    topic: "Right-sizing",
    difficulty: "intermediate",
    question: "A service uses about 120Mi of memory at peak but requests 2Gi. What is the main cost?",
    options: [
      { id: "a", text: "It will be OOM killed more often" },
      { id: "b", text: "It is throttled because of the large request" },
      { id: "c", text: "About 1.9Gi per replica is reserved and cannot be requested by any other Pod" },
      { id: "d", text: "It becomes BestEffort" },
    ],
    correctOptionId: "c",
    explanation:
      "Requests reserve capacity on the node for scheduling. Requesting far more than you use wastes that capacity and makes other Pods go Pending on nodes that are mostly idle.",
  },
  {
    id: "resources-yaml-placement",
    topic: "Resources YAML",
    difficulty: "beginner",
    question: "Where does resources go in a Deployment manifest?",
    options: [
      { id: "a", text: "Under spec.template.spec.containers[], in each container" },
      { id: "b", text: "Under spec, next to replicas" },
      { id: "c", text: "Under metadata" },
      { id: "d", text: "Under spec.template.metadata" },
    ],
    correctOptionId: "a",
    explanation:
      "Requests and limits are set per container, so resources sits inside each entry of containers in the Pod template, beside image and ports.",
  },
  {
    id: "resources-yaml-qos",
    topic: "Resources YAML",
    difficulty: "intermediate",
    question:
      "A single-container Pod has resources: { requests: { cpu: 500m, memory: 256Mi }, limits: { cpu: 500m, memory: 256Mi } }. What is its QoS class?",
    options: [
      { id: "a", text: "Burstable" },
      { id: "b", text: "Guaranteed" },
      { id: "c", text: "BestEffort" },
      { id: "d", text: "None until it is scheduled" },
    ],
    correctOptionId: "b",
    explanation:
      "Both CPU and memory have limits, and the requests equal the limits, in its only container. That is the rule for Guaranteed.",
  },
  {
    id: "resources-yaml-limitrange-keys",
    topic: "LimitRange YAML",
    difficulty: "advanced",
    question: "In a LimitRange of type Container, which key sets the limit given to containers that do not declare one?",
    options: [
      { id: "a", text: "defaultLimit" },
      { id: "b", text: "max" },
      { id: "c", text: "limit" },
      { id: "d", text: "default" },
    ],
    correctOptionId: "d",
    explanation:
      "default fills in missing limits and defaultRequest fills in missing requests. max is an upper bound that rejects larger values; it does not fill anything in. defaultLimit and limit are not LimitRange keys.",
  },
  {
    id: "resources-yaml-quota-key",
    topic: "ResourceQuota YAML",
    difficulty: "intermediate",
    question: "Which entry under a ResourceQuota's spec.hard caps the total memory requested in the namespace at 4Gi?",
    options: [
      { id: "a", text: "memory: 4Gi under limits" },
      { id: "b", text: "maxMemory: 4Gi" },
      { id: "c", text: "requests.memory: 4Gi" },
      { id: "d", text: "resources.memory: 4Gi" },
    ],
    correctOptionId: "c",
    explanation:
      "Quota keys for compute are requests.cpu, requests.memory, limits.cpu, and limits.memory, written flat under hard. The other forms are not valid quota keys.",
  },
  {
    id: "resources-yaml-cpu-quote",
    topic: "Resources YAML",
    difficulty: "beginner",
    question: "Which container resources block requests half a core and 128 mebibytes?",
    options: [
      { id: "a", text: "requests: { cpu: 500m, memory: 128Mi }" },
      { id: "b", text: "requests: { cpu: 50m, memory: 128m }" },
      { id: "c", text: "limits: { cpu: 0.5, memory: 128Mi }" },
      { id: "d", text: "requests: { cpu: 5, memory: 128M }" },
    ],
    correctOptionId: "a",
    explanation:
      "500m is half a core and 128Mi is 128 mebibytes, both under requests. 50m is a twentieth of a core and 128m of memory is a fraction of a byte; limits sets the ceiling, not the request; 5 is five cores and 128M is in powers of 1000.",
  },
];
