import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "scheduling-what",
    topic: "Scheduler",
    difficulty: "beginner",
    question: "What does the scheduler change on a Pod when it places it?",
    options: [
      { id: "a", text: "It sets spec.nodeName to the chosen node" },
      { id: "b", text: "It starts the containers on the chosen node" },
      { id: "c", text: "It adds a node label to the Pod" },
      { id: "d", text: "It copies the Pod to every node and deletes the extras" },
    ],
    correctOptionId: "a",
    explanation:
      "The scheduler only binds the Pod to a node by setting spec.nodeName. The kubelet on that node then starts the containers.",
  },
  {
    id: "scheduling-phases",
    topic: "Scheduler",
    difficulty: "beginner",
    question: "In which order does the scheduler work through the nodes for one Pod?",
    options: [
      { id: "a", text: "Score all nodes, then bind, then filter" },
      { id: "b", text: "Filter out nodes that cannot run it, score the rest, bind to the best" },
      { id: "c", text: "Pick the first node in alphabetical order" },
      { id: "d", text: "Bind to a random node and move the Pod if it fails" },
    ],
    correctOptionId: "b",
    explanation:
      "Filtering removes infeasible nodes (taints, selectors, resources). Scoring ranks the survivors. The Pod is bound to the highest scoring node.",
  },
  {
    id: "scheduling-pending",
    topic: "Scheduler",
    difficulty: "beginner",
    question: "No node passes the filter step for a new Pod. What happens?",
    options: [
      { id: "a", text: "The Pod is deleted" },
      { id: "b", text: "The Pod runs on the control plane node" },
      { id: "c", text: "The Pod stays Pending with a FailedScheduling event and is retried later" },
      { id: "d", text: "The Deployment that owns it is scaled to 0" },
    ],
    correctOptionId: "c",
    explanation:
      "An unschedulable Pod stays Pending. The scheduler records why in a FailedScheduling event and tries again when the cluster changes, for example when a node is labelled or freed up.",
  },
  {
    id: "scheduling-wellknown",
    topic: "Node labels",
    difficulty: "beginner",
    question: "Which of these is a well-known node label that Kubernetes or the cloud provider sets for you?",
    options: [
      { id: "a", text: "disk=ssd" },
      { id: "b", text: "app=web" },
      { id: "c", text: "dedicated=batch" },
      { id: "d", text: "topology.kubernetes.io/zone" },
    ],
    correctOptionId: "d",
    explanation:
      "topology.kubernetes.io/zone, kubernetes.io/hostname, kubernetes.io/os and kubernetes.io/arch are well-known labels. disk=ssd and dedicated=batch are labels you add yourself, and app=web is a Pod label.",
  },
  {
    id: "scheduling-label-cmd",
    topic: "Node labels",
    difficulty: "beginner",
    question: "Which command adds the label disk=ssd to node worker-2?",
    options: [
      { id: "a", text: "kubectl label node worker-2 disk=ssd" },
      { id: "b", text: "kubectl taint nodes worker-2 disk=ssd" },
      { id: "c", text: "kubectl annotate node worker-2 disk=ssd" },
      { id: "d", text: "kubectl set node worker-2 disk=ssd" },
    ],
    correctOptionId: "a",
    explanation:
      "kubectl label works on nodes like any other object. A taint is a different thing that repels Pods, and an annotation cannot be used by nodeSelector.",
  },
  {
    id: "scheduling-nodeselector-yaml",
    topic: "nodeSelector YAML",
    difficulty: "beginner",
    question: "Where does nodeSelector go in a Deployment manifest?",
    options: [
      { id: "a", text: "spec.nodeSelector of the Deployment" },
      { id: "b", text: "spec.template.spec.nodeSelector" },
      { id: "c", text: "metadata.nodeSelector" },
      { id: "d", text: "spec.selector.nodeSelector" },
    ],
    correctOptionId: "b",
    explanation:
      "nodeSelector is a Pod spec field, so in a Deployment it sits in the Pod template's spec. spec.selector picks Pods by label and has nothing to do with nodes.",
  },
  {
    id: "scheduling-nodeselector-and",
    topic: "nodeSelector YAML",
    difficulty: "intermediate",
    question: "A Pod has nodeSelector: {disk: ssd, kubernetes.io/os: linux}. Which nodes can it run on?",
    options: [
      { id: "a", text: "Nodes with either label" },
      { id: "b", text: "Any node, the selector is only a preference" },
      { id: "c", text: "Only nodes that have both labels" },
      { id: "d", text: "Only nodes with no labels" },
    ],
    correctOptionId: "c",
    explanation:
      "Every key in nodeSelector must match. For OR logic or operators like NotIn, use node affinity instead.",
  },
  {
    id: "scheduling-required-preferred",
    topic: "Node affinity",
    difficulty: "intermediate",
    question: "What is the difference between required and preferred node affinity?",
    options: [
      { id: "a", text: "Required applies to Deployments, preferred to Pods" },
      { id: "b", text: "Required is checked at runtime, preferred only at creation" },
      { id: "c", text: "There is none; preferred is the old name" },
      { id: "d", text: "Required filters nodes out; preferred only adds weight to matching nodes' scores" },
    ],
    correctOptionId: "d",
    explanation:
      "requiredDuringScheduling rules are hard filters, so a Pod with no matching node stays Pending. preferredDuringScheduling rules add their weight during scoring and never block scheduling.",
  },
  {
    id: "scheduling-ignored",
    topic: "Node affinity",
    difficulty: "intermediate",
    question:
      "A Pod was scheduled with required node affinity for disk=ssd. You then remove the disk label from its node. What happens to the Pod?",
    options: [
      { id: "a", text: "It keeps running; IgnoredDuringExecution means the rule is only checked at scheduling time" },
      { id: "b", text: "It is evicted at once" },
      { id: "c", text: "It is moved to another SSD node" },
      { id: "d", text: "It restarts its containers" },
    ],
    correctOptionId: "a",
    explanation:
      "IgnoredDuringExecution means a running Pod is not affected by later label changes. Only new Pods see the new labels.",
  },
  {
    id: "scheduling-terms-yaml",
    topic: "Node affinity YAML",
    difficulty: "advanced",
    question:
      "A required node affinity has two entries under nodeSelectorTerms, each with one matchExpression. How are they combined?",
    options: [
      { id: "a", text: "Both terms must match" },
      { id: "b", text: "A node that matches either term passes" },
      { id: "c", text: "Only the first term is used" },
      { id: "d", text: "The API server rejects more than one term" },
    ],
    correctOptionId: "b",
    explanation:
      "nodeSelectorTerms are ORed. The expressions inside a single term's matchExpressions are ANDed.",
  },
  {
    id: "scheduling-notin-yaml",
    topic: "Node affinity YAML",
    difficulty: "intermediate",
    question: "Which matchExpression keeps a Pod off nodes in zone-b?",
    options: [
      { id: "a", text: "{key: topology.kubernetes.io/zone, operator: In, values: [zone-b]}" },
      { id: "b", text: "{key: topology.kubernetes.io/zone, operator: Exists}" },
      { id: "c", text: "{key: topology.kubernetes.io/zone, operator: NotIn, values: [zone-b]}" },
      { id: "d", text: "{key: zone-b, operator: DoesNotExist, values: [zone-b]}" },
    ],
    correctOptionId: "c",
    explanation:
      "NotIn passes nodes whose zone label is anything other than zone-b. In would do the opposite, Exists matches every zoned node, and DoesNotExist takes no values.",
  },
  {
    id: "scheduling-weight-yaml",
    topic: "Node affinity YAML",
    difficulty: "intermediate",
    question: "In preferredDuringSchedulingIgnoredDuringExecution, what does weight do?",
    options: [
      { id: "a", text: "Sets how many replicas go to matching nodes" },
      { id: "b", text: "Sets the CPU share of the Pod" },
      { id: "c", text: "Sets the order in which rules are checked as filters" },
      { id: "d", text: "Adds 1 to 100 points to the score of each node that matches the preference" },
    ],
    correctOptionId: "d",
    explanation:
      "Each preferred term has a weight from 1 to 100. A node's score gets the sum of weights of the terms it matches, so higher weights pull harder.",
  },
  {
    id: "scheduling-antiaffinity",
    topic: "Pod anti-affinity",
    difficulty: "intermediate",
    question:
      "A Deployment's Pods have required podAntiAffinity against their own label with topologyKey: kubernetes.io/hostname. What does that do?",
    options: [
      { id: "a", text: "At most one of its Pods runs on each node" },
      { id: "b", text: "All its Pods run on the same node" },
      { id: "c", text: "Its Pods avoid nodes with a hostname label" },
      { id: "d", text: "Its Pods avoid the control plane only" },
    ],
    correctOptionId: "a",
    explanation:
      "kubernetes.io/hostname is unique per node, so each node is its own domain. A node that already runs a matching Pod is filtered out for the next one.",
  },
  {
    id: "scheduling-antiaffinity-extra",
    topic: "Pod anti-affinity",
    difficulty: "advanced",
    question:
      "That same Deployment has 3 replicas, and only 2 worker nodes can take Pods. What do you see?",
    options: [
      { id: "a", text: "3 Pods, two of them on the same node" },
      { id: "b", text: "2 Pods Running and 1 Pending with a FailedScheduling event" },
      { id: "c", text: "The Deployment is rejected by the API server" },
      { id: "d", text: "3 Pods Running, one on the control plane" },
    ],
    correctOptionId: "b",
    explanation:
      "A required rule is never relaxed. The third Pod has no node without a sibling, so it stays Pending. Use the preferred form if you want spreading without blocking.",
  },
  {
    id: "scheduling-topologykey-yaml",
    topic: "Pod affinity YAML",
    difficulty: "advanced",
    question: "You want replicas spread so that no two run in the same zone. Which topologyKey do you use in podAntiAffinity?",
    options: [
      { id: "a", text: "kubernetes.io/hostname" },
      { id: "b", text: "kubernetes.io/os" },
      { id: "c", text: "topology.kubernetes.io/zone" },
      { id: "d", text: "app" },
    ],
    correctOptionId: "c",
    explanation:
      "topologyKey names a node label. Nodes with the same value form one domain, so the zone label makes each zone a domain. hostname would only separate nodes.",
  },
  {
    id: "scheduling-spread",
    topic: "Topology spread",
    difficulty: "advanced",
    question:
      "A topologySpreadConstraint has maxSkew: 1, topologyKey: topology.kubernetes.io/zone, whenUnsatisfiable: DoNotSchedule. zone-a runs 2 matching Pods, zone-b runs 1. Where can the next Pod go?",
    options: [
      { id: "a", text: "Either zone" },
      { id: "b", text: "Nowhere; the Pod stays Pending" },
      { id: "c", text: "zone-a only" },
      { id: "d", text: "zone-b only" },
    ],
    correctOptionId: "d",
    explanation:
      "Skew is the gap between the most and least loaded zone. Putting it in zone-a makes 3 vs 1, a skew of 2. zone-b gives 2 vs 2, a skew of 0, so only zone-b passes.",
  },
  {
    id: "scheduling-effects",
    topic: "Taints",
    difficulty: "intermediate",
    question: "Which taint effect also evicts Pods that are already running on the node without a matching toleration?",
    options: [
      { id: "a", text: "NoSchedule" },
      { id: "b", text: "PreferNoSchedule" },
      { id: "c", text: "NoExecute" },
      { id: "d", text: "Cordon" },
    ],
    correctOptionId: "c",
    explanation:
      "NoSchedule and PreferNoSchedule only affect new Pods. NoExecute also evicts running Pods that do not tolerate it. Cordon is a command, not a taint effect.",
  },
  {
    id: "scheduling-attract",
    topic: "Tolerations",
    difficulty: "intermediate",
    question:
      "worker-1 has taint dedicated=batch:NoSchedule. A batch Pod has a matching toleration and nothing else. Where can it run?",
    options: [
      { id: "a", text: "Only on worker-1" },
      { id: "b", text: "On worker-1 or any untainted worker" },
      { id: "c", text: "Nowhere until the taint is removed" },
      { id: "d", text: "Only on untainted nodes" },
    ],
    correctOptionId: "b",
    explanation:
      "A toleration allows a Pod onto a tainted node; it does not attract it. To pin batch Pods to worker-1, also add a node label and required node affinity for it.",
  },
  {
    id: "scheduling-toleration-yaml",
    topic: "Tolerations YAML",
    difficulty: "intermediate",
    question: "Which toleration matches the taint dedicated=batch:NoSchedule?",
    options: [
      { id: "a", text: "{key: dedicated, operator: Equal, value: batch, effect: NoSchedule}" },
      { id: "b", text: "{key: batch, operator: Equal, value: dedicated, effect: NoSchedule}" },
      { id: "c", text: "{key: dedicated, operator: Equal, value: batch, effect: NoExecute}" },
      { id: "d", text: "{key: dedicated, operator: Equal, value: web}" },
    ],
    correctOptionId: "a",
    explanation:
      "Key, value and effect must all match. b swaps key and value, c has the wrong effect, and d has the wrong value. operator: Exists with only the key would also match.",
  },
  {
    id: "scheduling-taint-cmd",
    topic: "Taints",
    difficulty: "beginner",
    question: "Which command removes the taint dedicated=batch:NoSchedule from worker-1?",
    options: [
      { id: "a", text: "kubectl uncordon worker-1" },
      { id: "b", text: "kubectl label node worker-1 dedicated-" },
      { id: "c", text: "kubectl delete taint worker-1 dedicated" },
      { id: "d", text: "kubectl taint nodes worker-1 dedicated=batch:NoSchedule-" },
    ],
    correctOptionId: "d",
    explanation:
      "A trailing minus removes a taint, the same convention kubectl label uses. uncordon clears the unschedulable flag, and removing a label does not touch taints.",
  },
  {
    id: "scheduling-drain",
    topic: "Maintenance",
    difficulty: "intermediate",
    question: "What does kubectl drain worker-2 --ignore-daemonsets do?",
    options: [
      { id: "a", text: "Deletes the node from the cluster" },
      { id: "b", text: "Cordons worker-2 and evicts its Pods, leaving DaemonSet Pods in place" },
      { id: "c", text: "Evicts Pods but lets new Pods schedule on worker-2" },
      { id: "d", text: "Adds a NoExecute taint that never goes away" },
    ],
    correctOptionId: "b",
    explanation:
      "drain first cordons the node so nothing new lands there, then evicts its Pods. DaemonSet Pods would be recreated on the same node anyway, so when the node runs any, drain refuses to continue unless you pass --ignore-daemonsets.",
  },
  {
    id: "scheduling-uncordon",
    topic: "Maintenance",
    difficulty: "beginner",
    question: "After maintenance on a drained node, how do you let Pods schedule on it again?",
    options: [
      { id: "a", text: "kubectl uncordon <node>" },
      { id: "b", text: "kubectl drain <node> --undo" },
      { id: "c", text: "Restart the kubelet; it clears the flag" },
      { id: "d", text: "Nothing; drain expires after 5 minutes" },
    ],
    correctOptionId: "a",
    explanation:
      "drain leaves the node cordoned (SchedulingDisabled) until you run kubectl uncordon. Evicted Pods do not move back on their own; only new or Pending Pods use the node.",
  },
  {
    id: "scheduling-read-event",
    topic: "Troubleshooting",
    difficulty: "advanced",
    question:
      "A Pending Pod shows: 0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 node(s) didn't match Pod's node affinity/selector. What is the most likely fix?",
    options: [
      { id: "a", text: "Add a toleration for the control-plane taint" },
      { id: "b", text: "Give the workers more memory" },
      { id: "c", text: "Label a worker so it matches the Pod's nodeSelector or affinity" },
      { id: "d", text: "Uncordon the workers" },
    ],
    correctOptionId: "c",
    explanation:
      "Both workers were rejected for the selector, not for resources or cordon. Labelling a worker fixes it. Tolerating the control-plane taint would still fail the selector there and puts workloads on the control plane.",
  },
];
