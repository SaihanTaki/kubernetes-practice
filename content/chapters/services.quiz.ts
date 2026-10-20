import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "services-pod-ip",
    topic: "Services",
    difficulty: "beginner",
    question: "Why should a client not connect to another app's Pod IP directly?",
    options: [
      { id: "a", text: "Pod IPs change when Pods are replaced, rescheduled, or rolled out" },
      { id: "b", text: "Pod IPs are only reachable from the control plane" },
      { id: "c", text: "Pod IPs are encrypted and need a key to use" },
      { id: "d", text: "Kubernetes blocks all traffic to Pod IPs" },
    ],
    correctOptionId: "a",
    explanation:
      "A Pod's IP lasts only as long as that Pod. Replacement Pods get new IPs. Pod IPs are reachable from other Pods, but nothing guarantees they stay the same.",
  },
  {
    id: "services-what",
    topic: "Services",
    difficulty: "beginner",
    question: "What does a ClusterIP Service give a group of Pods?",
    options: [
      { id: "a", text: "A shared filesystem" },
      { id: "b", text: "A stable virtual IP and DNS name that spread connections across the ready Pods" },
      { id: "c", text: "Automatic scaling when traffic goes up" },
      { id: "d", text: "A public IP address on the internet" },
    ],
    correctOptionId: "b",
    explanation:
      "A Service has a fixed ClusterIP and a DNS name, and connections to it go to one of its ready endpoints. It does not scale Pods or, as ClusterIP, expose anything outside the cluster.",
  },
  {
    id: "services-dns",
    topic: "Services",
    difficulty: "beginner",
    question: "What is the full DNS name of a Service named api in the namespace shop, with the default cluster domain?",
    options: [
      { id: "a", text: "shop.api.cluster.local" },
      { id: "b", text: "api.shop.pod.cluster.local" },
      { id: "c", text: "api.shop.svc.cluster.local" },
      { id: "d", text: "svc.api.shop.local" },
    ],
    correctOptionId: "c",
    explanation: "The pattern is <service>.<namespace>.svc.cluster.local. From inside the shop namespace, plain api also works.",
  },
  {
    id: "services-dns-cross-ns",
    topic: "Services",
    difficulty: "intermediate",
    question: "A Pod in namespace web needs the Service api in namespace shop. Which short name resolves?",
    options: [
      { id: "a", text: "api" },
      { id: "b", text: "shop" },
      { id: "c", text: "shop/api" },
      { id: "d", text: "api.shop" },
    ],
    correctOptionId: "d",
    explanation:
      "The Pod's DNS search path starts with its own namespace, so plain api looks for api in web. Adding the namespace, api.shop, reaches the Service in shop.",
  },
  {
    id: "services-selects-what",
    topic: "Selectors",
    difficulty: "beginner",
    question: "What does a Service's selector match against?",
    options: [
      { id: "a", text: "Labels on Pods in the same namespace" },
      { id: "b", text: "The Deployment's name" },
      { id: "c", text: "The container image name" },
      { id: "d", text: "Labels on the ReplicaSet" },
    ],
    correctOptionId: "a",
    explanation:
      "A Service selects Pods directly by their labels. It has no link to the Deployment or ReplicaSet that created them, and it ignores names and images.",
  },
  {
    id: "services-endpoints",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "Which Pods appear in a Service's endpoints?",
    options: [
      { id: "a", text: "Every Pod in the namespace" },
      { id: "b", text: "Pods whose labels match the selector, including ones that are not ready" },
      { id: "c", text: "Pods whose labels match the selector and that are ready" },
      { id: "d", text: "Only Pods on the node where the Service was created" },
    ],
    correctOptionId: "c",
    explanation:
      "Endpoints list matching Pods that pass readiness, as IP:targetPort. A matching Pod that is not ready is left out, so it gets no traffic. Services are not tied to a node.",
  },
  {
    id: "services-endpointslice",
    topic: "Selectors",
    difficulty: "advanced",
    question: "In current Kubernetes, where is the list of a Service's endpoints stored?",
    options: [
      { id: "a", text: "In the Service's status field" },
      { id: "b", text: "In a ConfigMap named after the Service" },
      { id: "c", text: "Only in kube-proxy's memory" },
      { id: "d", text: "In EndpointSlice objects" },
    ],
    correctOptionId: "d",
    explanation:
      "The control plane writes EndpointSlices, which split large Services into chunks. kube-proxy reads them to build its rules. kubectl get endpoints still shows an equivalent view.",
  },
  {
    id: "services-no-endpoints",
    topic: "Debugging",
    difficulty: "intermediate",
    question: "kubectl get endpoints web shows <none>, and the web Pods are Running and 1/1 ready. What is the most likely cause?",
    options: [
      { id: "a", text: "The Service selector does not match the Pod labels" },
      { id: "b", text: "kube-proxy is not running" },
      { id: "c", text: "The Service type is ClusterIP" },
      { id: "d", text: "The targetPort is wrong" },
    ],
    correctOptionId: "a",
    explanation:
      "Endpoints come from the selector and readiness only. With ready Pods, an empty list means no Pod has the selected labels. kube-proxy and targetPort do not affect the endpoint list.",
  },
  {
    id: "services-debug-command",
    topic: "Debugging",
    difficulty: "intermediate",
    question: "A Service has selector app=frontend. Which command shows directly whether any Pods match it?",
    options: [
      { id: "a", text: "kubectl get deployments" },
      { id: "b", text: "kubectl get pods -l app=frontend" },
      { id: "c", text: "kubectl get nodes" },
      { id: "d", text: "kubectl describe deployment frontend" },
    ],
    correctOptionId: "b",
    explanation:
      "A label selector on get pods uses the same matching as the Service. No results means the Service has nothing to select. The Deployment's name says nothing about Pod labels.",
  },
  {
    id: "services-wrong-targetport",
    topic: "Debugging",
    difficulty: "advanced",
    question:
      "A Service has two endpoints, but every request gets 'connection refused'. The app listens on 8080. What should you check first?",
    options: [
      { id: "a", text: "Whether the Pods have the right labels" },
      { id: "b", text: "Whether the Service type is LoadBalancer" },
      { id: "c", text: "Whether targetPort is 8080" },
      { id: "d", text: "Whether the namespace exists" },
    ],
    correctOptionId: "c",
    explanation:
      "Endpoints exist, so labels and readiness are fine. Connections reach the Pods but on the wrong port. A missing targetPort defaults to port, which is a common way to end up sending traffic to 80.",
  },
  {
    id: "services-kube-proxy",
    topic: "kube-proxy",
    difficulty: "intermediate",
    question: "What does kube-proxy do?",
    options: [
      { id: "a", text: "Assigns IP addresses to Pods" },
      { id: "b", text: "Answers DNS queries for Service names" },
      { id: "c", text: "Schedules Pods onto nodes" },
      { id: "d", text: "Programs each node's kernel rules so traffic to a ClusterIP reaches an endpoint" },
    ],
    correctOptionId: "d",
    explanation:
      "kube-proxy runs on every node, watches Services and EndpointSlices, and writes iptables, IPVS, or nftables rules. Pod IPs come from the network plugin, DNS from CoreDNS, and placement from the scheduler.",
  },
  {
    id: "services-load-spread",
    topic: "kube-proxy",
    difficulty: "advanced",
    question:
      "A client opens one HTTP keep-alive connection to a Service with three Pods and sends 100 requests over it. Where do the requests go?",
    options: [
      { id: "a", text: "All to one Pod" },
      { id: "b", text: "Round robin, about 33 to each Pod" },
      { id: "c", text: "To whichever Pod has the lowest CPU use" },
      { id: "d", text: "The first to each Pod, then the rest to the first Pod" },
    ],
    correctOptionId: "a",
    explanation:
      "kube-proxy's rules pick an endpoint when a connection is opened. Every request on that connection goes to the same Pod. Spreading per request needs a client that opens new connections or an L7 proxy.",
  },
  {
    id: "services-clusterip-reach",
    topic: "Service types",
    difficulty: "beginner",
    question: "Who can reach a ClusterIP Service?",
    options: [
      { id: "a", text: "Anyone on the internet" },
      { id: "b", text: "Clients inside the cluster" },
      { id: "c", text: "Only Pods on the same node as the Service" },
      { id: "d", text: "Only the control plane" },
    ],
    correctOptionId: "b",
    explanation: "A ClusterIP is a virtual address handled by rules on every node, so any Pod in the cluster can use it. It is not reachable from outside.",
  },
  {
    id: "services-nodeport",
    topic: "Service types",
    difficulty: "intermediate",
    question: "A NodePort Service has nodePort 30080. How does a client outside the cluster reach it?",
    options: [
      { id: "a", text: "Only through the node that runs one of the Pods" },
      { id: "b", text: "Through the ClusterIP on port 30080" },
      { id: "c", text: "Through any node's IP on port 30080" },
      { id: "d", text: "Through the Pod IP on port 30080" },
    ],
    correctOptionId: "c",
    explanation:
      "The node port is opened on every node, whether or not it runs a matching Pod. The node forwards the connection to an endpoint. ClusterIPs and Pod IPs are not reachable from outside.",
  },
  {
    id: "services-lb-pending",
    topic: "Service types",
    difficulty: "intermediate",
    question: "On a local cluster with no cloud provider, a LoadBalancer Service shows EXTERNAL-IP <pending>. Why?",
    options: [
      { id: "a", text: "The Service has no endpoints" },
      { id: "b", text: "kube-proxy is still starting" },
      { id: "c", text: "DNS has not caught up yet" },
      { id: "d", text: "Nothing in the cluster can provision an external load balancer" },
    ],
    correctOptionId: "d",
    explanation:
      "A LoadBalancer Service asks a cloud integration for a load balancer. Without one the address never arrives. The Service still works as a NodePort and ClusterIP Service.",
  },
  {
    id: "services-headless",
    topic: "Service types",
    difficulty: "advanced",
    question: "What does a DNS lookup of a headless Service (clusterIP: None) with a selector return?",
    options: [
      { id: "a", text: "The IPs of its ready Pods" },
      { id: "b", text: "A ClusterIP chosen at lookup time" },
      { id: "c", text: "A CNAME to an external host" },
      { id: "d", text: "Nothing, headless Services have no DNS name" },
    ],
    correctOptionId: "a",
    explanation:
      "A headless Service has no virtual IP and no kube-proxy rules. DNS returns the Pod IPs directly. A CNAME to an external host is what an ExternalName Service gives.",
  },
  {
    id: "services-expose",
    topic: "kubectl expose",
    difficulty: "beginner",
    question: "Which command creates a NodePort Service for the Deployment api, port 80, sending traffic to container port 8080?",
    options: [
      { id: "a", text: "kubectl create deployment api --port=80 --type=NodePort" },
      { id: "b", text: "kubectl expose deployment api --port=80 --target-port=8080 --type=NodePort" },
      { id: "c", text: "kubectl expose service api --port=8080 --node-port=80" },
      { id: "d", text: "kubectl scale deployment api --port=80" },
    ],
    correctOptionId: "b",
    explanation:
      "kubectl expose reads the Deployment's selector and builds a Service from it. --port is the Service port, --target-port the Pod port, and --type the Service type.",
  },
  {
    id: "services-yaml-selector",
    topic: "Service YAML",
    difficulty: "intermediate",
    question: "How is the selector written in a Service manifest?",
    options: [
      { id: "a", text: "spec.selector.matchLabels.app: api" },
      { id: "b", text: "spec.template.metadata.labels.app: api" },
      { id: "c", text: "spec.selector.app: api, a plain map" },
      { id: "d", text: "metadata.labels.app: api" },
    ],
    correctOptionId: "c",
    explanation:
      "A Service selector is a map directly under spec.selector. matchLabels belongs to Deployments and ReplicaSets, and metadata.labels only labels the Service itself.",
  },
  {
    id: "services-yaml-targetport-default",
    topic: "Service YAML",
    difficulty: "intermediate",
    question: "A Service port has port: 80 and no targetPort. Which Pod port receives traffic?",
    options: [
      { id: "a", text: "The first containerPort declared in the Pod" },
      { id: "b", text: "A random port from 30000 to 32767" },
      { id: "c", text: "8080" },
      { id: "d", text: "80" },
    ],
    correctOptionId: "d",
    explanation: "targetPort defaults to the value of port. Kubernetes does not look at containerPort to fill it in.",
  },
  {
    id: "services-yaml-ports",
    topic: "Service YAML",
    difficulty: "intermediate",
    question:
      "A Service has port: 80, targetPort: 8080, nodePort: 30080. Which port does a Pod inside the cluster use with the Service's DNS name?",
    options: [
      { id: "a", text: "80" },
      { id: "b", text: "8080" },
      { id: "c", text: "30080" },
      { id: "d", text: "Any of the three" },
    ],
    correctOptionId: "a",
    explanation:
      "The DNS name resolves to the ClusterIP, which listens on port. 8080 is the Pod-side port and 30080 is opened on node IPs, not on the ClusterIP.",
  },
  {
    id: "services-yaml-type",
    topic: "Service YAML",
    difficulty: "beginner",
    question: "A Service manifest has no spec.type. What type is it?",
    options: [
      { id: "a", text: "NodePort" },
      { id: "b", text: "ClusterIP" },
      { id: "c", text: "LoadBalancer" },
      { id: "d", text: "Headless" },
    ],
    correctOptionId: "b",
    explanation: "ClusterIP is the default. A headless Service is not a type; it is a ClusterIP Service with clusterIP: None.",
  },
  {
    id: "services-yaml-nodeport-range",
    topic: "Service YAML",
    difficulty: "advanced",
    question: "With default settings, which nodePort value is rejected?",
    options: [
      { id: "a", text: "30000" },
      { id: "b", text: "31500" },
      { id: "c", text: "8080" },
      { id: "d", text: "32767" },
    ],
    correctOptionId: "c",
    explanation:
      "The default node port range is 30000 to 32767, both ends included. 8080 is outside it, so the API server rejects the Service.",
  },
  {
    id: "services-yaml-fix",
    topic: "Service YAML",
    difficulty: "intermediate",
    question:
      "The web Deployment's template has labels app: web, tier: frontend. Which Service selector selects its Pods?",
    options: [
      { id: "a", text: "app: web-deployment" },
      { id: "b", text: "app: web, tier: backend" },
      { id: "c", text: "image: nginx" },
      { id: "d", text: "tier: frontend" },
    ],
    correctOptionId: "d",
    explanation:
      "A Pod matches when it has every label in the selector. tier: frontend is a subset of the Pod labels. tier: backend conflicts, and the other two are not labels the Pods carry.",
  },
];
