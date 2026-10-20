import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "netpol-default-allow",
    topic: "Network Policies",
    difficulty: "beginner",
    question: "A namespace has no NetworkPolicies. Which Pods can connect to a Pod in it?",
    options: [
      { id: "a", text: "Only Pods in the same namespace" },
      { id: "b", text: "Any Pod in any namespace" },
      { id: "c", text: "No Pods until a policy allows them" },
      { id: "d", text: "Only Pods on the same node" },
    ],
    correctOptionId: "b",
    explanation:
      "Kubernetes networking is allow-all by default. A Pod is only restricted once a NetworkPolicy selects it. Namespaces are not a network boundary on their own.",
  },
  {
    id: "netpol-cni",
    topic: "Network Policies",
    difficulty: "beginner",
    question: "You apply a NetworkPolicy and the API server accepts it. What actually enforces it?",
    options: [
      { id: "a", text: "The kube-apiserver" },
      { id: "b", text: "kube-proxy" },
      { id: "c", text: "The cluster's network (CNI) plugin, such as Calico or Cilium" },
      { id: "d", text: "The kubelet, by restarting blocked Pods" },
    ],
    correctOptionId: "c",
    explanation:
      "The API server only stores the object. The CNI plugin programs the packet filtering on each node. kube-proxy handles Service load balancing, not policies.",
  },
  {
    id: "netpol-flannel",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "A cluster uses flannel on its own as its CNI plugin. You apply a default-deny policy. What happens to traffic?",
    options: [
      { id: "a", text: "Nothing changes: flannel does not enforce NetworkPolicy" },
      { id: "b", text: "All traffic in the namespace stops" },
      { id: "c", text: "The API server rejects the policy" },
      { id: "d", text: "Pods restart with the policy applied" },
    ],
    correctOptionId: "a",
    explanation:
      "flannel provides connectivity but no policy enforcement. The object is stored and silently ignored. You need a plugin that enforces policies, such as Calico or Cilium.",
  },
  {
    id: "netpol-direction",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "The only policy selecting Pod api has policyTypes: [Ingress]. What happens to connections api opens to other Pods?",
    options: [
      { id: "a", text: "They are blocked until an egress rule allows them" },
      { id: "b", text: "Only connections inside the namespace are allowed" },
      { id: "c", text: "Only DNS is allowed" },
      { id: "d", text: "They are allowed: api is not isolated for egress" },
    ],
    correctOptionId: "d",
    explanation:
      "Isolation is per direction. A Pod is isolated for egress only if some policy selecting it lists Egress. Here only ingress is restricted.",
  },
  {
    id: "netpol-additive",
    topic: "Network Policies",
    difficulty: "beginner",
    question: "How do you block one specific source from reaching a Pod that other policies already allow?",
    options: [
      { id: "a", text: "Add a rule with action: Deny" },
      { id: "b", text: "You cannot write deny rules; narrow the allow rules so they no longer match that source" },
      { id: "c", text: "Set policyTypes: [Deny]" },
      { id: "d", text: "Create a second policy with a higher priority" },
    ],
    correctOptionId: "b",
    explanation:
      "NetworkPolicy rules only allow. Policies have no order or priority, and the result is the union of all allow rules. To block a source, change the rules that let it in.",
  },
  {
    id: "netpol-union",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "Policy P1 allows ingress to app=api from app=frontend. Policy P2 allows ingress to app=api from app=admin. Which sources can reach api?",
    options: [
      { id: "a", text: "Only frontend, because P1 was created first" },
      { id: "b", text: "Neither, because the policies conflict" },
      { id: "c", text: "Both frontend and admin" },
      { id: "d", text: "Only admin, because P2 was created last" },
    ],
    correctOptionId: "c",
    explanation:
      "Policies are additive. Traffic is allowed if any policy that selects the Pod allows it, so both sources get in. Creation order does not matter.",
  },
  {
    id: "netpol-yaml-deny",
    topic: "NetworkPolicy YAML",
    difficulty: "intermediate",
    question: "What does this policy do: spec: { podSelector: {}, policyTypes: [Ingress] } with no ingress field?",
    options: [
      { id: "a", text: "Blocks all incoming traffic to every Pod in its namespace" },
      { id: "b", text: "Allows all incoming traffic to every Pod in its namespace" },
      { id: "c", text: "Blocks all traffic in the whole cluster" },
      { id: "d", text: "Does nothing because podSelector is empty" },
    ],
    correctOptionId: "a",
    explanation:
      "An empty podSelector selects every Pod in the policy's namespace. Listing Ingress isolates them, and with no ingress rules nothing is allowed in. Other namespaces are unaffected.",
  },
  {
    id: "netpol-yaml-allow-all",
    topic: "NetworkPolicy YAML",
    difficulty: "advanced",
    question: "A policy has podSelector: {}, policyTypes: [Ingress] and ingress: [{}]. What does it allow?",
    options: [
      { id: "a", text: "Nothing: the rule is empty" },
      { id: "b", text: "Only traffic from the same namespace" },
      { id: "c", text: "Only traffic on port 80" },
      { id: "d", text: "All incoming traffic to every Pod in the namespace" },
    ],
    correctOptionId: "d",
    explanation:
      "A rule with no from and no ports matches every source on every port. ingress: [{}] is the allow-all pattern. Leaving ingress out entirely is what denies.",
  },
  {
    id: "netpol-yaml-and",
    topic: "NetworkPolicy YAML",
    difficulty: "advanced",
    question:
      "Which sources does this allow? from: [{ namespaceSelector: { matchLabels: { team: ops } }, podSelector: { matchLabels: { app: monitor } } }]",
    options: [
      { id: "a", text: "Every Pod in namespaces labelled team=ops, plus app=monitor Pods in the policy's namespace" },
      { id: "b", text: "Only Pods labelled app=monitor that run in namespaces labelled team=ops" },
      { id: "c", text: "Only Pods labelled app=monitor in the policy's own namespace" },
      { id: "d", text: "Every Pod in the cluster" },
    ],
    correctOptionId: "b",
    explanation:
      "Both selectors are in one list element, so a source must match both: the AND form. Splitting them into two elements would turn it into OR.",
  },
  {
    id: "netpol-yaml-or",
    topic: "NetworkPolicy YAML",
    difficulty: "advanced",
    question:
      "Which sources does this allow? from: [{ namespaceSelector: { matchLabels: { team: ops } } }, { podSelector: { matchLabels: { app: monitor } } }]",
    options: [
      { id: "a", text: "Only Pods labelled app=monitor that run in namespaces labelled team=ops" },
      { id: "b", text: "Nothing, because the selectors contradict each other" },
      { id: "c", text: "Every Pod in namespaces labelled team=ops, plus app=monitor Pods in the policy's namespace" },
      { id: "d", text: "Only Pods labelled both team=ops and app=monitor" },
    ],
    correctOptionId: "c",
    explanation:
      "Two list elements are alternatives: a source matching either is allowed. The podSelector element on its own only looks at the policy's own namespace.",
  },
  {
    id: "netpol-podselector-scope",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "In ingress.from, a podSelector appears without a namespaceSelector. Which Pods does it match?",
    options: [
      { id: "a", text: "Matching Pods in the policy's own namespace" },
      { id: "b", text: "Matching Pods in every namespace" },
      { id: "c", text: "Matching Pods in the default namespace" },
      { id: "d", text: "Matching Pods on the same node" },
    ],
    correctOptionId: "a",
    explanation:
      "A podSelector on its own is scoped to the namespace of the NetworkPolicy. To match Pods elsewhere, combine it with a namespaceSelector in the same element.",
  },
  {
    id: "netpol-empty-nsselector",
    topic: "Network Policies",
    difficulty: "advanced",
    question: "What does from: [{ namespaceSelector: {} }] match?",
    options: [
      { id: "a", text: "No Pods" },
      { id: "b", text: "Only Pods in the policy's namespace" },
      { id: "c", text: "Only Pods in namespaces without labels" },
      { id: "d", text: "All Pods in all namespaces" },
    ],
    correctOptionId: "d",
    explanation:
      "An empty selector matches everything, so every namespace and therefore every Pod in the cluster. Traffic from outside the cluster is not covered; that needs ipBlock.",
  },
  {
    id: "netpol-ns-label",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "You want to allow traffic from namespace monitoring without adding your own labels. Which label can a namespaceSelector use?",
    options: [
      { id: "a", text: "name=monitoring, which every namespace gets" },
      { id: "b", text: "kubernetes.io/metadata.name=monitoring, set automatically" },
      { id: "c", text: "namespace=monitoring, set by kubectl create namespace" },
      { id: "d", text: "None: namespaces cannot be selected without custom labels" },
    ],
    correctOptionId: "b",
    explanation:
      "The API server sets kubernetes.io/metadata.name on every namespace to its name. A plain name label only exists if someone added it.",
  },
  {
    id: "netpol-yaml-port",
    topic: "NetworkPolicy YAML",
    difficulty: "advanced",
    question: "Service api has port: 80 and targetPort: 8080. Which port goes in the NetworkPolicy ports list to allow clients that call http://api?",
    options: [
      { id: "a", text: "80, the Service port" },
      { id: "b", text: "Both 80 and 8080 are required" },
      { id: "c", text: "8080, the port on the Pod" },
      { id: "d", text: "The node port of the Service" },
    ],
    correctOptionId: "c",
    explanation:
      "Policies are checked against the packet as it reaches the Pod, after the Service address has been translated to a Pod IP and targetPort. So the Pod's port, 8080, is what counts.",
  },
  {
    id: "netpol-dns",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "After a default-deny-egress policy and an egress rule allowing api to db on 6379, api fails with bad address 'db'. Why?",
    options: [
      { id: "a", text: "DNS lookups to kube-dns on port 53 are now blocked too" },
      { id: "b", text: "The db Service was deleted by the policy" },
      { id: "c", text: "Egress rules cannot use port 6379" },
      { id: "d", text: "db's ingress policy blocks DNS" },
    ],
    correctOptionId: "a",
    explanation:
      "Resolving db is itself an egress connection to the cluster DNS Pods on UDP and TCP 53. Once egress is restricted, you have to allow it explicitly.",
  },
  {
    id: "netpol-yaml-dns",
    topic: "NetworkPolicy YAML",
    difficulty: "advanced",
    question: "Which egress rule allows DNS lookups to the cluster DNS Pods?",
    options: [
      { id: "a", text: "to: [{ podSelector: { matchLabels: { k8s-app: kube-dns } } }] with ports UDP 53 and TCP 53" },
      { id: "b", text: "to: [{ ipBlock: { cidr: 0.0.0.0/0 } }] with port TCP 80" },
      { id: "c", text: "ports: [{ protocol: UDP, port: 53 }] in an ingress rule of the same Pod" },
      { id: "d", text: "to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }, podSelector: { matchLabels: { k8s-app: kube-dns } } }] with ports UDP 53 and TCP 53" },
    ],
    correctOptionId: "d",
    explanation:
      "The DNS Pods run in kube-system, so the selector needs a namespaceSelector ANDed with the podSelector. Option a looks only in the policy's own namespace. DNS uses UDP 53 and falls back to TCP 53.",
  },
  {
    id: "netpol-test-timeout",
    topic: "Network Policies",
    difficulty: "beginner",
    question: "kubectl exec frontend-pod -- wget -qO- -T 2 http://api:8080 prints wget: download timed out. What is the most likely cause?",
    options: [
      { id: "a", text: "The api image is missing" },
      { id: "b", text: "A NetworkPolicy drops the traffic" },
      { id: "c", text: "The Service name is wrong" },
      { id: "d", text: "wget is not installed in the frontend container" },
    ],
    correctOptionId: "b",
    explanation:
      "Policies drop packets silently, so the client waits until its timeout. A wrong name fails fast with bad address, and a missing wget fails with an exec error.",
  },
  {
    id: "netpol-both-sides",
    topic: "Network Policies",
    difficulty: "advanced",
    question: "Pod A is isolated for egress, Pod B for ingress. When can A open a connection to B?",
    options: [
      { id: "a", text: "When A's egress policy allows it, whatever B's policies say" },
      { id: "b", text: "When B's ingress policy allows it, whatever A's policies say" },
      { id: "c", text: "Only when A's egress and B's ingress both allow it" },
      { id: "d", text: "Never: isolated Pods cannot talk to each other" },
    ],
    correctOptionId: "c",
    explanation:
      "A connection has to leave the source and enter the destination. Each side's policies are checked separately, and both must allow it.",
  },
  {
    id: "netpol-default-types",
    topic: "NetworkPolicy YAML",
    difficulty: "intermediate",
    question: "A policy has an ingress section, no egress section, and no policyTypes field. Which directions does it isolate?",
    options: [
      { id: "a", text: "Ingress only" },
      { id: "b", text: "Egress only" },
      { id: "c", text: "Neither, policyTypes is required" },
      { id: "d", text: "Both ingress and egress" },
    ],
    correctOptionId: "a",
    explanation:
      "When policyTypes is left out, Ingress is always assumed, and Egress only if the policy has an egress section. Writing policyTypes explicitly avoids the guesswork.",
  },
  {
    id: "netpol-default-types-egress",
    topic: "Network Policies",
    difficulty: "advanced",
    question: "A policy has both ingress and egress sections but no policyTypes field. Which directions does it isolate?",
    options: [
      { id: "a", text: "Ingress only, because that is the default" },
      { id: "b", text: "Egress only, because it is listed last" },
      { id: "c", text: "Neither, policyTypes is required" },
      { id: "d", text: "Both ingress and egress" },
    ],
    correctOptionId: "d",
    explanation:
      "Without policyTypes, Ingress is always included and Egress is added because an egress section is present.",
  },
  {
    id: "netpol-namespaced",
    topic: "Network Policies",
    difficulty: "beginner",
    question: "A NetworkPolicy in namespace shop has podSelector: { matchLabels: { app: api } }. Which Pods does it protect?",
    options: [
      { id: "a", text: "Pods labelled app=api in every namespace" },
      { id: "b", text: "Pods labelled app=api in shop only" },
      { id: "c", text: "Every Pod in shop" },
      { id: "d", text: "Pods named api" },
    ],
    correctOptionId: "b",
    explanation:
      "NetworkPolicy is a namespaced object. Its spec.podSelector only selects Pods in the same namespace, and it matches labels, not names.",
  },
  {
    id: "netpol-replies",
    topic: "Network Policies",
    difficulty: "intermediate",
    question: "frontend may reach api on 8080, and api is isolated for egress with no egress rules. Does api's HTTP response reach frontend?",
    options: [
      { id: "a", text: "No, api needs an egress rule to frontend" },
      { id: "b", text: "No, api needs an ingress rule from frontend on the reply port" },
      { id: "c", text: "Yes, replies on an allowed connection are allowed automatically" },
      { id: "d", text: "Only if frontend is also isolated" },
    ],
    correctOptionId: "c",
    explanation:
      "Policies apply to new connections. Return traffic on a connection that was allowed is let through, so you write rules for the side that starts the connection.",
  },
];
