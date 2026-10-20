export type CheatsheetEntry = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  explanation: string;
  code: string;
  language: "bash" | "yaml";
  /** True when the simulator supports this command, so it can be tried in a lab. */
  simulated: boolean;
  relatedChapter?: string;
};

export const cheatsheet: CheatsheetEntry[] = [
  {
    id: "get-pods",
    title: "List Pods",
    category: "Inspect",
    keywords: ["get", "pods", "status", "ready"],
    explanation: "Shows each Pod with its ready count, status, restarts, and age.",
    code: "kubectl get pods",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-all-namespaces",
    title: "List Pods in every namespace",
    category: "Inspect",
    keywords: ["get", "namespace", "all", "-A"],
    explanation: "Adds a NAMESPACE column and lists across all namespaces.",
    code: "kubectl get pods -A",
    language: "bash",
    simulated: true,
  },
  {
    id: "get-namespace",
    title: "List Pods in one namespace",
    category: "Inspect",
    keywords: ["get", "namespace", "-n"],
    explanation: "Without -n, kubectl uses the default namespace.",
    code: "kubectl get pods -n kube-system",
    language: "bash",
    simulated: true,
  },
  {
    id: "get-selector",
    title: "Filter by label",
    category: "Inspect",
    keywords: ["labels", "selector", "-l", "filter"],
    explanation: "Lists only resources whose labels match. Separate several labels with commas.",
    code: "kubectl get pods -l app=web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-yaml",
    title: "Print a resource as YAML",
    category: "Inspect",
    keywords: ["yaml", "output", "-o", "manifest"],
    explanation: "Shows the full object, including the status the cluster has observed.",
    code: "kubectl get deployment web -o yaml",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "get-deployments",
    title: "List Deployments and ReplicaSets",
    category: "Deployments",
    keywords: ["get", "deployments", "replicasets", "rs", "deploy"],
    explanation: "READY on a Deployment is ready Pods over desired replicas. A ReplicaSet shows DESIRED, CURRENT, and READY.",
    code: "kubectl get deployments\nkubectl get replicasets",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "describe-deployment",
    title: "Describe a Deployment",
    category: "Deployments",
    keywords: ["describe", "details", "replicas", "strategy"],
    explanation: "Shows the selector, replica counts, strategy, and current ReplicaSet.",
    code: "kubectl describe deployment web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "scale-deployment",
    title: "Scale a Deployment",
    category: "Deployments",
    keywords: ["scale", "replicas", "up", "down"],
    explanation: "Changes spec.replicas. Scale the Deployment, not its ReplicaSet, or the Deployment sets it back.",
    code: "kubectl scale deployment web --replicas=3",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "delete-pod",
    title: "Delete a Pod",
    category: "Pods",
    keywords: ["delete", "pod", "recreate"],
    explanation: "A Pod owned by a ReplicaSet is replaced with a new one. A standalone Pod is gone for good.",
    code: "kubectl delete pod toolbox",
    language: "bash",
    simulated: true,
  },
  {
    id: "delete-deployment",
    title: "Delete a Deployment",
    category: "Deployments",
    keywords: ["delete", "deployment", "cascade"],
    explanation: "Also deletes the ReplicaSets and Pods the Deployment owns.",
    code: "kubectl delete deployment web",
    language: "bash",
    simulated: true,
    relatedChapter: "deployments",
  },
  {
    id: "rollout",
    title: "Watch and undo a rollout",
    category: "Deployments",
    keywords: ["rollout", "status", "undo", "history", "update"],
    explanation: "Follows an update until it finishes, or returns to the previous ReplicaSet.",
    code: "kubectl set image deployment/web nginx=nginx:1.28\nkubectl rollout status deployment/web\nkubectl rollout undo deployment/web",
    language: "bash",
    simulated: true,
    relatedChapter: "rollouts",
  },
  {
    id: "get-nodes",
    title: "List nodes",
    category: "Cluster",
    keywords: ["get", "nodes", "control plane", "worker", "kubelet"],
    explanation: "Shows each node with its status, roles, and kubelet version. A node is Ready when its kubelet reports in.",
    code: "kubectl get nodes",
    language: "bash",
    simulated: true,
    relatedChapter: "architecture",
  },
  {
    id: "api-resources",
    title: "List resource types and API groups",
    category: "Cluster",
    keywords: ["api-resources", "apiVersion", "group", "kind", "shortnames"],
    explanation: "Shows each kind with its short name and API group. Use it to find the apiVersion for a manifest.",
    code: "kubectl api-resources",
    language: "bash",
    simulated: false,
    relatedChapter: "intro",
  },
  {
    id: "get-pod-yaml",
    title: "Print a Pod as YAML",
    category: "Inspect",
    keywords: ["yaml", "pod", "status", "spec", "-o"],
    explanation: "The status block below spec is filled in by the kubelet and control plane, not by you.",
    code: "kubectl get pod toolbox -o yaml",
    language: "bash",
    simulated: true,
    relatedChapter: "intro",
  },
  {
    id: "describe-pod",
    title: "Describe a Pod",
    category: "Pods",
    keywords: ["describe", "pod", "waiting", "reason", "restart count", "controlled by", "CrashLoopBackOff"],
    explanation: "Shows the node, image, container state with its waiting reason, Restart Count, and Controlled By.",
    code: "kubectl describe pod toolbox",
    language: "bash",
    simulated: true,
    relatedChapter: "pods",
  },
  {
    id: "logs",
    title: "Read container logs",
    category: "Pods",
    keywords: ["logs", "crash", "previous", "CrashLoopBackOff"],
    explanation: "Prints what the container wrote to stdout and stderr. --previous shows the run before the last restart.",
    code: "kubectl logs toolbox\nkubectl logs toolbox --previous",
    language: "bash",
    simulated: false,
    relatedChapter: "pods",
  },
  {
    id: "scale-replicaset",
    title: "Scale a ReplicaSet",
    category: "ReplicaSets",
    keywords: ["scale", "replicaset", "rs", "replicas"],
    explanation: "The controller creates or deletes Pods until the count matches. Scale to 0 to stop the app.",
    code: "kubectl scale replicaset frontend --replicas=5",
    language: "bash",
    simulated: true,
    relatedChapter: "replicasets",
  },
  {
    id: "apply",
    title: "Create or update from a file",
    category: "Manifests",
    keywords: ["apply", "-f", "file", "yaml"],
    explanation: "Sends the manifest to the API server. Running it again with changes updates the object.",
    code: "kubectl apply -f web-deployment.yaml",
    language: "bash",
    simulated: false,
  },
  {
    id: "deployment-yaml",
    title: "Minimal Deployment",
    category: "Manifests",
    keywords: ["deployment", "yaml", "selector", "template", "manifest"],
    explanation: "selector.matchLabels must match the template labels.",
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
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
          image: nginx:1.27`,
    language: "yaml",
    simulated: false,
    relatedChapter: "deployments",
  },
  {
    id: "pod-yaml",
    title: "Minimal Pod",
    category: "Manifests",
    keywords: ["pod", "yaml", "resources", "requests", "limits", "restartPolicy", "manifest"],
    explanation: "Requests decide where the Pod is scheduled. Limits are enforced while it runs.",
    code: `apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  restartPolicy: Always
  containers:
    - name: api
      image: nginx:1.27
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"`,
    language: "yaml",
    simulated: false,
    relatedChapter: "pods",
  },
  {
    id: "replicaset-yaml",
    title: "Minimal ReplicaSet",
    category: "Manifests",
    keywords: ["replicaset", "yaml", "selector", "template", "manifest"],
    explanation: "selector.matchLabels must match the template labels. Usually a Deployment creates this for you.",
    code: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: nginx
          image: nginx:1.27`,
    language: "yaml",
    simulated: false,
    relatedChapter: "replicasets",
  },
  {
    id: "expose",
    title: "Expose a Deployment as a Service",
    category: "Services",
    keywords: ["expose", "service", "port", "target-port", "nodeport"],
    explanation: "Creates a Service that selects the Deployment's Pods. --target-port is the container port; it defaults to --port.",
    code: "kubectl expose deployment web --port=80 --target-port=80 --type=NodePort",
    language: "bash",
    simulated: true,
    relatedChapter: "services",
  },
  {
    id: "get-services",
    title: "List Services and their endpoints",
    category: "Services",
    keywords: ["get", "svc", "endpoints", "ep", "clusterip"],
    explanation: "A Service with no endpoints selects no ready Pods: compare its selector with the Pod labels.",
    code: "kubectl get svc\nkubectl get endpoints",
    language: "bash",
    simulated: true,
    relatedChapter: "services",
  },
  {
    id: "pod-ips",
    title: "Show Pod IPs and nodes",
    category: "Inspect",
    keywords: ["get", "wide", "ip", "node"],
    explanation: "-o wide adds IP and NODE columns. Pod IPs change when Pods are replaced, which is why Services exist.",
    code: "kubectl get pods -o wide",
    language: "bash",
    simulated: true,
    relatedChapter: "services",
  },
  {
    id: "service-yaml",
    title: "Service manifest",
    category: "Services",
    keywords: ["service", "yaml", "selector", "port", "targetport"],
    explanation: "port is what clients use; targetPort is the container port. The selector must match the Pod labels.",
    code: `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80`,
    language: "yaml",
    simulated: false,
    relatedChapter: "services",
  },
  {
    id: "show-labels",
    title: "Show and filter by labels",
    category: "Labels",
    keywords: ["labels", "show-labels", "selector", "-l", "in", "notin"],
    explanation: "Equality (=, !=) and set-based (in, notin, exists) selectors. Quote set-based ones in a shell.",
    code: "kubectl get pods --show-labels\nkubectl get pods -l app=web\nkubectl get pods -l 'app in (web,api)'",
    language: "bash",
    simulated: true,
    relatedChapter: "labels",
  },
  {
    id: "label",
    title: "Add, change, or remove a label",
    category: "Labels",
    keywords: ["label", "overwrite", "remove"],
    explanation: "Changing an existing label needs --overwrite. A trailing minus removes the key.",
    code: "kubectl label pod toolbox tier=debug\nkubectl label pod toolbox tier=tools --overwrite\nkubectl label pod toolbox tier-",
    language: "bash",
    simulated: true,
    relatedChapter: "labels",
  },
  {
    id: "annotate",
    title: "Annotate a resource",
    category: "Labels",
    keywords: ["annotate", "annotation", "change-cause"],
    explanation: "Annotations hold notes for people and tools; selectors cannot use them. change-cause shows in rollout history.",
    code: "kubectl annotate deployment web kubernetes.io/change-cause=\"update to 1.28\"",
    language: "bash",
    simulated: true,
    relatedChapter: "labels",
  },
  {
    id: "rollout-history",
    title: "Rollout history and rollback to a revision",
    category: "Deployments",
    keywords: ["rollout", "history", "undo", "to-revision", "revision"],
    explanation: "history lists revisions with their change-cause; undo --to-revision picks one, which becomes the newest revision.",
    code: "kubectl set image deployment/web nginx=nginx:1.28\nkubectl rollout history deployment/web\nkubectl rollout undo deployment/web --to-revision=1",
    language: "bash",
    simulated: true,
    relatedChapter: "rollouts",
  },
  {
    id: "rollout-restart",
    title: "Restart all Pods of a Deployment",
    category: "Deployments",
    keywords: ["rollout", "restart", "pause", "resume"],
    explanation: "restart replaces Pods with a rolling update, for example to pick up changed ConfigMap env values. pause and resume batch several changes into one rollout.",
    code: "kubectl rollout restart deployment/web\nkubectl rollout pause deployment/web\nkubectl rollout resume deployment/web",
    language: "bash",
    simulated: true,
    relatedChapter: "rollouts",
  },
  {
    id: "create-configmap",
    title: "Create a ConfigMap from literals",
    category: "Configuration",
    keywords: ["configmap", "cm", "create", "from-literal"],
    explanation: "Each --from-literal adds one key. Pods read it through env, envFrom, or a volume.",
    code: "kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-literal=PORT=8080\nkubectl describe configmap app-config",
    language: "bash",
    simulated: true,
    relatedChapter: "config",
  },
  {
    id: "create-secret",
    title: "Create a Secret from literals",
    category: "Configuration",
    keywords: ["secret", "create", "generic", "base64"],
    explanation: "Values are stored base64-encoded, which is not encryption. describe shows sizes, not values.",
    code: "kubectl create secret generic db --from-literal=DB_PASSWORD=s3cr3t\nkubectl get secret db -o yaml",
    language: "bash",
    simulated: true,
    relatedChapter: "config",
  },
  {
    id: "env-from-config",
    title: "Read config into env vars",
    category: "Configuration",
    keywords: ["env", "valuefrom", "envfrom", "configmapkeyref", "secretkeyref", "yaml"],
    explanation: "One key with valueFrom, or every key with envFrom. A missing object or key leaves the Pod in CreateContainerConfigError.",
    code: `apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  containers:
    - name: api
      image: example/api:1.1
      env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
      envFrom:
        - secretRef:
            name: db`,
    language: "yaml",
    simulated: false,
    relatedChapter: "config",
  },
  {
    id: "probes-yaml",
    title: "Readiness and liveness probes",
    category: "Configuration",
    keywords: ["probe", "readiness", "liveness", "startup", "httpget", "yaml"],
    explanation: "Readiness controls Service traffic; liveness restarts the container. Point both at the port the app listens on.",
    code: `apiVersion: v1
kind: Pod
metadata:
  name: api
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
        periodSeconds: 5
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        failureThreshold: 3`,
    language: "yaml",
    simulated: false,
    relatedChapter: "health-checks",
  },
  {
    id: "top",
    title: "Show CPU and memory usage",
    category: "Resources",
    keywords: ["top", "metrics", "cpu", "memory", "usage"],
    explanation: "Shows live usage from metrics-server. Compare it with requests and limits to size containers.",
    code: "kubectl top nodes\nkubectl top pods -A",
    language: "bash",
    simulated: true,
    relatedChapter: "resources",
  },
  {
    id: "create-quota",
    title: "Limit a namespace with a ResourceQuota",
    category: "Resources",
    keywords: ["quota", "resourcequota", "hard", "limits", "namespace"],
    explanation: "Caps the total a namespace can use. describe shows Used against Hard for each resource.",
    code: "kubectl create quota team-quota --hard=pods=10,requests.cpu=2,limits.memory=4Gi\nkubectl describe quota team-quota",
    language: "bash",
    simulated: true,
    relatedChapter: "resources",
  },
  {
    id: "create-job",
    title: "Run a one-off Job",
    category: "Jobs",
    keywords: ["job", "create", "batch", "completions"],
    explanation: "A Job runs Pods until they finish successfully. Its Pods carry the label job-name=<job>.",
    code: "kubectl create job hello --image=busybox:1.36 -- echo done\nkubectl get jobs\nkubectl get pods -l job-name=hello",
    language: "bash",
    simulated: true,
    relatedChapter: "jobs",
  },
  {
    id: "create-cronjob",
    title: "Schedule a CronJob, run it now, suspend it",
    category: "Jobs",
    keywords: ["cronjob", "cj", "schedule", "from", "suspend", "patch"],
    explanation: "create job --from copies the CronJob's template to run it once by hand. suspend: true stops new runs without deleting the CronJob.",
    code: "kubectl create cronjob backup --image=busybox:1.36 --schedule='0 2 * * *' -- echo backup\nkubectl create job backup-now --from=cronjob/backup\nkubectl patch cronjob backup -p '{\"spec\":{\"suspend\":true}}'\nkubectl get cronjobs",
    language: "bash",
    simulated: true,
    relatedChapter: "jobs",
  },
  {
    id: "job-yaml",
    title: "Job manifest",
    category: "Jobs",
    keywords: ["job", "yaml", "backofflimit", "restartpolicy", "manifest"],
    explanation: "A Job's Pod template needs restartPolicy Never or OnFailure. backoffLimit is how many retries it gets before the Job fails.",
    code: `apiVersion: batch/v1
kind: Job
metadata:
  name: hello
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: hello
          image: busybox:1.36
          command: ["echo", "done"]`,
    language: "yaml",
    simulated: false,
    relatedChapter: "jobs",
  },
  {
    id: "get-ds-sts",
    title: "List DaemonSets and StatefulSets",
    category: "Workloads",
    keywords: ["daemonset", "ds", "statefulset", "sts", "get"],
    explanation: "A DaemonSet runs one Pod per node. A StatefulSet gives each Pod a fixed name and its own storage.",
    code: "kubectl get daemonsets -A\nkubectl get statefulsets",
    language: "bash",
    simulated: true,
    relatedChapter: "daemonsets-statefulsets",
  },
  {
    id: "rollout-ds-sts",
    title: "Roll out and scale a StatefulSet or DaemonSet",
    category: "Workloads",
    keywords: ["rollout", "status", "restart", "scale", "daemonset", "statefulset"],
    explanation: "rollout works on both kinds. A StatefulSet scales one Pod at a time in order; a DaemonSet has no replica count.",
    code: "kubectl rollout status daemonset/node-agent\nkubectl rollout restart statefulset/db\nkubectl scale statefulset db --replicas=3",
    language: "bash",
    simulated: false,
    relatedChapter: "daemonsets-statefulsets",
  },
  {
    id: "get-storage",
    title: "List volumes, claims, and storage classes",
    category: "Storage",
    keywords: ["pv", "pvc", "storageclass", "sc", "persistentvolume", "claim"],
    explanation: "A PVC asks for storage, a PV is the storage it binds to, and the StorageClass creates PVs on demand.",
    code: "kubectl get pv\nkubectl get pvc\nkubectl get storageclass",
    language: "bash",
    simulated: true,
    relatedChapter: "volumes",
  },
  {
    id: "exec-files",
    title: "Write and read a file in a container",
    category: "Storage",
    keywords: ["exec", "cat", "sh", "file", "volume", "mount"],
    explanation: "Use this to check that a volume is mounted and writable. Files outside a volume are lost when the container restarts.",
    code: "kubectl exec toolbox -- sh -c 'echo hello > /tmp/note.txt'\nkubectl exec toolbox -- cat /tmp/note.txt",
    language: "bash",
    simulated: true,
    relatedChapter: "volumes",
  },
  {
    id: "pvc-yaml",
    title: "PersistentVolumeClaim manifest",
    category: "Storage",
    keywords: ["pvc", "persistentvolumeclaim", "yaml", "accessmodes", "storage"],
    explanation: "Without storageClassName the default class is used. A Pod mounts it with a persistentVolumeClaim volume.",
    code: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`,
    language: "yaml",
    simulated: false,
    relatedChapter: "volumes",
  },
  {
    id: "describe-node",
    title: "Check a node's taints and capacity",
    category: "Scheduling",
    keywords: ["describe", "node", "taints", "allocatable", "allocated"],
    explanation: "Shows taints, labels, allocatable CPU and memory, and the requests of the Pods already on the node.",
    code: "kubectl describe node worker-1",
    language: "bash",
    simulated: true,
    relatedChapter: "scheduling",
  },
  {
    id: "taint",
    title: "Taint and untaint a node",
    category: "Scheduling",
    keywords: ["taint", "toleration", "noschedule", "noexecute"],
    explanation: "Only Pods that tolerate the taint can schedule there. A trailing minus removes it.",
    code: "kubectl taint nodes worker-1 dedicated=gpu:NoSchedule\nkubectl taint nodes worker-1 dedicated-",
    language: "bash",
    simulated: true,
    relatedChapter: "scheduling",
  },
  {
    id: "drain",
    title: "Cordon, drain, and uncordon a node",
    category: "Scheduling",
    keywords: ["cordon", "drain", "uncordon", "maintenance", "evict"],
    explanation: "cordon stops new Pods landing on the node; drain also evicts the Pods already there. uncordon makes it schedulable again.",
    code: "kubectl cordon worker-2\nkubectl drain worker-2 --ignore-daemonsets\nkubectl uncordon worker-2",
    language: "bash",
    simulated: true,
    relatedChapter: "scheduling",
  },
  {
    id: "get-ingress",
    title: "List Ingresses and IngressClasses",
    category: "Networking",
    keywords: ["ingress", "ing", "ingressclass", "host", "get"],
    explanation: "An Ingress does nothing until a controller for its IngressClass is running.",
    code: "kubectl get ingress\nkubectl get ingressclasses",
    language: "bash",
    simulated: true,
    relatedChapter: "ingress",
  },
  {
    id: "curl-ingress",
    title: "Test an Ingress rule with curl",
    category: "Networking",
    keywords: ["curl", "ingress", "host", "header", "404"],
    explanation: "The Host header picks the rule. A 404 from the controller means no rule matched that host and path.",
    code: "curl -s -H 'Host: web.example.com' http://192.0.2.10/",
    language: "bash",
    simulated: true,
    relatedChapter: "ingress",
  },
  {
    id: "ingress-yaml",
    title: "Ingress manifest",
    category: "Networking",
    keywords: ["ingress", "yaml", "host", "path", "backend", "ingressclassname"],
    explanation: "Sends requests for one host and path prefix to a Service. The backend port is the Service port.",
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  ingressClassName: nginx
  rules:
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80`,
    language: "yaml",
    simulated: false,
    relatedChapter: "ingress",
  },
  {
    id: "get-netpol",
    title: "List NetworkPolicies",
    category: "Security",
    keywords: ["networkpolicy", "netpol", "get", "describe"],
    explanation: "A Pod selected by no policy accepts all traffic. Once any policy selects it, only the allowed traffic gets through.",
    code: "kubectl get networkpolicies -A",
    language: "bash",
    simulated: true,
    relatedChapter: "network-policies",
  },
  {
    id: "label-namespace",
    title: "Label a namespace for policy selectors",
    category: "Security",
    keywords: ["label", "namespace", "namespaceselector"],
    explanation: "namespaceSelector in a NetworkPolicy matches namespace labels. Every namespace also has kubernetes.io/metadata.name.",
    code: "kubectl label namespace default team=web\nkubectl get namespaces --show-labels",
    language: "bash",
    simulated: true,
    relatedChapter: "network-policies",
  },
  {
    id: "test-connectivity",
    title: "Test traffic from inside a Pod",
    category: "Networking",
    keywords: ["wget", "exec", "connectivity", "timeout", "networkpolicy", "dns"],
    explanation: "-T 2 makes a blocked connection fail after two seconds instead of hanging. Run it before and after applying a policy.",
    code: "kubectl expose deployment web --port=80\nkubectl exec toolbox -- wget -q -O - -T 2 http://web",
    language: "bash",
    simulated: true,
    relatedChapter: "network-policies",
  },
  {
    id: "netpol-deny-yaml",
    title: "Default-deny NetworkPolicy",
    category: "Security",
    keywords: ["networkpolicy", "deny", "default", "ingress", "yaml"],
    explanation: "The empty podSelector selects every Pod in the namespace and allows no incoming traffic. Add policies on top to allow what is needed.",
    code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
    - Ingress`,
    language: "yaml",
    simulated: false,
    relatedChapter: "network-policies",
  },
  {
    id: "create-rbac",
    title: "Grant a ServiceAccount read access to Pods",
    category: "Security",
    keywords: ["serviceaccount", "sa", "role", "rolebinding", "rbac", "create"],
    explanation: "The Role lists allowed verbs on resources; the RoleBinding gives that Role to a subject in one namespace.",
    code: "kubectl create serviceaccount ci\nkubectl create role pod-reader --verb=get,list --resource=pods\nkubectl create rolebinding ci-reads-pods --role=pod-reader --serviceaccount=default:ci",
    language: "bash",
    simulated: true,
    relatedChapter: "rbac",
  },
  {
    id: "auth-can-i",
    title: "Check permissions as another user",
    category: "Security",
    keywords: ["auth", "can-i", "as", "impersonate", "list", "rbac"],
    explanation: "--as asks what that user or ServiceAccount may do. --list prints every rule that applies to them.",
    code: "kubectl create serviceaccount ci\nkubectl create role pod-reader --verb=get,list --resource=pods\nkubectl create rolebinding ci-reads-pods --role=pod-reader --serviceaccount=default:ci\nkubectl auth can-i list pods --as=system:serviceaccount:default:ci\nkubectl auth can-i delete pods --as=system:serviceaccount:default:ci\nkubectl auth can-i --list --as=system:serviceaccount:default:ci",
    language: "bash",
    simulated: true,
    relatedChapter: "rbac",
  },
  {
    id: "role-yaml",
    title: "Role manifest",
    category: "Security",
    keywords: ["role", "rules", "verbs", "apigroups", "yaml", "rbac"],
    explanation: "apiGroups is empty for core resources like Pods and apps for Deployments.",
    code: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]`,
    language: "yaml",
    simulated: false,
    relatedChapter: "rbac",
  },
  {
    id: "rolebinding-yaml",
    title: "RoleBinding manifest",
    category: "Security",
    keywords: ["rolebinding", "subjects", "roleref", "serviceaccount", "yaml", "rbac"],
    explanation: "A ServiceAccount subject needs its namespace. roleRef cannot be changed after the binding is created.",
    code: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ci-reads-pods
subjects:
  - kind: ServiceAccount
    name: ci
    namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader`,
    language: "yaml",
    simulated: false,
    relatedChapter: "rbac",
  },
  {
    id: "get-events",
    title: "Show recent events",
    category: "Troubleshooting",
    keywords: ["events", "ev", "field-selector", "warning", "failedscheduling"],
    explanation: "Events explain scheduling failures, image pull errors, and probe failures. Filter by object or by type=Warning.",
    code: "kubectl get events\nkubectl get events --field-selector involvedObject.name=toolbox\nkubectl get events --field-selector type=Warning",
    language: "bash",
    simulated: true,
    relatedChapter: "troubleshooting",
  },
  {
    id: "logs-previous",
    title: "Logs of a crashed container",
    category: "Troubleshooting",
    keywords: ["logs", "previous", "crashloopbackoff", "restart", "tail"],
    explanation: "After a restart, plain logs show the new container. --previous shows the one that crashed.",
    code: "kubectl logs api --previous --tail=20",
    language: "bash",
    simulated: false,
    relatedChapter: "troubleshooting",
  },
  {
    id: "exec-env",
    title: "Check a container's environment",
    category: "Troubleshooting",
    keywords: ["exec", "env", "printenv", "variables", "config"],
    explanation: "Confirms which env vars the container actually got, for example from a ConfigMap or Secret.",
    code: "kubectl exec toolbox -- env\nkubectl exec toolbox -- printenv HOSTNAME",
    language: "bash",
    simulated: true,
    relatedChapter: "troubleshooting",
  },
];
