import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "pods-shared-network",
    topic: "Pods",
    difficulty: "beginner",
    question: "A Pod runs two containers. How can the first container reach a server listening on port 9000 in the second?",
    options: [
      { id: "a", text: "localhost:9000, because both containers share the Pod's network namespace" },
      { id: "b", text: "Only through a Service created for the second container" },
      { id: "c", text: "Each container has its own IP, so it must use the second container's IP" },
      { id: "d", text: "Containers in the same Pod cannot talk to each other" },
    ],
    correctOptionId: "a",
    explanation:
      "All containers in a Pod share one network namespace and one IP address, so they reach each other on localhost. This is also why two containers in one Pod cannot listen on the same port.",
  },
  {
    id: "pods-standalone-delete",
    topic: "Pods",
    difficulty: "beginner",
    question: "You created a Pod directly with no Deployment or ReplicaSet, then deleted it. What happens?",
    options: [
      { id: "a", text: "Kubernetes recreates it on another node" },
      { id: "b", text: "The kubelet restarts it with the same name" },
      { id: "c", text: "It is gone. Nothing recreates a standalone Pod" },
      { id: "d", text: "The scheduler recreates it once the node has free resources" },
    ],
    correctOptionId: "c",
    explanation:
      "Only a controller such as a ReplicaSet recreates Pods. restartPolicy restarts containers inside a Pod that still exists; it does not bring back a deleted Pod.",
  },
  {
    id: "pods-crashloop",
    topic: "Pods",
    difficulty: "intermediate",
    question: "kubectl get pods shows a Pod with STATUS CrashLoopBackOff and RESTARTS 6. What does this mean?",
    options: [
      { id: "a", text: "The image could not be pulled from the registry" },
      { id: "b", text: "The container keeps exiting, and the kubelet waits longer between each restart" },
      { id: "c", text: "The scheduler has not found a node for the Pod yet" },
      { id: "d", text: "The Pod finished its work successfully six times" },
    ],
    correctOptionId: "b",
    explanation:
      "CrashLoopBackOff means the container started, exited, and was restarted repeatedly, with a growing back-off delay. A pull failure shows ImagePullBackOff, and an unscheduled Pod stays Pending.",
  },
  {
    id: "pods-yaml-limits",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A container sets resources.limits.memory: \"256Mi\" and tries to use 400Mi. What happens?",
    options: [
      { id: "a", text: "The scheduler moves the Pod to a node with more memory" },
      { id: "b", text: "Nothing, limits are only used for scheduling" },
      { id: "c", text: "The container is killed for exceeding its memory limit (OOMKilled)" },
      { id: "d", text: "Kubernetes raises the limit to 400Mi automatically" },
    ],
    correctOptionId: "c",
    explanation:
      "Memory limits are enforced at runtime: a container that goes over is killed and shows OOMKilled, then restartPolicy decides whether it restarts. The scheduler uses requests, not limits, to place Pods.",
  },
  {
    id: "pods-what-is",
    topic: "Pods",
    difficulty: "beginner",
    question: "What is the smallest unit that Kubernetes schedules onto a node?",
    options: [
      { id: "a", text: "A single container" },
      { id: "b", text: "A Deployment" },
      { id: "c", text: "A ReplicaSet" },
      { id: "d", text: "A Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "Kubernetes never schedules a bare container: it schedules a Pod, which holds one or more containers. Deployments and ReplicaSets are controllers that create Pods.",
  },
  {
    id: "pods-yaml-shared-volume",
    topic: "Pod YAML",
    difficulty: "beginner",
    question: "Two containers in one Pod need to read and write the same directory. How do you set this up in the manifest?",
    options: [
      { id: "a", text: "Nothing is needed, containers in a Pod share one filesystem" },
      { id: "b", text: "Declare a volume under spec.volumes and add a volumeMounts entry for it in both containers" },
      { id: "c", text: "Expose the directory with a containerPort in the first container" },
      { id: "d", text: "Create a Service that points at the directory" },
    ],
    correctOptionId: "b",
    explanation:
      "Each container has its own filesystem. Files are shared by declaring a volume at the Pod level and mounting it into each container that needs it.",
  },
  {
    id: "pods-sidecar",
    topic: "Pods",
    difficulty: "beginner",
    question: "Which pair of containers is a good fit for running together in one Pod?",
    options: [
      { id: "a", text: "A web app and a log shipper that reads the app's log directory" },
      { id: "b", text: "A web app and the database it stores data in" },
      { id: "c", text: "A frontend and a backend that need to scale separately" },
      { id: "d", text: "Three copies of the same app, to handle more traffic" },
    ],
    correctOptionId: "a",
    explanation:
      "Put containers together only when they must share files or localhost on the same node, like a sidecar log shipper. An app and its database would be scaled and restarted together, and more copies of an app means more Pods, not more containers.",
  },
  {
    id: "pods-node-fails",
    topic: "Pods",
    difficulty: "intermediate",
    question: "A standalone Pod (no controller) is running on node-2. node-2 loses power and does not come back. What happens to the Pod?",
    options: [
      { id: "a", text: "The scheduler moves it to a healthy node with the same name" },
      { id: "b", text: "It is not rescheduled anywhere, so the app stays down until someone recreates it" },
      { id: "c", text: "The kubelet on another node starts a copy of it" },
      { id: "d", text: "Its restartPolicy makes Kubernetes start it on another node" },
    ],
    correctOptionId: "b",
    explanation:
      "A Pod is bound to one node for its whole life and is never moved. Only a controller such as a ReplicaSet creates a replacement Pod; restartPolicy only restarts containers inside a Pod that still exists.",
  },
  {
    id: "pods-phases",
    topic: "Pods",
    difficulty: "intermediate",
    question: "Which of these is NOT one of the Pod phases (status.phase)?",
    options: [
      { id: "a", text: "Pending" },
      { id: "b", text: "Succeeded" },
      { id: "c", text: "Unknown" },
      { id: "d", text: "CrashLoopBackOff" },
    ],
    correctOptionId: "d",
    explanation:
      "The Pod phases are Pending, Running, Succeeded, Failed, and Unknown. CrashLoopBackOff is a container waiting reason, which kubectl get pods shows in the STATUS column.",
  },
  {
    id: "pods-imagepull",
    topic: "Pods",
    difficulty: "beginner",
    question: "A new Pod shows STATUS ImagePullBackOff. What is the most likely cause?",
    options: [
      { id: "a", text: "The container starts and then exits with an error" },
      { id: "b", text: "No node has enough CPU for the Pod" },
      { id: "c", text: "The image name or tag is wrong, or the registry needs credentials" },
      { id: "d", text: "The container exceeded its memory limit" },
    ],
    correctOptionId: "c",
    explanation:
      "ImagePullBackOff means the kubelet cannot pull the image and is waiting before trying again. A container that starts and exits shows CrashLoopBackOff instead.",
  },
  {
    id: "pods-container-creating",
    topic: "Pods",
    difficulty: "beginner",
    question: "kubectl get pods shows STATUS ContainerCreating for a Pod. What is happening?",
    options: [
      { id: "a", text: "The scheduler is still looking for a node" },
      { id: "b", text: "The container crashed and is being recreated" },
      { id: "c", text: "The Pod finished and is being cleaned up" },
      { id: "d", text: "The Pod has a node, and the kubelet is pulling images and creating its containers" },
    ],
    correctOptionId: "d",
    explanation:
      "ContainerCreating appears while the Pod is still Pending but already assigned to a node. A Pod waiting for a node shows Pending without this reason.",
  },
  {
    id: "pods-yaml-restartpolicy-default",
    topic: "Pod YAML",
    difficulty: "beginner",
    question: "A Pod manifest does not set spec.restartPolicy. Which value does Kubernetes use?",
    options: [
      { id: "a", text: "Never" },
      { id: "b", text: "OnFailure" },
      { id: "c", text: "Always" },
      { id: "d", text: "None, containers are never restarted without a controller" },
    ],
    correctOptionId: "c",
    explanation:
      "The default is Always, so the kubelet restarts an exited container whatever its exit code. This suits long-running servers.",
  },
  {
    id: "pods-yaml-onfailure",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A single-container Pod has restartPolicy: OnFailure. The container finishes its job and exits with code 0. What happens?",
    options: [
      { id: "a", text: "The container is not restarted and the Pod's phase becomes Succeeded" },
      { id: "b", text: "The container is restarted, because OnFailure restarts on any exit" },
      { id: "c", text: "The Pod's phase becomes Failed" },
      { id: "d", text: "The Pod is deleted automatically" },
    ],
    correctOptionId: "a",
    explanation:
      "OnFailure restarts a container only after a non-zero exit code. Exit code 0 is success, so the container stays stopped and the Pod ends as Succeeded (shown as Completed).",
  },
  {
    id: "pods-yaml-never",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A single-container Pod has restartPolicy: Never. The container exits with code 1. What is the Pod's phase afterwards?",
    options: [
      { id: "a", text: "Running" },
      { id: "b", text: "Failed" },
      { id: "c", text: "Pending" },
      { id: "d", text: "Succeeded" },
    ],
    correctOptionId: "b",
    explanation:
      "With Never the kubelet does not restart the container. Its only container ended with a non-zero code, so the Pod's phase is Failed (shown as Error in kubectl get pods).",
  },
  {
    id: "pods-yaml-requests-scheduling",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question:
      "A node has 800m CPU that no other Pod has requested. A new Pod's only container sets requests.cpu: 500m and limits.cpu: \"2\". Can the scheduler place it on that node?",
    options: [
      { id: "a", text: "No, the limit of 2 CPUs is more than the node has free" },
      { id: "b", text: "No, the scheduler needs both requests and limits to fit" },
      { id: "c", text: "Yes, the scheduler compares the 500m request against the node's free capacity" },
      { id: "d", text: "Yes, but only after the limit is lowered to 800m automatically" },
    ],
    correctOptionId: "c",
    explanation:
      "The scheduler places Pods using requests only. Limits are not checked at scheduling time; they are enforced while the container runs.",
  },
  {
    id: "pods-yaml-cpu-limit",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A container sets limits.cpu: 500m and its process tries to use a full CPU core. What happens?",
    options: [
      { id: "a", text: "The container is throttled so it gets no more than half a core" },
      { id: "b", text: "The container is killed and shows OOMKilled" },
      { id: "c", text: "The Pod is evicted and rescheduled on a bigger node" },
      { id: "d", text: "Nothing, CPU limits are only used for scheduling" },
    ],
    correctOptionId: "a",
    explanation:
      "Going over a CPU limit slows the container down; it is not killed. OOMKilled happens only when a container exceeds its memory limit.",
  },
  {
    id: "pods-yaml-env",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "Where and how do you set the environment variable LOG_LEVEL=debug for a container?",
    options: [
      { id: "a", text: "Under metadata.labels as LOG_LEVEL: debug" },
      { id: "b", text: "Under spec.env as a map: LOG_LEVEL: debug" },
      { id: "c", text: "Under the container's args as LOG_LEVEL: debug" },
      { id: "d", text: "Under the container's env as a list item: - name: LOG_LEVEL, value: \"debug\"" },
    ],
    correctOptionId: "d",
    explanation:
      "env belongs to each container and is a list of entries with name and value fields. There is no Pod-level spec.env, and labels are metadata for selecting objects, not environment variables.",
  },
  {
    id: "pods-backoff",
    topic: "Pods",
    difficulty: "advanced",
    question: "A container with restartPolicy: Always exits right after starting, over and over. How does the kubelet time the restarts?",
    options: [
      { id: "a", text: "It restarts the container immediately every time" },
      { id: "b", text: "It waits longer after each crash, up to a maximum of five minutes" },
      { id: "c", text: "It stops restarting after five attempts and marks the Pod Failed" },
      { id: "d", text: "It asks the scheduler to move the Pod to a different node" },
    ],
    correctOptionId: "b",
    explanation:
      "The kubelet uses an exponential back-off between restarts, capped at five minutes, which is what CrashLoopBackOff reports. With Always it never gives up, and the restarts stay on the same node.",
  },
  {
    id: "pods-yaml-containerport",
    topic: "Pod YAML",
    difficulty: "advanced",
    question: "A container's app listens on port 8080, but the manifest has no ports.containerPort entry. Can another Pod reach it at <pod-ip>:8080?",
    options: [
      { id: "a", text: "No, ports not listed under containerPort are blocked" },
      { id: "b", text: "No, the app is forced to listen on port 80 instead" },
      { id: "c", text: "Only from other containers in the same Pod" },
      { id: "d", text: "Yes, containerPort is mainly informational and does not control which ports are reachable" },
    ],
    correctOptionId: "d",
    explanation:
      "containerPort documents the port and lets you name it, but it does not open or close anything. A process listening on all interfaces is reachable at the Pod IP whether or not the port is listed.",
  },
  {
    id: "pods-controlled-by",
    topic: "Pods",
    difficulty: "advanced",
    question: "kubectl describe pod web-7d9f8-x2kq shows \"Controlled By: ReplicaSet/web-7d9f8\". You delete this Pod. What happens next?",
    options: [
      { id: "a", text: "Nothing, a deleted Pod is gone for good" },
      { id: "b", text: "The kubelet restarts web-7d9f8-x2kq on the same node" },
      { id: "c", text: "The ReplicaSet creates a new Pod with a different generated name" },
      { id: "d", text: "The ReplicaSet is deleted along with the Pod" },
    ],
    correctOptionId: "c",
    explanation:
      "The ReplicaSet notices it has fewer Pods than desired and creates a replacement. The new Pod gets a new name and may land on any suitable node; only standalone Pods stay deleted.",
  },
  {
    id: "pods-yaml-memory-between",
    topic: "Pod YAML",
    difficulty: "advanced",
    question: "A container sets requests.memory: 128Mi and limits.memory: 256Mi. It now uses 200Mi. What happens?",
    options: [
      { id: "a", text: "It keeps running, since usage above the request is allowed up to the limit" },
      { id: "b", text: "It is OOMKilled because it went over its request" },
      { id: "c", text: "Its memory is throttled back down to 128Mi" },
      { id: "d", text: "The scheduler moves the Pod to a node with more memory" },
    ],
    correctOptionId: "a",
    explanation:
      "The request is what the scheduler reserves; the limit is the enforced ceiling. A container is OOMKilled only above its memory limit, and memory cannot be throttled the way CPU can.",
  },
  {
    id: "pods-same-port",
    topic: "Pods",
    difficulty: "advanced",
    question: "A Pod has two containers, and both start a server on port 8080. What happens?",
    options: [
      { id: "a", text: "Kubernetes gives each container its own IP, so both work" },
      { id: "b", text: "One of them fails to bind the port, because they share one network namespace" },
      { id: "c", text: "Kubernetes remaps the second container to a free port" },
      { id: "d", text: "The Pod is rejected by the API server when you apply it" },
    ],
    correctOptionId: "b",
    explanation:
      "Containers in a Pod share one IP and one set of ports, so the second server gets an \"address in use\" error and usually exits. Kubernetes does not remap ports for you.",
  },
  {
    id: "pods-describe",
    topic: "Inspecting Pods",
    difficulty: "beginner",
    question: "A Pod is not Running. Which command shows its waiting reason, restart count, the controller that owns it, and recent events?",
    options: [
      { id: "a", text: "kubectl describe pod <name>" },
      { id: "b", text: "kubectl get pods" },
      { id: "c", text: "kubectl get nodes" },
      { id: "d", text: "kubectl apply -f pod.yaml" },
    ],
    correctOptionId: "a",
    explanation:
      "kubectl describe pod shows the node, image, container state with the waiting reason, Restart Count, Controlled By, and events. kubectl get pods only gives a one-line summary with STATUS and RESTARTS.",
  },
  {
    id: "pods-pending-no-node",
    topic: "Pods",
    difficulty: "intermediate",
    question: "A Pod stays Pending and kubectl describe shows it has no node. What is the most likely reason?",
    options: [
      { id: "a", text: "The image tag is wrong" },
      { id: "b", text: "The container keeps crashing after it starts" },
      { id: "c", text: "The container went over its memory limit" },
      { id: "d", text: "The scheduler cannot find a node with enough unreserved capacity for its requests" },
    ],
    correctOptionId: "d",
    explanation:
      "A Pod with no node has not been scheduled yet, and the scheduler only places it where its requests fit. Image pull failures, crashes, and memory limits all happen after the Pod is on a node.",
  },
  {
    id: "pods-restart-in-place",
    topic: "Pods",
    difficulty: "intermediate",
    question: "A container crashes in a Pod with restartPolicy: Always. Where is it restarted?",
    options: [
      { id: "a", text: "In the same Pod on the same node, and the RESTARTS count goes up" },
      { id: "b", text: "In a new Pod with a new name" },
      { id: "c", text: "On whichever node has the most free memory" },
      { id: "d", text: "Nowhere, until a ReplicaSet creates a new Pod" },
    ],
    correctOptionId: "a",
    explanation:
      "The kubelet restarts the container in place, inside the existing Pod. The Pod keeps its name and node. Creating a new Pod is a controller's job, and only happens when the Pod itself is gone.",
  },
  {
    id: "pods-crashloop-next-step",
    topic: "Pods",
    difficulty: "intermediate",
    question: "A Pod has been in CrashLoopBackOff for an hour. What is the useful next step?",
    options: [
      { id: "a", text: "Wait, because the kubelet will fix it on a later restart" },
      { id: "b", text: "Change restartPolicy to Always so it retries harder" },
      { id: "c", text: "Delete the node the Pod runs on" },
      { id: "d", text: "Read the waiting reason, the events, and the container logs to find why it exits" },
    ],
    correctOptionId: "d",
    explanation:
      "CrashLoopBackOff means restarting has already been tried and did not help. The cause is in the container: a bad command, missing configuration, or an app that exits right away. restartPolicy Always is already what causes the restarts.",
  },
  {
    id: "pods-yaml-env-quote",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "A container's env has an entry with name: PORT and value: 8080, written without quotes. What happens when you apply it?",
    options: [
      { id: "a", text: "It works, because Kubernetes converts the number to a string" },
      { id: "b", text: "It is rejected, because env values must be strings; write value: \"8080\"" },
      { id: "c", text: "The container gets PORT set to an empty string" },
      { id: "d", text: "The entry is skipped silently" },
    ],
    correctOptionId: "b",
    explanation:
      "An env value is a string field. YAML reads 8080 as a number, so the manifest fails to decode. Quote numbers and booleans in env values.",
  },
  {
    id: "pods-containercreating-phase",
    topic: "Pods",
    difficulty: "advanced",
    question: "kubectl get pods shows STATUS ContainerCreating. What is the Pod's status.phase at that moment?",
    options: [
      { id: "a", text: "Running" },
      { id: "b", text: "ContainerCreating" },
      { id: "c", text: "Pending" },
      { id: "d", text: "Unknown" },
    ],
    correctOptionId: "c",
    explanation:
      "ContainerCreating is a STATUS shown while the Pod is still Pending: it has a node, but its containers are not all running yet. It is not a phase of its own. The phase becomes Running once a container starts.",
  },
];
