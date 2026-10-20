import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "architecture-etcd",
    topic: "Control plane",
    difficulty: "beginner",
    question: "Which component reads from and writes to etcd directly?",
    options: [
      { id: "a", text: "The kubelet on each node" },
      { id: "b", text: "kube-apiserver" },
      { id: "c", text: "kube-scheduler" },
      { id: "d", text: "kube-proxy" },
    ],
    correctOptionId: "b",
    explanation:
      "Only the API server talks to etcd. The scheduler, controllers, kubelets, kube-proxy, and kubectl all read and write cluster state through the API server.",
  },
  {
    id: "architecture-binding",
    topic: "YAML: spec.nodeName",
    difficulty: "intermediate",
    question: "After the scheduler picks a node for a Pod, what does it change?",
    options: [
      { id: "a", text: "It opens a connection to that node's kubelet and sends it the Pod" },
      { id: "b", text: "It writes the Pod into etcd under the node's key" },
      { id: "c", text: "It creates a binding through the API server, which sets the Pod's spec.nodeName" },
      { id: "d", text: "It adds the node name to the Pod's labels" },
    ],
    correctOptionId: "c",
    explanation:
      "The scheduler binds the Pod through the API server, and the result is spec.nodeName on the Pod. It never contacts the kubelet or etcd; the kubelet finds the Pod through its own watch.",
  },
  {
    id: "architecture-filter-score",
    topic: "Scheduling",
    difficulty: "intermediate",
    question: "How does kube-scheduler choose a node for a Pod?",
    options: [
      { id: "a", text: "It filters out nodes that cannot run the Pod, scores the rest, and picks the highest score" },
      { id: "b", text: "It always picks the node with the fewest Pods" },
      { id: "c", text: "It asks every kubelet to bid and picks the first reply" },
      { id: "d", text: "It picks a node at random and retries if the Pod fails to start" },
    ],
    correctOptionId: "a",
    explanation:
      "Filtering removes nodes that do not fit, for example too little free CPU or memory for the Pod's requests. Scoring ranks the remaining nodes, and the Pod is bound to the best one.",
  },
  {
    id: "architecture-apiserver-pipeline",
    topic: "Control plane",
    difficulty: "advanced",
    question: "In what order does the API server handle a create request before storing the object?",
    options: [
      { id: "a", text: "Store in etcd, then validate, then authenticate" },
      { id: "b", text: "Validate, then authenticate, then schedule" },
      { id: "c", text: "Authorize, then authenticate, then store" },
      { id: "d", text: "Authenticate, authorize, run admission, validate, then store in etcd" },
    ],
    correctOptionId: "d",
    explanation:
      "The API server first establishes who you are, then whether you may do this, then runs admission plugins that can change or reject the object, validates it, and only then writes it to etcd.",
  },
  {
    id: "architecture-controller-manager",
    topic: "Control plane",
    difficulty: "beginner",
    question: "What is kube-controller-manager?",
    options: [
      { id: "a", text: "One binary that runs many built-in controllers, such as the node, namespace, and endpoints controllers" },
      { id: "b", text: "The component that decides which node each Pod runs on" },
      { id: "c", text: "A database that stores controller settings" },
      { id: "d", text: "The cloud-specific component that creates load balancers" },
    ],
    correctOptionId: "a",
    explanation:
      "Many separate control loops are compiled into one process to keep the cluster simple to run. Placing Pods is the scheduler's job, and cloud integrations live in the optional cloud-controller-manager.",
  },
  {
    id: "architecture-cri",
    topic: "Container runtime",
    difficulty: "beginner",
    question: "How does the kubelet tell the container runtime to start a container?",
    options: [
      { id: "a", text: "Through the API server" },
      { id: "b", text: "By running docker run on the node" },
      { id: "c", text: "Over the Container Runtime Interface (CRI), a gRPC API on a local socket" },
      { id: "d", text: "By writing a file to /etc/kubernetes/manifests" },
    ],
    correctOptionId: "c",
    explanation:
      "The CRI is the gRPC API between the kubelet and runtimes such as containerd and CRI-O. The API server is not involved at this step, and the kubelet does not call the Docker CLI.",
  },
  {
    id: "architecture-runc",
    topic: "Container runtime",
    difficulty: "intermediate",
    question: "With containerd as the runtime, which program actually creates the container process with its namespaces and cgroups?",
    options: [
      { id: "a", text: "The kubelet" },
      { id: "b", text: "kube-proxy" },
      { id: "c", text: "The image registry" },
      { id: "d", text: "runc, the low-level OCI runtime" },
    ],
    correctOptionId: "d",
    explanation:
      "containerd and CRI-O manage images and container lifecycles, then hand each container to an OCI runtime, usually runc, which sets up namespaces and cgroups and starts the process.",
  },
  {
    id: "architecture-dockershim",
    topic: "Container runtime",
    difficulty: "intermediate",
    question: "Kubernetes removed dockershim in version 1.24. What does that mean for an image you built with docker build?",
    options: [
      { id: "a", text: "It must be rebuilt with a different tool" },
      { id: "b", text: "It still runs, because it is a standard OCI image that containerd or CRI-O can pull" },
      { id: "c", text: "It only runs on nodes that still have Docker Engine installed" },
      { id: "d", text: "It must be converted to a static Pod" },
    ],
    correctOptionId: "b",
    explanation:
      "dockershim was the adapter that let the kubelet use Docker Engine as its runtime. Removing it changed what runs on the node, not the image format. Docker builds OCI images, which any CRI runtime can run.",
  },
  {
    id: "architecture-crictl",
    topic: "Container runtime",
    difficulty: "intermediate",
    question: "You are logged in to a node and want to list the containers the runtime is running. Which tool fits?",
    options: [
      { id: "a", text: "crictl ps, which talks to the runtime over the CRI" },
      { id: "b", text: "etcdctl get" },
      { id: "c", text: "kube-proxy --list" },
      { id: "d", text: "kubeadm reset" },
    ],
    correctOptionId: "a",
    explanation:
      "crictl is a CRI client for debugging on a node: crictl ps, crictl pods, crictl images, crictl logs. etcdctl reads etcd, and kubeadm reset tears the node down.",
  },
  {
    id: "architecture-lease",
    topic: "YAML: Lease objects",
    difficulty: "intermediate",
    question: "Each kubelet sends a heartbeat by renewing a Lease object. In which namespace do these Leases live?",
    options: [
      { id: "a", text: "default" },
      { id: "b", text: "kube-system" },
      { id: "c", text: "kube-node-lease" },
      { id: "d", text: "kube-public" },
    ],
    correctOptionId: "c",
    explanation:
      "There is one Lease per node in kube-node-lease, named after the node. Renewing a small Lease every 10 seconds by default is much cheaper than rewriting the whole Node status.",
  },
  {
    id: "architecture-node-notready",
    topic: "Node failure",
    difficulty: "intermediate",
    question: "A worker node loses power. What happens first on the control plane side?",
    options: [
      { id: "a", text: "The scheduler moves every Pod on it to other nodes immediately" },
      { id: "b", text: "After the heartbeats stop for a grace period, the node controller marks the node NotReady (Ready condition Unknown)" },
      { id: "c", text: "etcd deletes the Node object" },
      { id: "d", text: "Nothing, until an administrator runs kubectl delete node" },
    ],
    correctOptionId: "b",
    explanation:
      "The node controller in kube-controller-manager notices the missing heartbeats, sets the Ready condition to Unknown, and taints the node. Pods are not moved at this point, and the Node object stays.",
  },
  {
    id: "architecture-eviction-timing",
    topic: "YAML: Pod tolerations",
    difficulty: "advanced",
    question: "By default, how long do Pods stay bound to an unreachable node before they are evicted?",
    options: [
      { id: "a", text: "10 seconds" },
      { id: "b", text: "40 seconds" },
      { id: "c", text: "1 hour" },
      { id: "d", text: "5 minutes, from the default tolerationSeconds: 300 on the unreachable taint" },
    ],
    correctOptionId: "d",
    explanation:
      "The API server adds default tolerations for node.kubernetes.io/not-ready and node.kubernetes.io/unreachable with tolerationSeconds: 300. When they expire, the Pods on the tainted node are evicted.",
  },
  {
    id: "architecture-unowned-pod",
    topic: "Node failure",
    difficulty: "advanced",
    question: "A Pod you created directly with kubectl, with no controller owning it, was on a node that failed. After eviction, what happens?",
    options: [
      { id: "a", text: "It is gone. Nothing creates a replacement because no controller owns it" },
      { id: "b", text: "The kubelet on another node restarts it" },
      { id: "c", text: "The scheduler re-binds the same Pod to a healthy node" },
      { id: "d", text: "The node controller recreates it on another node" },
    ],
    correctOptionId: "a",
    explanation:
      "A Pod is bound to one node for its whole life. Only a controller that owns the Pod creates a replacement. The node controller evicts Pods but never recreates them.",
  },
  {
    id: "architecture-etcd-quorum-3",
    topic: "High availability",
    difficulty: "beginner",
    question: "An etcd cluster has 3 members. How many can fail while it keeps accepting writes?",
    options: [
      { id: "a", text: "0" },
      { id: "b", text: "2" },
      { id: "c", text: "1" },
      { id: "d", text: "3" },
    ],
    correctOptionId: "c",
    explanation:
      "A write needs a majority, which for 3 members is 2. With one member down, the other two still form a majority. With two down, the last member cannot commit writes.",
  },
  {
    id: "architecture-etcd-quorum-5",
    topic: "High availability",
    difficulty: "advanced",
    question: "Why do HA clusters run 5 etcd members rather than 4?",
    options: [
      { id: "a", text: "etcd refuses to start with an even number of members" },
      { id: "b", text: "4 members tolerate only 1 failure, the same as 3, while 5 tolerate 2" },
      { id: "c", text: "The API server needs one etcd member per control plane component" },
      { id: "d", text: "Even numbers make reads slower" },
    ],
    correctOptionId: "b",
    explanation:
      "Quorum for 4 is 3, so 4 members survive only 1 failure, the same as 3 but with one more machine to replicate to. Quorum for 5 is 3, so 5 members survive 2 failures.",
  },
  {
    id: "architecture-leader-election",
    topic: "High availability",
    difficulty: "advanced",
    question: "An HA control plane runs kube-scheduler on all 3 control plane nodes. How many of them schedule Pods at a time?",
    options: [
      { id: "a", text: "All 3, each handling a third of the Pods" },
      { id: "b", text: "All 3, and the API server discards duplicate bindings" },
      { id: "c", text: "None until an administrator promotes one" },
      { id: "d", text: "One: the leader that holds the Lease. The others take over if it stops renewing" },
    ],
    correctOptionId: "d",
    explanation:
      "The scheduler and controller manager use leader election through a Lease object, so only one copy of each acts. Failover is automatic when the leader stops renewing the Lease.",
  },
  {
    id: "architecture-ha-apiserver",
    topic: "High availability",
    difficulty: "intermediate",
    question: "Why can several kube-apiserver instances run at once behind a load balancer?",
    options: [
      { id: "a", text: "They keep no cluster state of their own; it all lives in etcd" },
      { id: "b", text: "Each one owns a different set of namespaces" },
      { id: "c", text: "Only one is active and the rest only answer health checks" },
      { id: "d", text: "kubectl sends every request to all of them and keeps the first answer" },
    ],
    correctOptionId: "a",
    explanation:
      "The API server is stateless, so any instance can serve any request. The load balancer gives clients one address and stops routing to an instance that fails.",
  },
  {
    id: "architecture-static-pod-path",
    topic: "YAML: static Pods",
    difficulty: "beginner",
    question: "On a kubeadm control plane node, where does the kubelet find the manifest for kube-apiserver?",
    options: [
      { id: "a", text: "In etcd, under /registry/pods" },
      { id: "b", text: "In /etc/kubernetes/manifests/kube-apiserver.yaml, as a static Pod" },
      { id: "c", text: "In a ConfigMap in the default namespace" },
      { id: "d", text: "It is compiled into the kubelet binary" },
    ],
    correctOptionId: "b",
    explanation:
      "The kubelet runs every manifest in its static Pod directory, /etc/kubernetes/manifests on kubeadm clusters. That is how the API server can run before any API server exists.",
  },
  {
    id: "architecture-mirror-pod",
    topic: "YAML: mirror Pods",
    difficulty: "advanced",
    question: "You run kubectl delete pod kube-apiserver-cp1 -n kube-system on a kubeadm cluster. What happens?",
    options: [
      { id: "a", text: "The API server shuts down for good" },
      { id: "b", text: "The scheduler moves the API server to another node" },
      { id: "c", text: "Only the mirror Pod is deleted; the kubelet keeps running the static Pod and recreates the mirror" },
      { id: "d", text: "The manifest file on the node is deleted too" },
    ],
    correctOptionId: "c",
    explanation:
      "The Pod you see in kube-system is a read-only mirror of a static Pod. The kubelet owns it, keeps it running from the file, and recreates the mirror. To change or stop it, edit or move the file on the node.",
  },
  {
    id: "architecture-static-manifest",
    topic: "YAML: static Pod manifest",
    difficulty: "advanced",
    question: "In the kube-apiserver static Pod manifest, which flag shows that the API server is the component that talks to etcd?",
    options: [
      { id: "a", text: "--secure-port=6443" },
      { id: "b", text: "--authorization-mode=Node,RBAC" },
      { id: "c", text: "--service-cluster-ip-range=10.96.0.0/12" },
      { id: "d", text: "--etcd-servers=https://127.0.0.1:2379" },
    ],
    correctOptionId: "d",
    explanation:
      "--etcd-servers tells the API server where etcd listens. No other component is configured with an etcd address. --secure-port is where clients reach the API server, and the others configure authorization and Service IPs.",
  },
  {
    id: "architecture-kube-proxy",
    topic: "Worker nodes",
    difficulty: "beginner",
    question: "What does kube-proxy do on each node?",
    options: [
      { id: "a", text: "Programs network rules (iptables or IPVS) so traffic to a Service reaches one of its Pods" },
      { id: "b", text: "Proxies kubectl requests to the API server" },
      { id: "c", text: "Pulls container images" },
      { id: "d", text: "Assigns IP addresses to Pods" },
    ],
    correctOptionId: "a",
    explanation:
      "kube-proxy watches Services and their endpoints and writes the node's routing rules. Pod IPs come from the CNI network plugin, and some CNI plugins replace kube-proxy entirely.",
  },
  {
    id: "architecture-addons",
    topic: "Add-ons",
    difficulty: "beginner",
    question: "Which component lets Pods find a Service by a name such as web.default.svc.cluster.local?",
    options: [
      { id: "a", text: "etcd" },
      { id: "b", text: "Cluster DNS, usually CoreDNS, running as Pods in kube-system" },
      { id: "c", text: "The kubelet's built-in DNS server" },
      { id: "d", text: "kube-scheduler" },
    ],
    correctOptionId: "b",
    explanation:
      "Cluster DNS is an add-on, not a core component. CoreDNS watches Services through the API server and answers name lookups; the kubelet only points each Pod's resolver at it.",
  },
];
