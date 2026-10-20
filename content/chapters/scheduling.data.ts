import type { ChapterData } from "../types";
import { quiz } from "./scheduling.quiz";

const fastWeb = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: fast-web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fast-web
  template:
    metadata:
      labels:
        app: fast-web
    spec:
      nodeSelector:
        disk: ssd
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
`;

export const data: ChapterData = {
  objectives: [
    "Explain how the scheduler filters and scores nodes before it sets a Pod's nodeName.",
    "Steer Pods with node labels, nodeSelector, node affinity, and pod anti-affinity.",
    "Use taints and tolerations together with affinity to dedicate nodes to a workload.",
    "Cordon, drain, and uncordon a node for maintenance.",
    "Read a FailedScheduling event and tell which rule kept a Pod Pending.",
  ],
  quiz,
  manifests: [
    {
      id: "scheduling-api",
      title: "api-deployment.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: disk
                    operator: In
                    values: ["ssd"]
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 50
              preference:
                matchExpressions:
                  - key: topology.kubernetes.io/zone
                    operator: In
                    values: ["zone-a"]
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: api
              topologyKey: kubernetes.io/hostname
      tolerations:
        - key: dedicated
          operator: Equal
          value: api
          effect: NoSchedule
      containers:
        - name: api
          image: example/api:1.1
          ports:
            - containerPort: 8080`,
      notes: [
        { line: 13, text: "The anti-affinity rule below selects Pods by this label, so each replica avoids its own siblings." },
        { line: 15, text: "All affinity rules live under spec.affinity of the Pod template, not on the Deployment itself." },
        { line: 16, text: "Rules about node labels. Pod affinity and anti-affinity are separate blocks next to it." },
        { line: 17, text: "A hard rule: a node that does not match is filtered out. IgnoredDuringExecution means Pods already running stay put if the node's labels change later." },
        { line: 18, text: "Terms in this list are ORed: a node that matches any one term passes." },
        { line: 19, text: "Expressions inside one term are ANDed: the node must match all of them." },
        { line: 21, text: "Operators are In, NotIn, Exists, DoesNotExist, Gt and Lt. NotIn and DoesNotExist give you node anti-affinity." },
        { line: 22, text: "Only nodes labelled disk=ssd pass. This expression does the same job as nodeSelector: {disk: ssd}." },
        { line: 23, text: "A soft rule. It never filters a node out; it only adds to the score of nodes that match." },
        { line: 24, text: "1 to 100. The scheduler adds the weight of every matching preference to a node's score." },
        { line: 27, text: "A well-known label set on nodes by the cloud provider or the cluster installer." },
        { line: 30, text: "Rules about which Pods already run in a topology domain, not about the node's own labels." },
        { line: 31, text: "Hard: a node is rejected if its domain already runs a matching Pod. With more replicas than nodes, the extras stay Pending." },
        { line: 32, text: "Which existing Pods count. Here, other api Pods." },
        { line: 35, text: "The node label that defines a domain. kubernetes.io/hostname means one node per domain, so at most one api Pod per node. topology.kubernetes.io/zone would mean one per zone." },
        { line: 36, text: "Tolerations let the Pod onto nodes with a matching taint. They do not pull it there; the affinity rules do that." },
        { line: 38, text: "Equal compares key and value. Exists matches any value of the key, and is the only choice when you leave value out." },
        { line: 40, text: "Matches only a NoSchedule taint. Leaving effect empty tolerates every effect of this key." },
      ],
    },
  ],
  labs: [
    {
      id: "scheduling-place-pods",
      title: "Place Pods with labels, taints, and drain",
      difficulty: "intermediate",
      scenario:
        "The fast-web Deployment (from fast-web.yaml) needs an SSD node, but its Pods are Pending. After that, worker-1 is to be reserved for batch jobs, and worker-2 needs a maintenance window.",
      instructions: [
        "Run kubectl get pods and kubectl describe pod on one fast-web Pod. Read the FailedScheduling event.",
        "Run kubectl get nodes --show-labels. Label worker-2 with disk=ssd, then run kubectl get pods -o wide until both fast-web Pods run on worker-2.",
        "Taint worker-1 with dedicated=batch:NoSchedule.",
        "Create a Deployment named reports with image nginx:1.27 and 2 replicas. Check with kubectl get pods -o wide that neither Pod went to worker-1.",
        "Drain worker-2 with --ignore-daemonsets. Run kubectl get pods and notice that the replacement Pods have nowhere to go.",
        "Uncordon worker-2 and run kubectl get pods -o wide until nothing is Pending.",
      ],
      fixture: { files: { "fast-web.yaml": fastWeb }, apply: ["fast-web.yaml"] },
      objectives: [
        {
          id: "label",
          description: "worker-2 has the label disk=ssd.",
          validator: { kind: "node-label", nodeName: "worker-2", key: "disk", expectedValue: "ssd" },
        },
        {
          id: "fast-web-pending",
          description: "No fast-web Pod is Pending.",
          validator: { kind: "pending-pod-count", ownerType: "Deployment", ownerName: "fast-web", expectedValue: 0 },
        },
        {
          id: "fast-web-node",
          description: "Every fast-web Pod runs on worker-2.",
          validator: { kind: "pod-node", ownerType: "Deployment", ownerName: "fast-web", expectedValue: "worker-2" },
        },
        {
          id: "taint",
          description: "worker-1 has the taint dedicated=batch:NoSchedule.",
          validator: { kind: "node-taint", nodeName: "worker-1", key: "dedicated", effect: "NoSchedule", present: true },
        },
        {
          id: "reports-node",
          description: "Every reports Pod runs on worker-2, away from the tainted worker-1.",
          validator: { kind: "pod-node", ownerType: "Deployment", ownerName: "reports", expectedValue: "worker-2" },
        },
        {
          id: "reports-pending",
          description: "No reports Pod is Pending.",
          validator: { kind: "pending-pod-count", ownerType: "Deployment", ownerName: "reports", expectedValue: 0 },
        },
        {
          id: "uncordoned",
          description: "worker-2 accepts new Pods again after the drain.",
          validator: { kind: "node-schedulable", nodeName: "worker-2", expectedValue: true },
        },
      ],
      hints: [
        "The FailedScheduling message counts nodes per reason. \"didn't match Pod's node affinity/selector\" means no node carries disk=ssd yet.",
        "kubectl label node worker-2 disk=ssd. Pending Pods are retried after every command.",
        "kubectl taint nodes worker-1 dedicated=batch:NoSchedule. The control plane is already tainted, so worker-2 is the only place left for reports.",
        "kubectl create deployment reports --image=nginx:1.27 --replicas=2",
        "kubectl drain worker-2 --ignore-daemonsets cordons the node and evicts its Pods. Their replacements stay Pending: fast-web needs disk=ssd and reports does not tolerate worker-1's taint.",
        "kubectl uncordon worker-2 lets the Pending Pods schedule again.",
      ],
      solution: [
        "kubectl get pods",
        "kubectl label node worker-2 disk=ssd",
        "kubectl get pods -o wide",
        "kubectl get pods -o wide",
        "kubectl taint nodes worker-1 dedicated=batch:NoSchedule",
        "kubectl create deployment reports --image=nginx:1.27 --replicas=2",
        "kubectl get pods -o wide",
        "kubectl get pods -o wide",
        "kubectl drain worker-2 --ignore-daemonsets",
        "kubectl get pods",
        "kubectl uncordon worker-2",
        "kubectl get pods -o wide",
        "kubectl get pods -o wide",
        "kubectl get pods -o wide",
      ],
    },
  ],
  diagrams: [
    {
      id: "scheduling-pipeline",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "pod",
            label: "Pod web-5d8f7c9b4-x2kqp",
            sub: "nodeName empty, requests cpu 500m",
            detail: "A new Pod has no spec.nodeName, so the scheduler picks it up. It requests 500m CPU and prefers nodes labelled disk=ssd.",
          },
          {
            id: "filter",
            label: "1. Filter",
            sub: "drop nodes that cannot run it",
            detail: "Every hard rule is checked against every node: taints, nodeSelector, required affinity, free resources, cordon. A node that fails any check is out.",
            children: [
              {
                id: "f-cp",
                label: "control-plane",
                sub: "out: untolerated taint",
                detail: "Has the taint node-role.kubernetes.io/control-plane:NoSchedule and the Pod has no matching toleration.",
              },
              {
                id: "f-w1",
                label: "worker-1",
                sub: "passes",
                detail: "No taints, enough free CPU, and the Pod has no required rule that worker-1 breaks.",
              },
              {
                id: "f-w2",
                label: "worker-2",
                sub: "passes",
                detail: "Also feasible. With two nodes left, scoring decides between them.",
              },
            ],
          },
          {
            id: "score",
            label: "2. Score",
            sub: "rank the nodes that passed",
            detail: "Scoring plugins rate each feasible node: preferred affinity weights, spreading, how much is already allocated. The highest total wins.",
            children: [
              {
                id: "s-w1",
                label: "worker-1",
                sub: "no disk=ssd label",
                detail: "Gets nothing from the preferred node affinity rule, so it scores lower.",
              },
              {
                id: "s-w2",
                label: "worker-2",
                sub: "disk=ssd: +weight",
                detail: "Matches the preferred rule, so its weight is added to the score. It wins.",
              },
            ],
          },
          {
            id: "bind",
            label: "3. Bind",
            sub: "nodeName: worker-2",
            detail: "The scheduler writes the node name into the Pod through a Binding. The kubelet on worker-2 sees a Pod assigned to it and starts the containers.",
          },
        ],
      },
      steps: [
        {
          title: "A Pod without a node",
          text: "The scheduler watches for Pods whose spec.nodeName is empty. This one requests 500m CPU and prefers disk=ssd.",
          highlight: ["pod"],
        },
        {
          title: "Filter out control-plane",
          text: "control-plane has a NoSchedule taint the Pod does not tolerate, so it is removed from the list.",
          highlight: ["filter", "f-cp"],
        },
        {
          title: "Two feasible nodes",
          text: "worker-1 and worker-2 pass every hard rule. If none had passed, the Pod would stay Pending with a FailedScheduling event.",
          highlight: ["f-w1", "f-w2"],
        },
        {
          title: "Score the survivors",
          text: "worker-2 carries disk=ssd, so the preferred affinity weight lifts its score above worker-1.",
          highlight: ["score", "s-w1", "s-w2"],
        },
        {
          title: "Bind",
          text: "The scheduler sets nodeName to worker-2. From here on the kubelet on worker-2 owns the Pod.",
          highlight: ["bind"],
        },
      ],
    },
    {
      id: "scheduling-dedicated",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "nodes",
            label: "Nodes",
            children: [
              {
                id: "n-w1",
                label: "worker-1",
                sub: "taint dedicated=batch:NoSchedule, label dedicated=batch",
                detail: "The taint keeps ordinary Pods off. The label gives batch Pods something to select with affinity.",
              },
              {
                id: "n-w2",
                label: "worker-2",
                sub: "no taint",
                detail: "An ordinary node. Any Pod may land here, including batch Pods that only have a toleration.",
              },
            ],
          },
          {
            id: "pods",
            label: "Pods",
            children: [
              {
                id: "p-web",
                label: "web",
                sub: "no toleration: worker-2 only",
                detail: "The taint filters worker-1 out for this Pod, so it can only go to worker-2.",
              },
              {
                id: "p-tol",
                label: "batch, toleration only",
                sub: "worker-1 or worker-2",
                detail: "The toleration lets it onto worker-1 but does not send it there. The scheduler may well pick worker-2.",
              },
              {
                id: "p-both",
                label: "batch, toleration + affinity",
                sub: "worker-1 only",
                detail: "Required node affinity on dedicated=batch filters out worker-2, and the toleration lets it past worker-1's taint.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Taint and label the node",
          text: "worker-1 gets a taint to repel other Pods and a label so batch Pods can find it.",
          highlight: ["n-w1"],
        },
        {
          title: "The taint repels",
          text: "web has no toleration, so worker-1 is filtered out and it lands on worker-2.",
          highlight: ["p-web", "n-w2"],
        },
        {
          title: "A toleration alone is not enough",
          text: "A batch Pod with only a toleration may run on either node. Nothing pulls it to worker-1.",
          highlight: ["p-tol", "n-w1", "n-w2"],
        },
        {
          title: "Toleration plus affinity",
          text: "Add required node affinity for dedicated=batch. Now worker-1 is the only node that passes, and the toleration lets the Pod onto it.",
          highlight: ["p-both", "n-w1"],
        },
      ],
    },
  ],
};
