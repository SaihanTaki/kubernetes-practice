import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "troubleshooting-pending",
    topic: "Pod status",
    difficulty: "beginner",
    question: "A Pod shows STATUS Pending and NODE <none>. Which command shows why?",
    options: [
      { id: "a", text: "kubectl logs <pod>" },
      { id: "b", text: "kubectl describe pod <pod>" },
      { id: "c", text: "kubectl exec <pod> -- env" },
      { id: "d", text: "kubectl rollout undo deployment/<name>" },
    ],
    correctOptionId: "b",
    explanation:
      "A Pending Pod with no node was never scheduled, so no container ran and there are no logs to read or process to exec into. describe pod shows the FailedScheduling event with the reason for each node.",
  },
  {
    id: "troubleshooting-logs-previous",
    topic: "Logs",
    difficulty: "beginner",
    question: "A Pod is in CrashLoopBackOff and kubectl logs shows nothing useful. Which flag shows the output of the container that crashed?",
    options: [
      { id: "a", text: "--previous" },
      { id: "b", text: "--tail=0" },
      { id: "c", text: "-o wide" },
      { id: "d", text: "--all-namespaces" },
    ],
    correctOptionId: "a",
    explanation:
      "Plain kubectl logs reads the current container, which may have just started. --previous reads the last terminated container, which printed the error before exiting. --tail=0 prints no lines at all.",
  },
  {
    id: "troubleshooting-imagepull",
    topic: "Pod status",
    difficulty: "beginner",
    question: "A new Pod using nginx:1.72 shows ImagePullBackOff. What is the most likely cause?",
    options: [
      { id: "a", text: "The node is out of memory" },
      { id: "b", text: "The liveness probe is failing" },
      { id: "c", text: "The image tag does not exist in the registry" },
      { id: "d", text: "A ConfigMap the Pod uses is missing" },
    ],
    correctOptionId: "c",
    explanation:
      "ImagePullBackOff means the kubelet failed to pull the image and is waiting before retrying. A typo in the tag, a wrong repository name, or missing pull credentials are the usual causes. The Failed event in describe pod names the exact image.",
  },
  {
    id: "troubleshooting-ccce",
    topic: "Pod status",
    difficulty: "beginner",
    question: "What does CreateContainerConfigError usually mean?",
    options: [
      { id: "a", text: "The image could not be pulled" },
      { id: "b", text: "The app exited with code 1" },
      { id: "c", text: "No node has enough CPU" },
      { id: "d", text: "env or envFrom refers to a ConfigMap, Secret, or key that does not exist" },
    ],
    correctOptionId: "d",
    explanation:
      "The kubelet builds the container's environment before creating it. If a referenced ConfigMap, Secret, or key is missing, the container is never created. Creating the missing object fixes it without a restart.",
  },
  {
    id: "troubleshooting-oom",
    topic: "Pod status",
    difficulty: "intermediate",
    question: "describe pod shows Last State: Terminated, Reason: OOMKilled, Exit Code: 137. What fixes it?",
    options: [
      { id: "a", text: "Raise the container's memory limit, or reduce the app's memory use" },
      { id: "b", text: "Free disk space on the node" },
      { id: "c", text: "Lower the memory request so the Pod can be scheduled" },
      { id: "d", text: "Fix the readiness probe path" },
    ],
    correctOptionId: "a",
    explanation:
      "OOMKilled means the container used more memory than its limit and the kernel killed it (137 = 128 + SIGKILL). The request only affects scheduling; the limit is what triggers the kill.",
  },
  {
    id: "troubleshooting-not-ready",
    topic: "Pod status",
    difficulty: "beginner",
    question: "kubectl get pods shows READY 0/1, STATUS Running, RESTARTS 0. What is failing?",
    options: [
      { id: "a", text: "The liveness probe" },
      { id: "b", text: "The readiness probe" },
      { id: "c", text: "The image pull" },
      { id: "d", text: "Scheduling" },
    ],
    correctOptionId: "b",
    explanation:
      "The container runs and is not being restarted, so liveness is fine. It is not ready, so readiness fails and the Pod is kept out of Service endpoints. A failed pull or scheduling would not show Running.",
  },
  {
    id: "troubleshooting-no-endpoints",
    topic: "Services",
    difficulty: "intermediate",
    question: "Pods are Running and 1/1, but kubectl get endpoints web shows <none>. What is the most likely cause?",
    options: [
      { id: "a", text: "The Service targetPort is wrong" },
      { id: "b", text: "There is no Ingress for the Service" },
      { id: "c", text: "The Service selector does not match the Pod labels" },
      { id: "d", text: "A NetworkPolicy blocks the Service" },
    ],
    correctOptionId: "c",
    explanation:
      "Endpoints list ready Pods that match the selector. With ready Pods and an empty list, the selector matches nothing. A wrong targetPort still produces endpoints, just with the wrong port, and NetworkPolicy does not change endpoints.",
  },
  {
    id: "troubleshooting-timeout",
    topic: "Networking",
    difficulty: "intermediate",
    question:
      "From a frontend Pod, wget -T 3 http://api times out. The api Pods are 1/1, the endpoints list them on the right port, and the same call works from another namespace. What is the likely cause?",
    options: [
      { id: "a", text: "The api Service has no endpoints" },
      { id: "b", text: "DNS cannot resolve api" },
      { id: "c", text: "The app serves a different path" },
      { id: "d", text: "A NetworkPolicy drops traffic from the frontend Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "No endpoints gives connection refused, a DNS failure gives bad address, and a wrong path gives 404. Packets that are silently dropped cause a timeout, which is how NetworkPolicy blocks traffic.",
  },
  {
    id: "troubleshooting-dns",
    topic: "Networking",
    difficulty: "intermediate",
    question: "kubectl exec into a Pod in namespace shop and run wget -qO- http://api. It prints wget: bad address 'api'. What should you check first?",
    options: [
      { id: "a", text: "Whether a Service named api exists in namespace shop" },
      { id: "b", text: "Whether the api Pods are ready" },
      { id: "c", text: "The api container's memory limit" },
      { id: "d", text: "The Ingress class" },
    ],
    correctOptionId: "a",
    explanation:
      "A bare name resolves only to a Service in the caller's own namespace. If api lives elsewhere, use api.<namespace>. Readiness affects endpoints, not whether the name resolves.",
  },
  {
    id: "troubleshooting-ingress-503",
    topic: "Ingress",
    difficulty: "intermediate",
    question: "curl http://shop.example.com/ returns 503 Service Temporarily Unavailable from the Ingress controller. What does that usually mean?",
    options: [
      { id: "a", text: "No Ingress rule matches the host" },
      { id: "b", text: "The backend Service is missing or has no ready endpoints" },
      { id: "c", text: "The TLS certificate expired" },
      { id: "d", text: "DNS has no record for shop.example.com" },
    ],
    correctOptionId: "b",
    explanation:
      "A rule matched, but there is nowhere to send the request. kubectl describe ingress shows the backend and its endpoints or an error. An unmatched host gives 404, and a DNS failure never reaches the controller.",
  },
  {
    id: "troubleshooting-ingress-404",
    topic: "Ingress",
    difficulty: "intermediate",
    question: "curl http://shop.example.com/ returns 404 Not Found from nginx, and the Ingress rule has host shop.exmaple.com. Why?",
    options: [
      { id: "a", text: "The Service has no endpoints" },
      { id: "b", text: "The Pods are not ready" },
      { id: "c", text: "No rule matches the requested host, so the default backend answers" },
      { id: "d", text: "The Ingress class is wrong" },
    ],
    correctOptionId: "c",
    explanation:
      "The host in the rule is misspelled, so the request reaches the controller but matches no rule and gets the default backend's 404. An unknown class would mean no controller serves the Ingress at all.",
  },
  {
    id: "troubleshooting-forbidden",
    topic: "RBAC",
    difficulty: "intermediate",
    question: "A user gets Error from server (Forbidden): pods is forbidden: User \"jane\" cannot list resource \"pods\". Which command confirms it from your admin account?",
    options: [
      { id: "a", text: "kubectl describe pod jane" },
      { id: "b", text: "kubectl logs --previous" },
      { id: "c", text: "kubectl get events -A" },
      { id: "d", text: "kubectl auth can-i list pods --as=jane" },
    ],
    correctOptionId: "d",
    explanation:
      "auth can-i with --as asks the API server whether that user may do that verb on that resource, using the same RBAC rules. It prints yes or no; --list shows everything the user may do.",
  },
  {
    id: "troubleshooting-method",
    topic: "Method",
    difficulty: "beginner",
    question: "Which order matches the method in this chapter?",
    options: [
      { id: "a", text: "exec, logs, describe, get" },
      { id: "b", text: "Delete the Pod, then read its logs" },
      { id: "c", text: "Edit the Deployment, then check status" },
      { id: "d", text: "get, describe and events, logs, exec, then the owner and the Service" },
    ],
    correctOptionId: "d",
    explanation:
      "Each step needs the one before: status says where to look, events say what Kubernetes saw, logs say what the app saw, exec tests from inside, and the owner and Service cover what is outside the Pod. Deleting a Pod first throws away its evidence.",
  },
  {
    id: "troubleshooting-events-ttl",
    topic: "Events",
    difficulty: "advanced",
    question: "A Pod failed to schedule yesterday. Today describe pod shows no events. Why?",
    options: [
      { id: "a", text: "Events are kept for a short time, one hour by default, then deleted" },
      { id: "b", text: "describe only shows events from the current namespace" },
      { id: "c", text: "Events are only recorded for Deployments" },
      { id: "d", text: "The scheduler stops recording events after the first failure" },
    ],
    correctOptionId: "a",
    explanation:
      "The API server deletes events after their time to live, one hour by default. Collect them while the problem is happening, or export them to a log system if you need history.",
  },
  {
    id: "troubleshooting-no-pods",
    topic: "Owners",
    difficulty: "advanced",
    question: "A Deployment shows READY 0/3 and kubectl get pods lists no Pods for it at all. Where do you look next?",
    options: [
      { id: "a", text: "kubectl logs deployment/<name> --previous" },
      { id: "b", text: "kubectl exec into one of its Pods" },
      { id: "c", text: "kubectl describe replicaset for the Deployment, and read its FailedCreate events" },
      { id: "d", text: "kubectl describe node control-plane" },
    ],
    correctOptionId: "c",
    explanation:
      "With no Pods there are no logs and nothing to exec into. The ReplicaSet tried to create Pods and the API server refused; reasons like a ResourceQuota, a LimitRange, or a missing ServiceAccount appear as FailedCreate events on the ReplicaSet.",
  },
  {
    id: "troubleshooting-exec-env",
    topic: "exec",
    difficulty: "intermediate",
    question: "A Pod is Running but the app connects to the wrong database. How do you see the environment the container actually received?",
    options: [
      { id: "a", text: "kubectl get configmap -o yaml" },
      { id: "b", text: "kubectl describe deployment" },
      { id: "c", text: "kubectl get events" },
      { id: "d", text: "kubectl exec <pod> -- env" },
    ],
    correctOptionId: "d",
    explanation:
      "The ConfigMap and the Deployment show what should be there. exec -- env shows what the running process has, including values from an older ConfigMap that the container read when it started.",
  },
  {
    id: "troubleshooting-targetport",
    topic: "Services",
    difficulty: "intermediate",
    question: "kubectl get endpoints api shows 10.244.1.7:80, the container listens on 8080, and requests to the Service are refused. What do you change?",
    options: [
      { id: "a", text: "Set the Service targetPort to 8080" },
      { id: "b", text: "Set the Service port to 8080 and leave targetPort" },
      { id: "c", text: "Change the Pod labels" },
      { id: "d", text: "Add a readiness probe on port 80" },
    ],
    correctOptionId: "a",
    explanation:
      "Endpoints use targetPort, so traffic goes to port 80 on the Pod where nothing listens. targetPort must match the containerPort. The selector is already right, since endpoints exist.",
  },
  {
    id: "troubleshooting-delete-pod",
    topic: "Method",
    difficulty: "beginner",
    question: "A Deployment's Pod is in CrashLoopBackOff because of a bad setting in its ConfigMap. You delete the Pod. What happens?",
    options: [
      { id: "a", text: "The problem is fixed permanently" },
      { id: "b", text: "The replacement Pod crashes the same way" },
      { id: "c", text: "The Deployment scales down by one" },
      { id: "d", text: "The ConfigMap is reset to its previous value" },
    ],
    correctOptionId: "b",
    explanation:
      "The ReplicaSet creates a replacement from the same template with the same ConfigMap, so it fails the same way. You also lose the old container's logs. Fix the cause first.",
  },
  {
    id: "troubleshooting-yaml-pending",
    topic: "Troubleshooting YAML",
    difficulty: "intermediate",
    question:
      "Nodes have 2 CPUs and 4Gi of memory each. A container has resources: { requests: { cpu: \"8\", memory: 128Mi } } and the Pod stays Pending. Which line causes it?",
    options: [
      { id: "a", text: "memory: 128Mi" },
      { id: "b", text: "image: nginx:1.27" },
      { id: "c", text: "cpu: \"8\"" },
      { id: "d", text: "containerPort: 80" },
    ],
    correctOptionId: "c",
    explanation:
      "The scheduler only places a Pod on a node with enough unrequested CPU and memory. 8 CPUs fits nowhere, so FailedScheduling reports Insufficient cpu. 128Mi fits easily.",
  },
  {
    id: "troubleshooting-yaml-keyref",
    topic: "Troubleshooting YAML",
    difficulty: "intermediate",
    question:
      "The ConfigMap api-config has data: { DB_HOST: db.internal }. The container has env: [{ name: DB_HOST, valueFrom: { configMapKeyRef: { name: api-config, key: db_host } } }]. What is wrong?",
    options: [
      { id: "a", text: "name: DB_HOST must be lowercase" },
      { id: "b", text: "configMapKeyRef should be secretKeyRef" },
      { id: "c", text: "name: api-config must include the namespace" },
      { id: "d", text: "key: db_host should be key: DB_HOST, because keys are case-sensitive" },
    ],
    correctOptionId: "d",
    explanation:
      "The reference asks for key db_host, which does not exist, so the Pod shows CreateContainerConfigError. The variable name can be anything; the key must match the ConfigMap exactly.",
  },
  {
    id: "troubleshooting-yaml-service",
    topic: "Troubleshooting YAML",
    difficulty: "beginner",
    question:
      "Pods labelled app: web run nginx on port 80. The Service has selector: { app: web } and ports: [{ port: 80, targetPort: 8080 }]. Which field is wrong?",
    options: [
      { id: "a", text: "targetPort: 8080" },
      { id: "b", text: "port: 80" },
      { id: "c", text: "selector: { app: web }" },
      { id: "d", text: "None, the Service is correct" },
    ],
    correctOptionId: "a",
    explanation:
      "targetPort must be the port the container listens on, 80. The selector matches, so endpoints exist, but every connection to 8080 is refused.",
  },
  {
    id: "troubleshooting-yaml-oom",
    topic: "Troubleshooting YAML",
    difficulty: "intermediate",
    question:
      "An app needs about 100Mi of memory. Its container has resources: { requests: { memory: 64Mi }, limits: { memory: 64Mi } }. What do you see?",
    options: [
      { id: "a", text: "Pending with Insufficient memory" },
      { id: "b", text: "OOMKilled, then CrashLoopBackOff as restarts pile up" },
      { id: "c", text: "CreateContainerConfigError" },
      { id: "d", text: "Running and ready, using swap" },
    ],
    correctOptionId: "b",
    explanation:
      "64Mi fits on any node, so the Pod is scheduled. When the app passes the 64Mi limit the kernel kills it with exit code 137, and repeated kills lead to CrashLoopBackOff.",
  },
  {
    id: "troubleshooting-yaml-ingress",
    topic: "Troubleshooting YAML",
    difficulty: "advanced",
    question:
      "An Ingress has rules: [{ host: shop.example.com, http: { paths: [{ path: /, pathType: Prefix, backend: { service: { name: shop, port: { number: 80 } } } }] } }]. The Service is named web. What does curl http://shop.example.com/ return?",
    options: [
      { id: "a", text: "200, because the host matches" },
      { id: "b", text: "404, because no rule matches" },
      { id: "c", text: "503, because the backend Service shop does not exist" },
      { id: "d", text: "Could not resolve host" },
    ],
    correctOptionId: "c",
    explanation:
      "The host and path match, so the request is routed to backend shop. No Service has that name, so the controller has no endpoints to send it to and answers 503. Fix: service name web.",
  },
  {
    id: "troubleshooting-yaml-envfrom",
    topic: "Troubleshooting YAML",
    difficulty: "advanced",
    question:
      "A ConfigMap has data: { QUEUE_ULR: amqp://queue:5672 } and the container loads it with envFrom: [{ configMapRef: { name: worker-config } }]. The app requires QUEUE_URL. What happens?",
    options: [
      { id: "a", text: "CreateContainerConfigError, because QUEUE_URL is missing" },
      { id: "b", text: "Kubernetes corrects the key to QUEUE_URL" },
      { id: "c", text: "The Pod stays Pending" },
      { id: "d", text: "The container starts with QUEUE_ULR set, the app exits, and the Pod goes into CrashLoopBackOff" },
    ],
    correctOptionId: "d",
    explanation:
      "envFrom copies every key as a variable of the same name, and the ConfigMap exists, so Kubernetes sees nothing wrong. Only the app notices QUEUE_URL is missing. kubectl logs --previous shows its error.",
  },
  {
    id: "troubleshooting-yaml-readiness",
    topic: "Troubleshooting YAML",
    difficulty: "intermediate",
    question:
      "The app listens on 8080. The container has readinessProbe: { httpGet: { path: /ready, port: 80 } } and no liveness probe. What does kubectl get pods show?",
    options: [
      { id: "a", text: "CrashLoopBackOff with rising restarts" },
      { id: "b", text: "Running, READY 0/1, no restarts" },
      { id: "c", text: "ImagePullBackOff" },
      { id: "d", text: "Running, READY 1/1" },
    ],
    correctOptionId: "b",
    explanation:
      "A failing readiness probe never restarts the container. It keeps the Pod not ready and out of Service endpoints. describe pod shows Unhealthy events with connection refused on port 80.",
  },
  {
    id: "troubleshooting-pull-states",
    topic: "Images",
    difficulty: "beginner",
    question: "A Pod switches between ErrImagePull and ImagePullBackOff. What is the difference?",
    options: [
      { id: "a", text: "ErrImagePull is a failed pull attempt; ImagePullBackOff is the wait before the kubelet tries again" },
      { id: "b", text: "ErrImagePull means a wrong tag; ImagePullBackOff means missing registry credentials" },
      { id: "c", text: "ErrImagePull comes from the scheduler; ImagePullBackOff from the kubelet" },
      { id: "d", text: "ImagePullBackOff means the kubelet has given up for good" },
    ],
    correctOptionId: "a",
    explanation:
      "Both name the same problem. The kubelet tries, fails (ErrImagePull), then backs off with growing delays (ImagePullBackOff) and keeps retrying. The Failed event gives the actual cause, such as a missing tag or a private registry without credentials.",
  },
  {
    id: "troubleshooting-one-at-a-time",
    topic: "Method",
    difficulty: "intermediate",
    question: "You lower a Pod's CPU request and it leaves Pending. What should you do next?",
    options: [
      { id: "a", text: "Nothing; the Pod was only Pending, so it is fixed" },
      { id: "b", text: "Delete the Pod so it starts clean" },
      { id: "c", text: "Run kubectl get pods again, because the next stage (image pull, config, app, readiness) can fail in turn" },
      { id: "d", text: "Restart the kubelet on its node" },
    ],
    correctOptionId: "c",
    explanation:
      "A Pod shows one problem at a time in lifecycle order: scheduling, image pull, container config, the running app. Fixing one can reveal the next. You are done when the client request succeeds.",
  },
  {
    id: "troubleshooting-config-no-logs",
    topic: "Configuration",
    difficulty: "intermediate",
    question: "A Pod shows CreateContainerConfigError and kubectl logs returns nothing. Why, and what happens after you create the missing key?",
    options: [
      { id: "a", text: "Logs are hidden for security; you must delete the Pod after the fix" },
      { id: "b", text: "The container was never created, so there are no logs; the kubelet retries on its own once the key exists" },
      { id: "c", text: "The app crashed before writing; use --previous" },
      { id: "d", text: "The Pod is not scheduled yet; it moves to Pending after the fix" },
    ],
    correctOptionId: "b",
    explanation:
      "The kubelet cannot build the container's environment, so no container ever starts and there is nothing to log, previous or not. It keeps retrying, so creating the key or fixing the reference is enough.",
  },
  {
    id: "troubleshooting-logs-deployment",
    topic: "Logs",
    difficulty: "beginner",
    question: "What does kubectl logs deployment/web show?",
    options: [
      { id: "a", text: "The Deployment's rollout history" },
      { id: "b", text: "Logs of every Pod of the Deployment merged together" },
      { id: "c", text: "The events of the Deployment" },
      { id: "d", text: "The logs of one Pod that kubectl picks from the Deployment" },
    ],
    correctOptionId: "d",
    explanation:
      "kubectl resolves the Deployment to its Pods and prints the logs of one of them, which saves looking up the generated Pod name. Events come from describe or get events, and history from kubectl rollout history.",
  },
  {
    id: "troubleshooting-events-selector",
    topic: "Events",
    difficulty: "intermediate",
    question: "Which command lists only the events for Pod web-1?",
    options: [
      { id: "a", text: "kubectl get events --field-selector involvedObject.name=web-1" },
      { id: "b", text: "kubectl get events -l name=web-1" },
      { id: "c", text: "kubectl logs web-1 --events" },
      { id: "d", text: "kubectl get pod web-1 -o events" },
    ],
    correctOptionId: "a",
    explanation:
      "Events record the object they are about in involvedObject, and a field selector filters on it. Events do not carry the Pod's labels, so -l does not work. describe pod shows the same events at the bottom.",
  },
  {
    id: "troubleshooting-oom-compare",
    topic: "Resources",
    difficulty: "intermediate",
    question: "A container was OOMKilled. Which command shows its memory use now, to compare with its limit?",
    options: [
      { id: "a", text: "kubectl describe node" },
      { id: "b", text: "kubectl top pods" },
      { id: "c", text: "kubectl get events" },
      { id: "d", text: "kubectl logs --previous" },
    ],
    correctOptionId: "b",
    explanation:
      "kubectl top pods shows current CPU and memory use from the metrics pipeline. describe node shows what is requested and limited on a node, which is what you check for Pending with Insufficient memory, not live use.",
  },
  {
    id: "troubleshooting-pod-ip",
    topic: "Request path",
    difficulty: "advanced",
    question: "From another Pod, wget http://10.244.1.7:8080/ (a web Pod IP) works, endpoints for Service web list 10.244.1.7:8080, but wget http://web times out. What do you check?",
    options: [
      { id: "a", text: "The Service targetPort" },
      { id: "b", text: "The Pod's readiness probe" },
      { id: "c", text: "NetworkPolicies in the namespace" },
      { id: "d", text: "The image tag" },
    ],
    correctOptionId: "c",
    explanation:
      "The app answers directly and the endpoints are ready on the right port, so the Service is wired correctly. A timeout means dropped packets, which points at a NetworkPolicy. A wrong targetPort would show in the endpoints and give connection refused.",
  },
  {
    id: "troubleshooting-egress-dns",
    topic: "Networking",
    difficulty: "advanced",
    question: "After adding a NetworkPolicy that restricts egress from frontend Pods to the api Pods only, wget http://api fails with bad address. Why?",
    options: [
      { id: "a", text: "Egress policies also delete the api Service" },
      { id: "b", text: "The api Pods lost their readiness" },
      { id: "c", text: "NetworkPolicy blocks ingress, never egress" },
      { id: "d", text: "DNS lookups are egress too, so the policy needs a rule allowing traffic to the cluster DNS" },
    ],
    correctOptionId: "d",
    explanation:
      "Resolving api means a query to the DNS Pods, and the policy now drops it, so the name never resolves. Allow egress to DNS on port 53 alongside the api rule.",
  },
  {
    id: "troubleshooting-configmap-restart",
    topic: "Configuration",
    difficulty: "intermediate",
    question: "You fix a misspelled key in a ConfigMap that a Deployment loads with envFrom and apply it. The running Pods still crash. What is missing?",
    options: [
      { id: "a", text: "kubectl rollout restart deployment/<name>, because environment variables are read only when a container starts" },
      { id: "b", text: "Nothing; the Pods pick up the change within a minute" },
      { id: "c", text: "Delete and recreate the ConfigMap with a new name" },
      { id: "d", text: "kubectl apply the Deployment with --force" },
    ],
    correctOptionId: "a",
    explanation:
      "Variables from a ConfigMap are copied into the container when it starts. Changing the ConfigMap does not touch the Pod template, so nothing rolls out by itself. A rollout restart creates new Pods that read the fixed values.",
  },
  {
    id: "troubleshooting-forbidden-sa",
    topic: "RBAC",
    difficulty: "intermediate",
    question: "An app in Pods using ServiceAccount reporter in namespace shop gets Forbidden. Which identity do you pass to kubectl auth can-i --as?",
    options: [
      { id: "a", text: "reporter" },
      { id: "b", text: "system:serviceaccount:shop:reporter" },
      { id: "c", text: "shop/reporter" },
      { id: "d", text: "The name of the Pod" },
    ],
    correctOptionId: "b",
    explanation:
      "RBAC sees a ServiceAccount as system:serviceaccount:<namespace>:<name>, and the Forbidden message prints that username. Plain reporter would be checked as a human user of that name.",
  },
];
