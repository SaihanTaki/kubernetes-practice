import type { ChapterData } from "../types";
import { quiz } from "./daemonsets-statefulsets.quiz";

const agent = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      containers:
        - name: agent
          image: busybox:1.36
          command: ["sleep", "3600"]
`;

const web = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - name: http
      port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web
  replicas: 1
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
          image: nginx:1.27
          ports:
            - containerPort: 80
              name: http
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
`;

const getPods = (n: number) => Array.from({ length: n }, () => "kubectl get pods");

export const data: ChapterData = {
  objectives: [
    "Pick between a Deployment, a DaemonSet, and a StatefulSet for a given workload.",
    "Control which nodes a DaemonSet runs on with tolerations and a nodeSelector.",
    "Explain StatefulSet ordinals, per-Pod DNS through a headless Service, and ordered startup.",
    "Show that data in a volumeClaimTemplates PVC survives when its Pod is deleted and recreated.",
  ],
  quiz,
  manifests: [
    {
      id: "daemonset-log-agent",
      title: "log-agent-daemonset.yaml",
      yaml: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
  labels:
    app: log-agent
spec:
  selector:
    matchLabels:
      app: log-agent
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: agent
          image: fluent/fluent-bit:3.1
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log`,
      notes: [
        { line: 2, text: "DaemonSet is in the apps/v1 group, like Deployment. There is no replicas field: the node count decides." },
        { line: 4, text: "Pods are named log-agent-<5 random characters>, one per eligible node." },
        { line: 8, text: "Must match the template labels, and cannot be changed after creation, as with a Deployment." },
        { line: 11, text: "How Pods are replaced when the template changes. RollingUpdate is the default; OnDelete waits until you delete each Pod yourself." },
        { line: 14, text: "At most one node without a ready agent during an update. The old Pod on a node is removed before the new one starts." },
        { line: 20, text: "Restricts the DaemonSet to nodes with this label. Nodes without it get no Pod." },
        { line: 21, text: "Every node carries kubernetes.io/os. This keeps a Linux-only agent off Windows nodes in a mixed cluster." },
        { line: 22, text: "Without tolerations the control plane taint keeps the agent off that node, so its logs would never be collected." },
        { line: 23, text: "The taint key kubeadm and most installers put on control plane nodes." },
        { line: 24, text: "Exists matches the key whatever its value. The control plane taint has an empty value." },
        { line: 25, text: "Tolerates only NoSchedule. Leave effect out to tolerate every effect for this key." },
        { line: 29, text: "Agents run on every node, so their requests are reserved on every node. Keep them small." },
        { line: 33, text: "A memory limit stops a leaking agent from taking memory from the node's real workloads." },
        { line: 39, text: "Two parts: the volume below says where the data comes from, volumeMounts says where the container sees it." },
        { line: 41, text: "hostPath mounts a directory from the node itself, which is how a log agent reads that node's log files." },
      ],
    },
    {
      id: "headless-service-web",
      title: "web-service.yaml",
      yaml: `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - name: http
      port: 80`,
      notes: [
        { line: 4, text: "The StatefulSet's serviceName must be this name. Create the Service first or together with the StatefulSet." },
        { line: 6, text: "None makes the Service headless: no virtual IP and no load balancing. DNS returns Pod IPs and gets a record per Pod, such as web-0.web." },
        { line: 7, text: "Same selector as any Service. It decides which Pods get DNS records." },
        { line: 10, text: "Nothing is proxied, so ports are optional on a headless Service. A named port gets a DNS SRV record, such as _http._tcp.web." },
      ],
    },
    {
      id: "statefulset-web",
      title: "web-statefulset.yaml",
      yaml: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web
  replicas: 3
  podManagementPolicy: OrderedReady
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
          image: nginx:1.27
          ports:
            - containerPort: 80
              name: http
          volumeMounts:
            - name: data
              mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: standard
        resources:
          requests:
            storage: 1Gi`,
      notes: [
        { line: 2, text: "StatefulSet is in apps/v1. It manages Pods directly; there is no ReplicaSet in between." },
        { line: 4, text: "Pods are named web-0, web-1, web-2. The name plus the ordinal is the Pod's identity." },
        { line: 6, text: "The headless Service from the previous file. It gives each Pod a DNS name: web-0.web.<namespace>.svc.cluster.local." },
        { line: 7, text: "Ordinals run from 0 to replicas - 1. Scaling down removes the highest ordinal first." },
        { line: 8, text: "The default. Pods start one at a time, each after the previous is Running and ready. Parallel starts and stops them all at once." },
        { line: 9, text: "Must match the template labels, and cannot be changed after creation." },
        { line: 24, text: "Refers to the claim template below by name. There is no matching entry under volumes." },
        { line: 25, text: "nginx serves files from here, so each Pod serves whatever is on its own volume." },
        { line: 26, text: "A PVC template. Each Pod gets its own claim named <template>-<statefulset>-<ordinal>: data-web-0, data-web-1, data-web-2." },
        { line: 28, text: "The template name. It is the first part of every PVC name and the name volumeMounts uses." },
        { line: 30, text: "ReadWriteOnce: one node mounts the volume at a time, which is fine because each claim belongs to one Pod." },
        { line: 31, text: "The StorageClass that provisions a volume for each claim. Leave it out to use the cluster's default class." },
        { line: 34, text: "Size of each Pod's volume. Changing volumeClaimTemplates on an existing StatefulSet is rejected." },
      ],
    },
  ],
  labs: [
    {
      id: "daemonsets-statefulsets-agent-and-web",
      title: "Cover every node, then keep web-0's data",
      difficulty: "intermediate",
      scenario:
        "agent.yaml runs a log-agent DaemonSet, but it is missing from the control plane node. web.yaml runs a headless Service and a StatefulSet web with one replica and a 1Gi volume per Pod. You need the agent on all three nodes, three web Pods, and proof that web-0's data outlives the Pod.",
      instructions: [
        "Run kubectl get nodes, kubectl get daemonset log-agent, and kubectl get pods -o wide. Note which node has no log-agent Pod.",
        "Run kubectl describe node control-plane and find its taint.",
        "Add a toleration for that taint to the Pod template in agent.yaml in the Files panel, then run kubectl apply -f agent.yaml.",
        "Run kubectl get pods until log-agent has 3 ready Pods.",
        "Scale the web StatefulSet to 3 replicas. Run kubectl get pods and kubectl get pvc until web-0, web-1, and web-2 are all Running.",
        "Write a file into web-0's volume: kubectl exec web-0 -- sh -c 'echo hello from web-0 > /usr/share/nginx/html/index.html'",
        "Delete Pod web-0, wait for the StatefulSet to recreate it, then read the file again with kubectl exec web-0 -- cat /usr/share/nginx/html/index.html",
      ],
      fixture: { files: { "agent.yaml": agent, "web.yaml": web }, apply: ["agent.yaml", "web.yaml"] },
      objectives: [
        {
          id: "agent",
          description: "log-agent has 3 ready Pods, one on each node.",
          validator: { kind: "daemonset-pods", name: "log-agent", expectedValue: 3 },
        },
        {
          id: "replicas",
          description: "The web StatefulSet asks for 3 replicas.",
          validator: { kind: "replica-count", resourceType: "StatefulSet", resourceName: "web", expectedValue: 3 },
        },
        {
          id: "ready",
          description: "3 Pods owned by web are ready.",
          validator: { kind: "ready-pod-count", ownerType: "StatefulSet", ownerName: "web", expectedValue: 3 },
        },
        {
          id: "file",
          description: "web-0 has /usr/share/nginx/html/index.html containing hello from web-0.",
          validator: {
            kind: "file-content",
            podName: "web-0",
            path: "/usr/share/nginx/html/index.html",
            expectedValue: "hello from web-0",
          },
        },
      ],
      hints: [
        "The control plane node has the taint node-role.kubernetes.io/control-plane:NoSchedule. Pods that do not tolerate it are never placed there.",
        "Under the template's spec, next to containers, add tolerations: with key: node-role.kubernetes.io/control-plane, operator: Exists, and effect: NoSchedule.",
        "Changing the template makes the DaemonSet replace its Pods one node at a time. Keep running kubectl get pods.",
        "kubectl scale statefulset web --replicas=3. web-1 is created only after web-0 is ready, and web-2 after web-1.",
        "kubectl delete pod web-0. The new web-0 mounts the same claim, data-web-0, so the file is still there.",
      ],
      solutionFiles: {
        "agent.yaml": agent.replace(
          "    spec:\n      containers:\n",
          "    spec:\n      tolerations:\n        - key: node-role.kubernetes.io/control-plane\n          operator: Exists\n          effect: NoSchedule\n      containers:\n",
        ),
      },
      solution: [
        "kubectl apply -f agent.yaml",
        ...getPods(8),
        "kubectl get daemonset log-agent",
        "kubectl scale statefulset web --replicas=3",
        ...getPods(6),
        "kubectl get pvc",
        "kubectl exec web-0 -- sh -c 'echo hello from web-0 > /usr/share/nginx/html/index.html'",
        "kubectl delete pod web-0",
        ...getPods(3),
        "kubectl exec web-0 -- cat /usr/share/nginx/html/index.html",
      ],
    },
  ],
  diagrams: [
    {
      id: "daemonset-nodes",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-taint",
            label: "No toleration",
            sub: "2 Pods on 3 nodes",
            detail: "The DaemonSet wants one Pod per eligible node. The control plane taint makes that node ineligible.",
            children: [
              { id: "t-cp", label: "control-plane", sub: "tainted, no Pod", detail: "Taint node-role.kubernetes.io/control-plane:NoSchedule. The log-agent Pod does not tolerate it, so the node is skipped." },
              { id: "t-w1", label: "worker-1", sub: "log-agent Pod", detail: "No taints, so the DaemonSet runs one Pod here." },
              { id: "t-w2", label: "worker-2", sub: "log-agent Pod", detail: "Same as worker-1. Each Pod reads only its own node's logs." },
            ],
          },
          {
            id: "stage-tolerate",
            label: "Toleration added",
            sub: "3 Pods on 3 nodes",
            detail: "The template now tolerates the control plane taint, so every node is eligible. Changing the template also replaces the worker Pods, one node at a time.",
            children: [
              { id: "o-cp", label: "control-plane", sub: "log-agent Pod", detail: "The taint is still there. The Pod tolerates it, so the scheduler may place it here." },
              { id: "o-w1", label: "worker-1", sub: "log-agent Pod", detail: "Replaced with a Pod from the new template." },
              { id: "o-w2", label: "worker-2", sub: "log-agent Pod", detail: "Replaced after worker-1's new Pod was ready, because maxUnavailable is 1." },
            ],
          },
          {
            id: "stage-join",
            label: "worker-3 joins",
            sub: "4 Pods on 4 nodes",
            detail: "Nobody edits the DaemonSet. The controller sees a new eligible node and creates a Pod for it.",
            children: [
              { id: "j-cp", label: "control-plane", sub: "log-agent Pod", detail: "Unchanged." },
              { id: "j-w1", label: "worker-1", sub: "log-agent Pod", detail: "Unchanged." },
              { id: "j-w2", label: "worker-2", sub: "log-agent Pod", detail: "Unchanged." },
              { id: "j-w3", label: "worker-3", sub: "new log-agent Pod", detail: "Created as soon as the node is Ready. A nodeSelector the node does not match would keep it off." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Taint blocks the control plane",
          text: "Without a toleration, the DaemonSet only counts the two workers as eligible. DESIRED is 2.",
          highlight: ["stage-taint", "t-cp"],
        },
        {
          title: "One Pod per worker",
          text: "Each worker gets exactly one log-agent Pod. There is no replica count to set.",
          highlight: ["t-w1", "t-w2"],
        },
        {
          title: "Add the toleration",
          text: "With a toleration for node-role.kubernetes.io/control-plane, the control plane becomes eligible and gets a Pod. DESIRED is 3.",
          highlight: ["stage-tolerate", "o-cp"],
        },
        {
          title: "Nodes join, Pods follow",
          text: "A new worker gets a Pod automatically. Removing a node removes its Pod.",
          highlight: ["stage-join", "j-w3"],
        },
      ],
    },
    {
      id: "statefulset-ordered",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-0",
            label: "Create web-0",
            sub: "replicas: 3, OrderedReady",
            detail: "The StatefulSet starts with the lowest ordinal and waits for it before going on.",
            children: [
              { id: "s0-pod", label: "web-0", sub: "starting", detail: "Created first. web-1 does not exist until this Pod is Running and ready." },
              { id: "s0-pvc", label: "PVC data-web-0", sub: "Bound", detail: "Created from the claim template for ordinal 0 and bound to a new volume." },
            ],
          },
          {
            id: "stage-1",
            label: "Create web-1",
            sub: "web-0 ready",
            detail: "web-0 passed its readiness check, so the next ordinal starts.",
            children: [
              { id: "s1-pod0", label: "web-0", sub: "Running", detail: "Ready, with data-web-0 mounted." },
              { id: "s1-pod1", label: "web-1", sub: "starting", detail: "Gets its own claim, data-web-1. It never sees web-0's files." },
            ],
          },
          {
            id: "stage-2",
            label: "Create web-2",
            sub: "web-1 ready",
            detail: "Same again for the last ordinal. After this, all three Pods are Running.",
            children: [
              { id: "s2-pod0", label: "web-0", sub: "Running", detail: "Unchanged." },
              { id: "s2-pod1", label: "web-1", sub: "Running", detail: "Ready, with data-web-1 mounted." },
              { id: "s2-pod2", label: "web-2", sub: "starting", detail: "Gets data-web-2." },
            ],
          },
          {
            id: "stage-3",
            label: "Delete web-0",
            sub: "same name, same claim",
            detail: "The StatefulSet recreates the missing ordinal with the same name and mounts the same PVC.",
            children: [
              { id: "s3-pod0", label: "web-0 (new Pod)", sub: "starting", detail: "A new Pod, possibly on another node, with the old name and DNS record." },
              { id: "s3-pvc", label: "PVC data-web-0", sub: "Bound, data kept", detail: "The claim was never deleted, so the files written before are still on it." },
            ],
          },
          {
            id: "stage-4",
            label: "Scale to 1",
            sub: "highest ordinal first",
            detail: "Scale down removes web-2, waits for it to be gone, then removes web-1.",
            children: [
              { id: "s4-pod0", label: "web-0", sub: "Running", detail: "The lowest ordinal is always kept." },
              { id: "s4-pvcs", label: "PVCs data-web-1, data-web-2", sub: "kept", detail: "Not deleted. Scale back to 3 and web-1 and web-2 mount them again." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "web-0 and its claim",
          text: "The StatefulSet creates web-0 and the claim data-web-0 from the template. Nothing else starts yet.",
          highlight: ["stage-0", "s0-pod", "s0-pvc"],
        },
        {
          title: "web-1 after web-0 is ready",
          text: "Once web-0 is Running and ready, web-1 starts with its own claim, data-web-1.",
          highlight: ["stage-1", "s1-pod1"],
        },
        {
          title: "web-2 last",
          text: "web-2 waits for web-1. With podManagementPolicy: Parallel all three would start together.",
          highlight: ["stage-2", "s2-pod2"],
        },
        {
          title: "A deleted Pod comes back as itself",
          text: "Delete web-0 and a new web-0 appears, mounting data-web-0 again. Its data and DNS name are unchanged.",
          highlight: ["stage-3", "s3-pod0", "s3-pvc"],
        },
        {
          title: "Scale down, keep the data",
          text: "Scaling to 1 removes web-2, then web-1. Their claims stay until you delete them.",
          highlight: ["stage-4", "s4-pvcs"],
        },
      ],
    },
  ],
};
