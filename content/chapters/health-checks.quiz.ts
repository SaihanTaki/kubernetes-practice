import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "health-checks-liveness-fails",
    topic: "Probes",
    difficulty: "beginner",
    question: "A container's liveness probe fails failureThreshold times in a row. What does Kubernetes do?",
    options: [
      { id: "a", text: "Deletes the Pod and lets the ReplicaSet create a new one" },
      { id: "b", text: "The kubelet kills the container and restarts it in the same Pod" },
      { id: "c", text: "Removes the Pod from Service endpoints and waits" },
      { id: "d", text: "Moves the Pod to another node" },
    ],
    correctOptionId: "b",
    explanation:
      "Liveness controls restarts. The kubelet kills the container and starts it again according to restartPolicy. The Pod keeps its name and its RESTARTS count goes up.",
  },
  {
    id: "health-checks-readiness-fails",
    topic: "Probes",
    difficulty: "beginner",
    question: "A Pod's readiness probe starts failing. What happens?",
    options: [
      { id: "a", text: "The container is restarted" },
      { id: "b", text: "The Pod is deleted" },
      { id: "c", text: "The Pod is taken out of Service endpoints but keeps running" },
      { id: "d", text: "Nothing until the liveness probe also fails" },
    ],
    correctOptionId: "c",
    explanation:
      "Readiness controls traffic only. A not-ready Pod stays Running with READY 0/1 and is removed from the endpoints of every Service that selects it. Nothing is restarted.",
  },
  {
    id: "health-checks-startup-purpose",
    topic: "Probes",
    difficulty: "beginner",
    question: "What does a startup probe do while it has not yet succeeded?",
    options: [
      { id: "a", text: "Holds off the liveness and readiness probes" },
      { id: "b", text: "Sends traffic to the Pod at a reduced rate" },
      { id: "c", text: "Pulls the container image" },
      { id: "d", text: "Runs once and is then replaced by the readiness probe after initialDelaySeconds" },
    ],
    correctOptionId: "a",
    explanation:
      "Until the startup probe passes, the kubelet does not run liveness or readiness checks. That lets a slow-starting app boot without being killed by liveness. If the startup probe itself fails failureThreshold times, the container is restarted.",
  },
  {
    id: "health-checks-http-success",
    topic: "Probes",
    difficulty: "intermediate",
    question: "Which HTTP responses count as success for an httpGet probe?",
    options: [
      { id: "a", text: "Only 200" },
      { id: "b", text: "Any response at all, including 500" },
      { id: "c", text: "200 to 299 only" },
      { id: "d", text: "Any status code from 200 up to and including 399" },
    ],
    correctOptionId: "d",
    explanation:
      "The kubelet treats any status code greater than or equal to 200 and less than 400 as success. A 404 or 500 is a failure, as is a timeout or a refused connection.",
  },
  {
    id: "health-checks-exec-success",
    topic: "Probes",
    difficulty: "beginner",
    question: "When does an exec probe pass?",
    options: [
      { id: "a", text: "When the command prints OK" },
      { id: "b", text: "When the command finishes within periodSeconds" },
      { id: "c", text: "When the command exits with status 0" },
      { id: "d", text: "When the command writes nothing to stderr" },
    ],
    correctOptionId: "c",
    explanation:
      "The kubelet runs the command inside the container and looks only at its exit status. Exit 0 is success; any other code is failure. Output is ignored.",
  },
  {
    id: "health-checks-liveness-dependency",
    topic: "Probes",
    difficulty: "intermediate",
    question:
      "Every replica's liveness probe calls the database and fails if it cannot reach it. The database goes down for two minutes. What is the likely result?",
    options: [
      { id: "a", text: "Every replica restarts, possibly repeatedly, even though restarting cannot fix the database" },
      { id: "b", text: "Only the replica that first noticed the outage restarts" },
      { id: "c", text: "Kubernetes pauses liveness checks while a dependency is down" },
      { id: "d", text: "The Pods are marked not ready and nothing restarts" },
    ],
    correctOptionId: "a",
    explanation:
      "Liveness should only ask whether this process is stuck. Checking a shared dependency makes all replicas fail at once, so they all restart together and can land in CrashLoopBackOff while the database recovers.",
  },
  {
    id: "health-checks-yaml-location",
    topic: "Probe YAML",
    difficulty: "beginner",
    question: "Where does livenessProbe go in a Deployment manifest?",
    options: [
      { id: "a", text: "spec.livenessProbe" },
      { id: "b", text: "metadata.livenessProbe" },
      { id: "c", text: "spec.template.spec.livenessProbe" },
      { id: "d", text: "Inside a container: spec.template.spec.containers[].livenessProbe" },
    ],
    correctOptionId: "d",
    explanation:
      "Probes are set per container, because each container is checked and restarted on its own. They sit next to image and ports in the container entry of the Pod template.",
  },
  {
    id: "health-checks-restart-time",
    topic: "Probe timing",
    difficulty: "intermediate",
    question:
      "A liveness probe has periodSeconds: 10 and failureThreshold: 3. The app hangs. Roughly how long until the container is restarted?",
    options: [
      { id: "a", text: "10 seconds" },
      { id: "b", text: "About 30 seconds" },
      { id: "c", text: "3 seconds" },
      { id: "d", text: "It is never restarted; only readiness changes" },
    ],
    correctOptionId: "b",
    explanation:
      "The kubelet needs 3 consecutive failures, one every 10 seconds, so about 30 seconds, plus up to one timeoutSeconds and the wait until the next scheduled probe.",
  },
  {
    id: "health-checks-success-threshold",
    topic: "Probe YAML",
    difficulty: "advanced",
    question: "Which value is valid for successThreshold on a livenessProbe?",
    options: [
      { id: "a", text: "Only 1" },
      { id: "b", text: "Any number from 1 to 10" },
      { id: "c", text: "0, to disable success checks" },
      { id: "d", text: "Any value, but it must equal failureThreshold" },
    ],
    correctOptionId: "a",
    explanation:
      "For liveness and startup probes the API server rejects any successThreshold other than 1. Only readiness probes may require several successes in a row.",
  },
  {
    id: "health-checks-startup-budget",
    topic: "Probe YAML",
    difficulty: "intermediate",
    question: "A startupProbe has periodSeconds: 10 and failureThreshold: 30. How long can the app take to start before it is restarted?",
    options: [
      { id: "a", text: "30 seconds" },
      { id: "b", text: "40 seconds" },
      { id: "c", text: "About 300 seconds (5 minutes)" },
      { id: "d", text: "Unlimited, startup probes never cause restarts" },
    ],
    correctOptionId: "c",
    explanation:
      "The startup budget is failureThreshold times periodSeconds: 30 × 10 = 300 seconds. If the probe has not passed by then, the container is killed and restarted.",
  },
  {
    id: "health-checks-event-404",
    topic: "Debugging probes",
    difficulty: "beginner",
    question: 'kubectl describe pod shows "Readiness probe failed: HTTP probe failed with statuscode: 404". What is the most likely cause?',
    options: [
      { id: "a", text: "The container image could not be pulled" },
      { id: "b", text: "The probe's path does not exist in the app" },
      { id: "c", text: "Nothing is listening on the probe's port" },
      { id: "d", text: "The node is out of memory" },
    ],
    correctOptionId: "b",
    explanation:
      "A 404 means the kubelet connected and the app answered, but not on that path. A wrong port gives connection refused instead, and a pull problem would show ImagePullBackOff.",
  },
  {
    id: "health-checks-event-refused",
    topic: "Debugging probes",
    difficulty: "intermediate",
    question:
      'The app listens on 8080. Events show "Readiness probe failed: Get "http://10.244.1.7:80/ready": dial tcp 10.244.1.7:80: connect: connection refused". What is wrong?',
    options: [
      { id: "a", text: "The /ready path is missing" },
      { id: "b", text: "The Service has no selector" },
      { id: "c", text: "The probe timeout is too short" },
      { id: "d", text: "The probe targets port 80 instead of the container port 8080" },
    ],
    correctOptionId: "d",
    explanation:
      "Connection refused means nothing listens on that port in the container. The probe goes straight to the Pod IP, so it must use the port the app listens on, 8080.",
  },
  {
    id: "health-checks-ready-zero",
    topic: "Debugging probes",
    difficulty: "beginner",
    question: "kubectl get pods shows STATUS Running, READY 0/1, RESTARTS 0 for several minutes. Which probe is most likely failing?",
    options: [
      { id: "a", text: "Liveness" },
      { id: "b", text: "None; the image is still downloading" },
      { id: "c", text: "Startup, which never restarts" },
      { id: "d", text: "Readiness" },
    ],
    correctOptionId: "d",
    explanation:
      "Running with no restarts means the container is alive and liveness is fine. Not ready is the readiness probe's verdict. A failing startup or liveness probe would increase RESTARTS.",
  },
  {
    id: "health-checks-crashloop",
    topic: "Debugging probes",
    difficulty: "intermediate",
    question: "A Pod's RESTARTS keeps climbing and its status alternates with CrashLoopBackOff, but the app logs show no crash. What should you check first?",
    options: [
      { id: "a", text: "The liveness (or startup) probe, in kubectl describe pod events" },
      { id: "b", text: "The Service's selector" },
      { id: "c", text: "The readiness probe's successThreshold" },
      { id: "d", text: "The Deployment's maxSurge" },
    ],
    correctOptionId: "a",
    explanation:
      "Restarts without a crash usually mean the kubelet is killing the container because liveness or startup checks fail. Events show lines such as \"Liveness probe failed\" and \"Container api failed liveness probe, will be restarted\".",
  },
  {
    id: "health-checks-rollout",
    topic: "Probes and rollouts",
    difficulty: "intermediate",
    question: "During a rolling update, the new Pods never pass their readiness probe. With maxUnavailable: 0, what happens?",
    options: [
      { id: "a", text: "The new Pods receive traffic anyway once they are Running" },
      { id: "b", text: "The Deployment deletes the old ReplicaSet" },
      { id: "c", text: "The rollout stalls and the old Pods keep serving traffic" },
      { id: "d", text: "The Deployment rolls back automatically" },
    ],
    correctOptionId: "c",
    explanation:
      "A rollout only removes old Pods as new ones become ready. Not-ready new Pods are not counted as available, so the rollout stops. Kubernetes does not roll back on its own; you run kubectl rollout undo.",
  },
  {
    id: "health-checks-yaml-tcp",
    topic: "Probe YAML",
    difficulty: "beginner",
    question: "Which snippet checks that something accepts TCP connections on port 6379?",
    options: [
      { id: "a", text: "tcpSocket: 6379" },
      { id: "b", text: "tcpSocket: { port: 6379 }" },
      { id: "c", text: "httpGet: { port: 6379, protocol: TCP }" },
      { id: "d", text: "exec: { port: 6379 }" },
    ],
    correctOptionId: "b",
    explanation:
      "tcpSocket is a map with a port field. The probe passes if a TCP connection opens. httpGet would send an HTTP request, and exec takes a command, not a port.",
  },
  {
    id: "health-checks-default-period",
    topic: "Probe timing",
    difficulty: "intermediate",
    question: "If you leave periodSeconds out of a probe, how often does the kubelet run it?",
    options: [
      { id: "a", text: "Every second" },
      { id: "b", text: "Only once, at container start" },
      { id: "c", text: "Every 10 seconds" },
      { id: "d", text: "Every 30 seconds" },
    ],
    correctOptionId: "c",
    explanation:
      "The defaults are periodSeconds 10, timeoutSeconds 1, failureThreshold 3, successThreshold 1, and initialDelaySeconds 0.",
  },
  {
    id: "health-checks-timeout",
    topic: "Probe timing",
    difficulty: "advanced",
    question:
      "A liveness endpoint usually answers in 50 ms but takes 1.5 s under heavy load. No timeoutSeconds is set. What happens under load?",
    options: [
      { id: "a", text: "The kubelet waits as long as the endpoint needs" },
      { id: "b", text: "Only readiness is affected" },
      { id: "c", text: "The probe is skipped while CPU is high" },
      { id: "d", text: "Probes time out after the default 1 second and count as failures, so busy containers get restarted" },
    ],
    correctOptionId: "d",
    explanation:
      "timeoutSeconds defaults to 1. A slow answer is a failure, and enough of them restart the container exactly when it is busiest, which makes the load worse for the others.",
  },
  {
    id: "health-checks-grpc",
    topic: "Probes",
    difficulty: "advanced",
    question: "What does a grpc probe need from the application?",
    options: [
      { id: "a", text: "It must implement the gRPC Health Checking Protocol on the probed port" },
      { id: "b", text: "It must serve an HTTP /healthz path" },
      { id: "c", text: "It must ship a grpc_health_probe binary in the image" },
      { id: "d", text: "Nothing; any open gRPC port passes" },
    ],
    correctOptionId: "a",
    explanation:
      "The built-in grpc probe calls the standard grpc.health.v1 Health service. The separate grpc_health_probe binary was the workaround used with exec probes before grpc probes existed.",
  },
  {
    id: "health-checks-yaml-port",
    topic: "Probe YAML",
    difficulty: "intermediate",
    question:
      "A Service maps port: 80 to targetPort: 8080, and the app listens on 8080. Which readinessProbe is correct?",
    options: [
      { id: "a", text: "httpGet: { path: /ready, port: 80 }" },
      { id: "b", text: "httpGet: { path: /ready, port: 8080 }" },
      { id: "c", text: "httpGet: { path: /ready, service: api }" },
      { id: "d", text: "httpGet: { path: api:80/ready }" },
    ],
    correctOptionId: "b",
    explanation:
      "The kubelet probes the container directly on the Pod IP, not through the Service, so the port must be the one the container listens on. Port 80 only exists on the Service.",
  },
  {
    id: "health-checks-describe",
    topic: "Debugging probes",
    difficulty: "beginner",
    question: "Which command shows probe failures for a Pod along with the probe settings?",
    options: [
      { id: "a", text: "kubectl describe pod <name>" },
      { id: "b", text: "kubectl get deployment <name>" },
      { id: "c", text: "kubectl get endpoints" },
      { id: "d", text: "kubectl scale deployment <name> --replicas=0" },
    ],
    correctOptionId: "a",
    explanation:
      "describe pod lists each container's Liveness, Readiness and Startup settings and, under Events, every Unhealthy warning with the probe's error message.",
  },
  {
    id: "health-checks-yaml-success-threshold",
    topic: "Probe YAML",
    difficulty: "intermediate",
    question: "A readinessProbe has successThreshold: 2. What does that mean?",
    options: [
      { id: "a", text: "The probe runs twice per period" },
      { id: "b", text: "Two containers must pass before the Pod is ready" },
      { id: "c", text: "The container restarts after 2 successes" },
      { id: "d", text: "After failing, the Pod needs 2 passes in a row before it is ready again" },
    ],
    correctOptionId: "d",
    explanation:
      "successThreshold is how many consecutive successes it takes to go from failed back to passing. It is a way to stop a flapping Pod from rejoining the Service on one lucky check.",
  },
  {
    id: "health-checks-no-probes",
    topic: "Probes",
    difficulty: "beginner",
    question: "A container has no readiness probe and no liveness probe. How does Kubernetes treat it?",
    options: [
      { id: "a", text: "It counts as ready as soon as it is running, and it is restarted only when its process exits" },
      { id: "b", text: "It never becomes ready, because a readiness probe is required for Service traffic" },
      { id: "c", text: "The kubelet adds a default httpGet probe on the first container port" },
      { id: "d", text: "The API server rejects the Pod" },
    ],
    correctOptionId: "a",
    explanation:
      "Every probe is optional. Without readiness, a running container counts as ready and gets traffic even if the app is still loading. Without liveness, a hung but running process is never restarted. Kubernetes adds no default probe.",
  },
  {
    id: "health-checks-startup-vs-delay",
    topic: "Probe timing",
    difficulty: "advanced",
    question: "An app needs up to 2 minutes to start. Why use a startupProbe instead of initialDelaySeconds: 120 on the livenessProbe?",
    options: [
      { id: "a", text: "initialDelaySeconds is ignored on liveness probes" },
      { id: "b", text: "The delay applies after every restart and waits the full 120 seconds even when the app is up sooner, so hangs during that time go undetected" },
      { id: "c", text: "A startupProbe also makes the image pull faster" },
      { id: "d", text: "initialDelaySeconds cannot be larger than periodSeconds" },
    ],
    correctOptionId: "b",
    explanation:
      "A startup probe passes as soon as the app is up, then liveness takes over. A large initialDelaySeconds always waits the full time after each container start, so a hang in that window goes unnoticed. initialDelaySeconds does work on liveness and has no such upper limit.",
  },
  {
    id: "health-checks-same-endpoint",
    topic: "Probes",
    difficulty: "intermediate",
    question: "Readiness and liveness both call /healthz with the same settings. The app gets busy and /healthz slows down. What goes wrong?",
    options: [
      { id: "a", text: "Nothing; Kubernetes runs only one of the two probes when they match" },
      { id: "b", text: "The Pod is removed from endpoints and never restarted" },
      { id: "c", text: "Both probes fail together, so the busy Pod is restarted instead of only being taken out of rotation" },
      { id: "d", text: "The API server rejects two probes with the same path" },
    ],
    correctOptionId: "c",
    explanation:
      "With identical settings both probes reach failureThreshold at the same time, so the container is killed although it only needed a break from traffic. Use a separate readiness path, or give liveness a higher failureThreshold so readiness reacts first.",
  },
  {
    id: "health-checks-empty-endpoints",
    topic: "Debugging probes",
    difficulty: "intermediate",
    question: "kubectl get endpoints api shows no addresses. Two Pods match the Service's selector and show Running, READY 0/1. Where is the problem?",
    options: [
      { id: "a", text: "The Service selector does not match the Pods" },
      { id: "b", text: "The readiness probe is failing, so the Pods are left out of the endpoints" },
      { id: "c", text: "The liveness probe is failing" },
      { id: "d", text: "The Service needs type LoadBalancer to get endpoints" },
    ],
    correctOptionId: "b",
    explanation:
      "Endpoints only list Pods that match the selector and are ready. The Pods match and are running with 0/1, so readiness is the cause, not the selector. A failing liveness probe would show climbing restarts.",
  },
  {
    id: "health-checks-event-timeout",
    topic: "Debugging probes",
    difficulty: "intermediate",
    question: "A probe failure event ends with context deadline exceeded. What does it mean?",
    options: [
      { id: "a", text: "The probe path returned 404" },
      { id: "b", text: "Nothing listens on the probe port" },
      { id: "c", text: "The app did not answer within timeoutSeconds" },
      { id: "d", text: "The startup budget has run out" },
    ],
    correctOptionId: "c",
    explanation:
      "context deadline exceeded or Client.Timeout exceeded means the check took longer than timeoutSeconds. A wrong path shows statuscode: 404, and a wrong port shows connection refused.",
  },
];
