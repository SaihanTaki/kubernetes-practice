import type { ChapterData } from "../types";
import { quiz } from "./architecture.quiz";

export const data: ChapterData = {
  objectives: [
    "Name the control plane and worker node components and say what each one does.",
    "Explain how the kubelet starts containers through the Container Runtime Interface, containerd or CRI-O, and runc.",
    "Trace one Pod from kubectl to running containers, and describe what the cluster does when a node stops responding.",
    "Describe a highly available control plane, including why etcd runs an odd number of members.",
    "Read a static Pod manifest and explain how kubeadm-style clusters run the control plane.",
  ],
  quiz,
  manifests: [
    {
      id: "static-apiserver",
      title: "/etc/kubernetes/manifests/kube-apiserver.yaml (trimmed)",
      yaml: `apiVersion: v1
kind: Pod
metadata:
  name: kube-apiserver
  namespace: kube-system
  labels:
    component: kube-apiserver
    tier: control-plane
spec:
  hostNetwork: true
  priorityClassName: system-node-critical
  containers:
    - name: kube-apiserver
      image: registry.k8s.io/kube-apiserver:v1.33.0
      command:
        - kube-apiserver
        - --advertise-address=192.168.49.2
        - --secure-port=6443
        - --etcd-servers=https://127.0.0.1:2379
        - --authorization-mode=Node,RBAC
        - --enable-admission-plugins=NodeRestriction
        - --service-cluster-ip-range=10.96.0.0/12`,
      notes: [
        { line: 1, text: "A static Pod is an ordinary Pod manifest. The kubelet reads it from disk instead of receiving it from the API server." },
        { line: 4, text: "The mirror Pod in the API server gets the node name appended, for example kube-apiserver-control-plane." },
        { line: 5, text: "kubeadm puts every control plane Pod in kube-system, the namespace reserved for cluster components." },
        { line: 7, text: "Labels that kubeadm sets so you can select the control plane Pods, for example kubectl get pods -n kube-system -l tier=control-plane." },
        { line: 10, text: "The Pod uses the node's network namespace, so the API server listens directly on the node's IP. It has to be reachable before any Pod network exists." },
        { line: 11, text: "The highest built-in priority for Pods that must stay on their node. The kubelet avoids evicting it under resource pressure." },
        { line: 14, text: "The official image from registry.k8s.io. Upgrading the control plane on this node means changing this tag, which kubeadm upgrade does for you." },
        { line: 15, text: "command replaces the image's entrypoint. Each flag below configures the API server." },
        { line: 17, text: "The IP the API server announces to the rest of the cluster. In an HA setup clients use the load balancer address instead." },
        { line: 18, text: "The HTTPS port that kubectl, kubelets, and other components connect to. 6443 is the kubeadm default." },
        { line: 19, text: "Where etcd lives. Only the API server has this setting: it is the one component that talks to etcd. A real file also has TLS client certificate flags for it." },
        { line: 20, text: "Node authorizes kubelets to touch only objects for their own node; RBAC authorizes everyone else from Roles and RoleBindings." },
        { line: 21, text: "Admission plugins run after authorization and before the object is stored. NodeRestriction stops a kubelet from editing other Nodes." },
        { line: 22, text: "The range Service ClusterIPs are allocated from. It must not overlap the Pod or node networks." },
      ],
    },
  ],
  labs: [],
  diagrams: [
    {
      id: "architecture",
      root: {
        id: "cluster",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "kubectl",
            label: "kubectl",
            sub: "on your machine",
            detail: "The command-line client. It turns your commands and manifests into HTTPS requests to the API server.",
          },
          {
            id: "control-plane",
            label: "Control plane",
            sub: "stores desired state and decides what should happen",
            detail: "The components that run the cluster. You only ever talk to its API server.",
            children: [
              {
                id: "apiserver",
                label: "kube-apiserver",
                sub: "the only entry point",
                detail: "Authenticates, authorizes, admits, and validates every request, then stores the object. It is the only component that talks to etcd.",
              },
              {
                id: "etcd",
                label: "etcd",
                sub: "cluster state",
                detail: "A consistent key-value store that holds every object's spec and status.",
              },
              {
                id: "scheduler",
                label: "kube-scheduler",
                sub: "picks a node per Pod",
                detail: "Watches for Pods with no node, filters out nodes that cannot run them, scores the rest, and binds the Pod to the best one.",
              },
              {
                id: "controller-manager",
                label: "kube-controller-manager",
                sub: "runs the controllers",
                detail: "One binary running many controllers, such as the node, namespace, and endpoints controllers. Each watches some objects and acts to make reality match spec.",
              },
              {
                id: "cloud-controller-manager",
                label: "cloud-controller-manager",
                sub: "optional",
                detail: "Runs controllers that call a cloud provider's API, for example to create load balancers or to notice that a VM was deleted.",
              },
            ],
          },
          {
            id: "workers",
            label: "Worker nodes",
            sub: "each node talks only to the API server",
            children: [1, 2].map((n) => ({
              id: `worker-${n}`,
              label: `Worker node ${n}`,
              layout: "column" as const,
              children: [
                {
                  id: `kubelet-${n}`,
                  label: "kubelet",
                  sub: "node agent",
                  detail: "Registers the Node, watches for Pods bound to it, starts them through the CRI, runs probes, and reports status and heartbeats.",
                },
                {
                  id: `runtime-${n}`,
                  label: "container runtime",
                  sub: "containerd, CRI-O",
                  detail: "Pulls images and runs containers when the kubelet asks over the Container Runtime Interface.",
                },
                {
                  id: `proxy-${n}`,
                  label: "kube-proxy",
                  sub: "Service routing",
                  detail: "Watches Services and their endpoints and programs iptables or IPVS rules so traffic to a Service reaches one of its Pods.",
                },
              ],
            })),
          },
        ],
      },
      steps: [
        {
          title: "kubectl sends the Pod",
          text: "You run kubectl apply -f hello.yaml. kubectl sends the Pod to the API server as an HTTPS request.",
          highlight: ["kubectl", "apiserver"],
        },
        {
          title: "The API server stores it",
          text: "The API server authenticates and authorizes you, runs admission, validates the Pod, and saves it in etcd. kubectl returns now. The Pod is Pending with no node.",
          highlight: ["apiserver", "etcd"],
        },
        {
          title: "The scheduler binds it",
          text: "kube-scheduler is watching for Pods without a node. It filters and scores the nodes, picks worker node 1, and writes a binding that sets spec.nodeName.",
          highlight: ["scheduler", "apiserver", "etcd"],
        },
        {
          title: "The kubelet sees it",
          text: "The kubelet on worker node 1 watches for Pods bound to its node. The new binding reaches it through that watch.",
          highlight: ["apiserver", "kubelet-1"],
        },
        {
          title: "The runtime starts containers",
          text: "The kubelet calls the runtime over the CRI. The runtime pulls the image and starts the containers through runc.",
          highlight: ["kubelet-1", "runtime-1"],
        },
        {
          title: "Status flows back",
          text: "The kubelet writes the Pod's status (Running, its IP, container states) to the API server, which stores it in etcd. kubectl get pods now shows Running.",
          highlight: ["kubelet-1", "apiserver", "etcd", "kubectl"],
        },
      ],
    },
    {
      id: "api-hub",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "clients",
            label: "Clients of the API server",
            sub: "none of them call each other",
            detail: "Every component is a client of the API server. They coordinate by writing objects and watching for changes, never by calling each other.",
            children: [
              {
                id: "kubectl",
                label: "kubectl",
                sub: "you",
                detail: "Writes the objects you apply and reads them back for kubectl get.",
              },
              {
                id: "controller-manager",
                label: "kube-controller-manager",
                sub: "watches, writes objects",
                detail: "Its controllers watch objects such as Nodes, Namespaces, and Services and create, update, or delete other objects in response.",
              },
              {
                id: "scheduler",
                label: "kube-scheduler",
                sub: "watches Pods, writes bindings",
                detail: "Watches for Pods with no node and writes a binding that assigns each one to a node.",
              },
              {
                id: "kubelet",
                label: "kubelet",
                sub: "on every node",
                detail: "Watches for Pods bound to its node and writes their status, its Node status, and its Lease heartbeat back.",
              },
              {
                id: "kube-proxy",
                label: "kube-proxy",
                sub: "on every node",
                detail: "Watches Services and their endpoints and updates the node's network rules.",
              },
            ],
          },
          {
            id: "apiserver",
            label: "kube-apiserver",
            sub: "authenticates, validates, stores, notifies watchers",
            detail: "Every read, write, and watch goes through it. After it stores a change it notifies every client watching that kind of object.",
          },
          {
            id: "etcd",
            label: "etcd",
            sub: "only the API server talks to it",
            detail: "Holds all cluster state. Because only the API server reads and writes it, every change passes authentication and validation first.",
          },
        ],
      },
      steps: [
        {
          title: "A write",
          text: "You create a Pod with kubectl. The API server validates it and stores it in etcd.",
          highlight: ["kubectl", "apiserver", "etcd"],
        },
        {
          title: "A watch fires",
          text: "The scheduler is watching for Pods with no node. The API server tells it about the new Pod, and it writes a binding back through the API server.",
          highlight: ["scheduler", "apiserver", "etcd"],
        },
        {
          title: "Another watch fires",
          text: "The kubelet on the chosen node sees a Pod bound to it, starts the containers, and writes the Pod's status. kubectl, the scheduler, and the node never spoke to each other.",
          highlight: ["kubelet", "apiserver", "etcd"],
        },
      ],
    },
    {
      id: "cri-chain",
      root: {
        id: "chain",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "kubelet",
            label: "kubelet",
            sub: "decides what should run",
            detail: "Knows which Pods are bound to its node. It does not create containers itself; it asks the runtime to.",
          },
          {
            id: "cri",
            label: "CRI",
            sub: "gRPC over a local socket",
            detail: "The Container Runtime Interface: a gRPC API with two services. Any runtime that implements it can sit below the kubelet.",
            children: [
              {
                id: "image-service",
                label: "ImageService",
                sub: "pull, list, remove",
                detail: "Image calls: pull an image, list images, report image status, remove one.",
              },
              {
                id: "runtime-service",
                label: "RuntimeService",
                sub: "sandboxes, containers",
                detail: "Creates the Pod sandbox (shared network namespace), then creates, starts, stops, and inspects containers in it.",
              },
            ],
          },
          {
            id: "cri-runtime",
            label: "CRI runtime",
            sub: "containerd or CRI-O",
            detail: "A long-running daemon that serves the CRI. It pulls and stores images, sets up the sandbox, and hands each container to a low-level runtime.",
          },
          {
            id: "oci-runtime",
            label: "OCI runtime",
            sub: "runc",
            detail: "A small binary that implements the OCI runtime spec. It sets up Linux namespaces and cgroups, starts the process, and exits.",
          },
          {
            id: "container",
            label: "Container",
            sub: "a process on the node",
            detail: "An ordinary Linux process, isolated by namespaces and limited by cgroups, running from an OCI image's filesystem.",
          },
        ],
      },
      steps: [
        {
          title: "The kubelet needs a Pod running",
          text: "A Pod was bound to this node. The kubelet works out what is missing: the image, the sandbox, the containers.",
          highlight: ["kubelet"],
        },
        {
          title: "Pull the image",
          text: "The kubelet calls ImageService over the CRI socket. The runtime pulls the OCI image from the registry if it is not already on the node.",
          highlight: ["kubelet", "image-service", "cri-runtime"],
        },
        {
          title: "Create the sandbox and containers",
          text: "The kubelet calls RuntimeService to create the Pod sandbox, then to create and start each container in it.",
          highlight: ["kubelet", "runtime-service", "cri-runtime"],
        },
        {
          title: "runc starts the process",
          text: "containerd or CRI-O hands each container to runc, which creates the namespaces and cgroups and starts the process.",
          highlight: ["cri-runtime", "oci-runtime", "container"],
        },
        {
          title: "The kubelet keeps watching",
          text: "The kubelet polls container state through RuntimeService, runs probes, restarts containers per restartPolicy, and reports status to the API server.",
          highlight: ["kubelet", "runtime-service", "container"],
        },
      ],
    },
    {
      id: "ha-control-plane",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "clients",
            label: "kubectl, kubelets, kube-proxy",
            sub: "all use one address",
            detail: "Clients are configured with the load balancer's address, so they keep working when one control plane node is down.",
          },
          {
            id: "lb",
            label: "Load balancer",
            sub: "port 6443",
            detail: "Spreads requests across the API servers and stops sending to one that fails its health check.",
          },
          {
            id: "nodes",
            label: "",
            children: [1, 2, 3].map((n) => ({
              id: `cp-${n}`,
              label: `Control plane node ${n}`,
              layout: "column" as const,
              children: [
                {
                  id: `apiserver-${n}`,
                  label: "kube-apiserver",
                  sub: "active",
                  detail: "API servers keep no state of their own, so all of them serve requests at the same time.",
                },
                {
                  id: `scheduler-${n}`,
                  label: "kube-scheduler",
                  sub: n === 1 ? "leader" : "standby",
                  detail: "Only the leader schedules. The others wait and take over if the leader stops renewing its Lease.",
                },
                {
                  id: `cm-${n}`,
                  label: "kube-controller-manager",
                  sub: n === 2 ? "leader" : "standby",
                  detail: "Same leader election as the scheduler, with its own Lease. Two active copies would fight over the same objects.",
                },
              ],
            })),
          },
          {
            id: "etcd",
            label: "etcd cluster",
            sub: "3 members, quorum 2",
            detail: "Members replicate every write with the Raft protocol. A write commits once a majority has it, so 3 members survive the loss of 1.",
            children: [1, 2, 3].map((n) => ({
              id: `etcd-${n}`,
              label: `etcd member ${n}`,
              sub: n === 1 ? "Raft leader" : "follower",
              detail: "Each member holds a full copy of the data. Often runs on the same node as an API server (stacked) or on its own machines (external).",
            })),
          },
        ],
      },
      steps: [
        {
          title: "One entry point",
          text: "Every client talks to the load balancer, which forwards to any healthy API server.",
          highlight: ["clients", "lb"],
        },
        {
          title: "All API servers are active",
          text: "Each API server can handle any request because the state lives in etcd, not in the API server.",
          highlight: ["apiserver-1", "apiserver-2", "apiserver-3"],
        },
        {
          title: "One active scheduler and controller manager",
          text: "The scheduler and controller manager run on every node, but leader election through Lease objects lets only one copy of each act at a time.",
          highlight: ["scheduler-1", "cm-2"],
        },
        {
          title: "etcd keeps quorum",
          text: "A write needs 2 of 3 etcd members. Lose one member and the cluster keeps working; lose two and it stops accepting writes.",
          highlight: ["etcd", "etcd-1", "etcd-2", "etcd-3"],
        },
      ],
    },
    {
      id: "reconcile-loop",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "loop",
            label: "The control loop",
            sub: "every controller runs this, forever",
            detail: "A controller never runs once and stops. It keeps watching, so it also repairs drift that nobody asked it to fix.",
            flow: true,
            children: [
              {
                id: "watch",
                label: "Watch",
                sub: "through the API server",
                detail: "The controller subscribes to changes for the objects it cares about. The API server pushes every create, update, and delete.",
              },
              {
                id: "compare",
                label: "Compare",
                sub: "desired vs observed",
                detail: "It compares what should be true with what the cluster currently reports.",
              },
              {
                id: "act",
                label: "Act",
                sub: "write through the API server",
                detail: "If there is a gap, it writes a change to close it. It never touches containers or etcd directly.",
              },
              {
                id: "repeat",
                label: "Repeat",
                sub: "back to watch",
                detail: "Its own change triggers new events, so the loop runs again until nothing is left to do.",
              },
            ],
          },
          {
            id: "example",
            label: "Example: a worker node fails",
            sub: "seen by the node controller",
            detail: "The node controller in kube-controller-manager runs the loop on Node objects and their heartbeats.",
            layout: "column",
            flow: true,
            children: [
              {
                id: "ex-heartbeats",
                label: "Heartbeats arrive",
                sub: "Lease renewed every 10s",
                detail: "The kubelet renews its Lease in kube-node-lease. The node controller sees fresh heartbeats and does nothing.",
              },
              {
                id: "ex-silent",
                label: "Heartbeats stop",
                sub: "node lost power or network",
                detail: "No kubelet is renewing the Lease. Nothing on the node can report anything.",
              },
              {
                id: "ex-unknown",
                label: "Node marked NotReady",
                sub: "Ready condition Unknown, taint added",
                detail: "After a grace period the node controller sets the Ready condition to Unknown and adds the node.kubernetes.io/unreachable NoExecute taint.",
              },
              {
                id: "ex-evict",
                label: "Pods evicted after 5 minutes",
                sub: "tolerationSeconds: 300",
                detail: "Pods tolerate that taint for 300 seconds by default. When the toleration runs out, they are deleted.",
              },
              {
                id: "ex-replace",
                label: "Owners create replacements",
                sub: "scheduler places them elsewhere",
                detail: "A controller that owns an evicted Pod creates a replacement, which the scheduler binds to a healthy node. A Pod with no owner is simply gone.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Steady state",
          text: "The node controller watches Nodes and their Leases. Every node is heartbeating, so there is nothing to do.",
          highlight: ["watch", "ex-heartbeats"],
        },
        {
          title: "Something changes",
          text: "A node stops renewing its Lease. The controller's next comparison finds a heartbeat that is too old.",
          highlight: ["compare", "ex-silent"],
        },
        {
          title: "Act",
          text: "The node controller marks the node's Ready condition Unknown and taints it. kubectl get nodes shows NotReady.",
          highlight: ["act", "ex-unknown"],
        },
        {
          title: "Eviction",
          text: "Five minutes later the Pods' default tolerations expire and the Pods on the node are deleted.",
          highlight: ["act", "ex-evict"],
        },
        {
          title: "Other loops take over",
          text: "Controllers that own those Pods see them gone and create replacements. Each controller only closes its own gap.",
          highlight: ["repeat", "ex-replace"],
        },
      ],
    },
  ],
};
