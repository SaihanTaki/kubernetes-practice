import type { ChapterData } from "../types";
import { quiz } from "./services.quiz";

const webDeploy = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
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
`;

const webSvc = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
`;

const apiDeploy = `apiVersion: apps/v1
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
      containers:
        - name: api
          image: example/api:1.1
          ports:
            - containerPort: 8080
`;

export const data: ChapterData = {
  objectives: [
    "Explain why clients should use a Service instead of Pod IPs, and resolve a Service by its DNS name.",
    "Trace how a selector turns into endpoints, and how port, targetPort, containerPort, and nodePort connect.",
    "Choose between ClusterIP, NodePort, and LoadBalancer, and create each with kubectl expose or a manifest.",
    "Debug a Service that has no endpoints.",
  ],
  quiz,
  manifests: [
    {
      id: "service-clusterip",
      title: "api-service.yaml",
      yaml: `apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: default
  labels:
    app: api
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8080`,
      notes: [
        { line: 1, text: "Services are in the core API group, so the version is plain v1, like Pods." },
        { line: 4, text: "The Service name becomes its DNS name: api.default.svc.cluster.local, or just api from the same namespace." },
        { line: 5, text: "A Service only selects Pods in its own namespace." },
        { line: 6, text: "Labels on the Service itself. They are for filtering Services and do not affect which Pods it selects." },
        { line: 9, text: "ClusterIP is the default, so this line can be left out. The Service gets a virtual IP reachable only inside the cluster." },
        { line: 10, text: "A plain map of labels, not matchLabels. Every Pod in the namespace with all of these labels, and ready, becomes an endpoint." },
        { line: 11, text: "Must match the Pod template labels of the Deployment, not the Deployment's own labels or name." },
        { line: 13, text: "A port name. Required once a Service has more than one port, and useful in logs and EndpointSlices." },
        { line: 14, text: "TCP is the default. UDP and SCTP are the other options." },
        { line: 15, text: "The port clients connect to on the ClusterIP or DNS name." },
        { line: 16, text: "The port on the Pod that traffic is sent to. It must be where the container listens (containerPort 8080 in the api Deployment). Defaults to port if left out." },
      ],
    },
    {
      id: "service-nodeport",
      title: "api-public-service.yaml",
      yaml: `apiVersion: v1
kind: Service
metadata:
  name: api-public
spec:
  type: NodePort
  selector:
    app: api
  ports:
    - name: http
      port: 80
      targetPort: 8080
      nodePort: 30080`,
      notes: [
        { line: 4, text: "A second Service for the same Pods. Inside the cluster it is reachable as api-public." },
        { line: 6, text: "NodePort keeps the ClusterIP and also opens nodePort on every node in the cluster." },
        { line: 8, text: "The same selector as the api ClusterIP Service. Both Services send traffic to the same Pods." },
        { line: 11, text: "The ClusterIP port, used by clients inside the cluster." },
        { line: 12, text: "The container port, 8080, same as before." },
        { line: 13, text: "Clients outside the cluster connect to <node-ip>:30080. Must be in the node port range, 30000 to 32767 by default. Leave it out and Kubernetes picks a free one." },
      ],
    },
  ],
  labs: [
    {
      id: "services-fix-selector",
      title: "Fix a Service with no endpoints",
      difficulty: "intermediate",
      scenario:
        "The web Deployment and its Service were applied from the files in this directory, but requests to the web Service fail. A second Deployment, api, has no Service yet and needs to be reachable from outside the cluster.",
      instructions: [
        "Run kubectl get services and kubectl get endpoints. Note which Service has no endpoints.",
        "Run kubectl describe service web and kubectl get pods --show-labels. Compare the Service selector with the Pod labels.",
        "Fix the selector in web-svc.yaml in the Files panel, apply it, and check that web has 2 endpoints.",
        "The api Pods listen on 8080. Expose the api Deployment with a NodePort Service named api on port 80, targeting port 8080.",
        "Run kubectl get services to find the node port, and kubectl get endpoints api to confirm both api Pods are listed.",
      ],
      fixture: {
        files: { "web-deploy.yaml": webDeploy, "web-svc.yaml": webSvc, "api-deploy.yaml": apiDeploy },
        apply: ["web-deploy.yaml", "web-svc.yaml", "api-deploy.yaml"],
      },
      objectives: [
        {
          id: "web-endpoints",
          description: "The web Service has 2 endpoints.",
          validator: { kind: "endpoint-count", serviceName: "web", expectedValue: 2 },
        },
        {
          id: "api-service",
          description: "A NodePort Service named api exists.",
          validator: { kind: "service-type", serviceName: "api", expectedValue: "NodePort" },
        },
        {
          id: "api-endpoints",
          description: "The api Service has 2 endpoints.",
          validator: { kind: "endpoint-count", serviceName: "api", expectedValue: 2 },
        },
      ],
      hints: [
        "kubectl describe service web shows Selector: app=nginx. kubectl get pods -l app=nginx returns nothing.",
        "The Pods come from the web Deployment's template, which labels them app: web. Change the selector in web-svc.yaml to app: web and run kubectl apply -f web-svc.yaml.",
        "Labelling the Pods app=nginx would also add endpoints, but only until they are replaced. New Pods from the template would not have the label. Fix the Service.",
        "kubectl expose deployment api --port=80 --target-port=8080 --type=NodePort",
        "The PORT(S) column for a NodePort Service reads like 80:31234/TCP: the Service port, then the node port.",
      ],
      solutionFiles: { "web-svc.yaml": webSvc.replace("app: nginx", "app: web") },
      solution: [
        "kubectl apply -f web-svc.yaml",
        "kubectl expose deployment api --port=80 --target-port=8080 --type=NodePort",
        "kubectl get endpoints",
      ],
    },
  ],
  diagrams: [
    {
      id: "services-request-path",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "client",
            label: "Client Pod",
            sub: "curl http://api/",
            detail: "Any Pod in the default namespace. It only knows the name api, never a Pod IP.",
          },
          {
            id: "dns",
            label: "Cluster DNS",
            sub: "api → 10.96.0.15",
            detail: "CoreDNS answers api.default.svc.cluster.local with the Service's ClusterIP. The short name works because the Pod's DNS search path includes its namespace.",
          },
          {
            id: "service",
            label: "Service api",
            sub: "ClusterIP 10.96.0.15:80",
            detail: "A virtual IP that stays the same for the life of the Service. Its selector app=api decides which Pods are behind it.",
          },
          {
            id: "kube-proxy",
            label: "kube-proxy rules",
            sub: "on the client's node",
            detail: "kube-proxy has written kernel rules for every Service. The kernel rewrites the destination 10.96.0.15:80 to one ready endpoint, picked per connection.",
          },
          {
            id: "pods",
            label: "Endpoints (app=api, ready)",
            sub: "IP:targetPort",
            detail: "The ready Pods whose labels match the selector, kept up to date by the control plane in EndpointSlices.",
            children: [
              { id: "pod-1", label: "10.244.1.12:8080", sub: "node-1", detail: "One api Pod. If it is replaced, the new Pod's IP takes its place in the list." },
              { id: "pod-2", label: "10.244.2.31:8080", sub: "node-2", detail: "Pods on any node can be endpoints. The connection crosses the Pod network if needed." },
              { id: "pod-3", label: "10.244.2.40:8080", sub: "not ready, no traffic", detail: "Labels match but its readiness check fails, so it is left out of the endpoints until it is ready." },
            ],
          },
        ],
      },
      steps: [
        { title: "Use the name", text: "The client connects to http://api/ on port 80. It never sees a Pod IP.", highlight: ["client"] },
        { title: "DNS lookup", text: "Cluster DNS returns the ClusterIP 10.96.0.15. This answer does not change when Pods come and go.", highlight: ["dns"] },
        { title: "Connect to the Service", text: "The packet leaves for 10.96.0.15:80. No Pod has this address; it only exists in the rules.", highlight: ["service"] },
        { title: "Rewrite on the node", text: "The kube-proxy rules on the client's node pick one endpoint and rewrite the destination to it.", highlight: ["kube-proxy"] },
        { title: "Reach a Pod", text: "The connection lands on a ready Pod at its targetPort, 8080. The Pod that is not ready gets nothing.", highlight: ["pods", "pod-1", "pod-2"] },
      ],
    },
    {
      id: "services-port-mapping",
      root: {
        id: "layout",
        label: "",
        flow: true,
        children: [
          {
            id: "outside",
            label: "Outside client",
            sub: "192.168.1.20:30080",
            detail: "A machine outside the cluster connects to any node's IP on the nodePort.",
          },
          {
            id: "node-port",
            label: "nodePort 30080",
            sub: "open on every node",
            detail: "Only NodePort and LoadBalancer Services have one. Picked from 30000 to 32767 unless you set it.",
          },
          {
            id: "svc-port",
            label: "port 80",
            sub: "ClusterIP 10.96.0.20",
            detail: "The Service port. Clients inside the cluster skip the nodePort and connect to api-public:80 directly.",
          },
          {
            id: "target-port",
            label: "targetPort 8080",
            sub: "on the Pod IP",
            detail: "Where the Service sends traffic on the chosen Pod. Endpoints are listed as PodIP:targetPort.",
          },
          {
            id: "container-port",
            label: "containerPort 8080",
            sub: "app listens here",
            detail: "Declared in the Pod spec for documentation and naming. The process must actually listen on this port, and targetPort must match it.",
          },
        ],
      },
      steps: [
        { title: "From outside", text: "An outside client connects to 192.168.1.20:30080, a node IP and the nodePort.", highlight: ["outside", "node-port"] },
        { title: "From inside", text: "A Pod in the cluster connects to api-public:80, the Service port. Both paths meet here.", highlight: ["svc-port"] },
        { title: "To the Pod", text: "kube-proxy rules forward to a Pod IP on targetPort 8080.", highlight: ["target-port"] },
        { title: "The app", text: "The container is listening on 8080. If targetPort pointed anywhere else, the connection would be refused.", highlight: ["container-port"] },
      ],
    },
  ],
};
