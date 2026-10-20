import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "replicasets-ownership",
    topic: "Labels and selectors",
    difficulty: "beginner",
    question: "How does a ReplicaSet decide which Pods count toward its replicas?",
    options: [
      { id: "a", text: "It keeps a list of the Pod names it created" },
      { id: "b", text: "It counts Pods whose labels match its selector" },
      { id: "c", text: "It counts every Pod on the same node" },
      { id: "d", text: "It counts every Pod that uses the same image" },
    ],
    correctOptionId: "b",
    explanation:
      "A ReplicaSet finds its Pods through spec.selector. Names, nodes, and images play no part, which is why a standalone Pod with matching labels can be adopted.",
  },
  {
    id: "replicasets-controller-loop",
    topic: "ReplicaSets",
    difficulty: "beginner",
    question: "A ReplicaSet has replicas: 3 but finds only 2 matching Pods. What does its controller do?",
    options: [
      { id: "a", text: "Creates 1 Pod from its template" },
      { id: "b", text: "Lowers replicas to 2" },
      { id: "c", text: "Restarts the 2 existing Pods" },
      { id: "d", text: "Waits until you run kubectl apply again" },
    ],
    correctOptionId: "a",
    explanation:
      "The controller compares the desired count with the count it finds and closes the gap by creating Pods from the template. It runs continuously, so no new apply is needed.",
  },
  {
    id: "replicasets-pod-naming",
    topic: "ReplicaSets",
    difficulty: "beginner",
    question: "A ReplicaSet named frontend creates a Pod. Which name could that Pod have?",
    options: [
      { id: "a", text: "frontend" },
      { id: "b", text: "frontend-1" },
      { id: "c", text: "frontend-x8k2p" },
      { id: "d", text: "pod-frontend" },
    ],
    correctOptionId: "c",
    explanation:
      "Pods created by a ReplicaSet are named after it plus a random five-character suffix. They are not numbered in order.",
  },
  {
    id: "replicasets-kubectl-l",
    topic: "Labels and selectors",
    difficulty: "beginner",
    question: "Which command lists the Pods that match the selector app=frontend?",
    options: [
      { id: "a", text: "kubectl get pods frontend" },
      { id: "b", text: "kubectl get pods --name app=frontend" },
      { id: "c", text: "kubectl describe app=frontend" },
      { id: "d", text: "kubectl get pods -l app=frontend" },
    ],
    correctOptionId: "d",
    explanation:
      "The -l flag filters by label selector, the same query a ReplicaSet uses to find its Pods. kubectl get pods frontend looks for a Pod named exactly frontend.",
  },
  {
    id: "replicasets-delete-managed-pod",
    topic: "ReplicaSets",
    difficulty: "beginner",
    question: "You delete one Pod owned by a ReplicaSet with replicas: 3. What do you see shortly after?",
    options: [
      { id: "a", text: "Two Pods, until you scale the ReplicaSet again" },
      { id: "b", text: "Three Pods, one of them with a new name" },
      { id: "c", text: "Three Pods, including the deleted one restored under its old name" },
      { id: "d", text: "No Pods, because the ReplicaSet is deleted too" },
    ],
    correctOptionId: "b",
    explanation:
      "The ReplicaSet sees 2 Pods against a desired 3 and creates a new one from the template. A replacement is a new Pod with a new name, never the old Pod coming back.",
  },
  {
    id: "replicasets-columns",
    topic: "Scaling",
    difficulty: "beginner",
    question: "kubectl get replicasets shows DESIRED 5, CURRENT 5, READY 2. What does this mean?",
    options: [
      { id: "a", text: "5 Pods exist and 2 of them are ready to serve" },
      { id: "b", text: "Only 2 Pods exist and 3 are still to be created" },
      { id: "c", text: "3 Pods have failed and will not be replaced" },
      { id: "d", text: "The ReplicaSet will scale down to 2" },
    ],
    correctOptionId: "a",
    explanation:
      "DESIRED is spec.replicas, CURRENT is how many Pods exist, and READY is how many are ready. Here all 5 Pods exist but 3 are still starting.",
  },
  {
    id: "replicasets-yaml-apiversion",
    topic: "ReplicaSet YAML",
    difficulty: "beginner",
    question: "Which apiVersion does a ReplicaSet manifest use?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "replicasets/v1" },
      { id: "d", text: "core/v1" },
    ],
    correctOptionId: "b",
    explanation:
      "ReplicaSets belong to the apps API group, so they use apps/v1. Plain v1 is the core group used by Pods.",
  },
  {
    id: "replicasets-yaml-labels",
    topic: "ReplicaSet YAML",
    difficulty: "beginner",
    question: "What happens if spec.template.metadata.labels does not match spec.selector.matchLabels?",
    options: [
      { id: "a", text: "The API server rejects the ReplicaSet" },
      { id: "b", text: "The ReplicaSet creates Pods but leaves them unready" },
      { id: "c", text: "Kubernetes copies the selector labels into the template" },
      { id: "d", text: "The ReplicaSet runs with 0 replicas" },
    ],
    correctOptionId: "a",
    explanation:
      "Pods built from such a template would never match the selector, so the ReplicaSet would create Pods forever without counting any. The API server refuses the manifest instead.",
  },
  {
    id: "replicasets-adopt",
    topic: "Labels and selectors",
    difficulty: "intermediate",
    question:
      "A ReplicaSet with replicas: 3 and selector app=frontend has 3 running Pods. You create a bare Pod labelled app=frontend. What happens?",
    options: [
      { id: "a", text: "The API server rejects the new Pod" },
      { id: "b", text: "The ReplicaSet raises its replicas to 4" },
      { id: "c", text: "The ReplicaSet adopts the Pod, sees 4, and deletes one Pod" },
      { id: "d", text: "The ReplicaSet creates a fourth Pod from its template" },
    ],
    correctOptionId: "c",
    explanation:
      "A Pod with matching labels and no owner is adopted. The ReplicaSet then counts 4 Pods against a desired 3 and deletes one. spec.replicas never changes on its own.",
  },
  {
    id: "replicasets-update",
    topic: "ReplicaSets",
    difficulty: "intermediate",
    question: "You change the image in a running ReplicaSet's Pod template. What happens to its existing Pods?",
    options: [
      { id: "a", text: "They are replaced one at a time with the new image" },
      { id: "b", text: "They are all deleted and recreated at once" },
      { id: "c", text: "Their containers restart with the new image" },
      { id: "d", text: "Nothing. Only Pods created later use the new image" },
    ],
    correctOptionId: "d",
    explanation:
      "A ReplicaSet only checks the Pod count. It does not update existing Pods. Rolling out a new template is what a Deployment adds on top.",
  },
  {
    id: "replicasets-stop-app",
    topic: "ReplicaSets",
    difficulty: "intermediate",
    question: "Which command removes a ReplicaSet's Pods so that they do not come back?",
    options: [
      { id: "a", text: "kubectl delete pods -l app=frontend" },
      { id: "b", text: "kubectl delete pod frontend-x8k2p" },
      { id: "c", text: "kubectl delete replicaset frontend" },
      { id: "d", text: "kubectl get pods -l app=frontend --watch" },
    ],
    correctOptionId: "c",
    explanation:
      "Deleting the ReplicaSet also deletes the Pods it owns by default. Deleting only the Pods, even all of them by label, just makes the ReplicaSet create replacements.",
  },
  {
    id: "replicasets-yaml-replicas-default",
    topic: "ReplicaSet YAML",
    difficulty: "intermediate",
    question: "You apply a ReplicaSet manifest that has no spec.replicas field. How many Pods does it run?",
    options: [
      { id: "a", text: "0" },
      { id: "b", text: "One per node" },
      { id: "c", text: "None, because the API server rejects the manifest" },
      { id: "d", text: "1" },
    ],
    correctOptionId: "d",
    explanation:
      "spec.replicas is optional and defaults to 1. Running one Pod per node is what a DaemonSet does, not a ReplicaSet.",
  },
  {
    id: "replicasets-yaml-template",
    topic: "ReplicaSet YAML",
    difficulty: "intermediate",
    question: "What goes inside spec.template of a ReplicaSet?",
    options: [
      { id: "a", text: "Pod metadata (such as labels) and a Pod spec, without apiVersion or kind" },
      { id: "b", text: "A complete Pod manifest including apiVersion and kind" },
      { id: "c", text: "The names of existing Pods to manage" },
      { id: "d", text: "The selector and the replica count" },
    ],
    correctOptionId: "a",
    explanation:
      "The template is a Pod template: metadata and spec for the Pods the ReplicaSet creates. The selector and replicas sit beside it directly under spec.",
  },
  {
    id: "replicasets-owner-references",
    topic: "Labels and selectors",
    difficulty: "intermediate",
    question: "Which Pod field records that a Pod is managed by a particular ReplicaSet?",
    options: [
      { id: "a", text: "metadata.annotations" },
      { id: "b", text: "metadata.ownerReferences" },
      { id: "c", text: "spec.nodeName" },
      { id: "d", text: "status.phase" },
    ],
    correctOptionId: "b",
    explanation:
      "Each managed Pod has an ownerReferences entry pointing back at its ReplicaSet. Kubernetes uses it to know which controller is responsible and what to clean up when the owner is deleted.",
  },
  {
    id: "replicasets-release",
    topic: "Labels and selectors",
    difficulty: "intermediate",
    question:
      "You change the app label on one Pod of a ReplicaSet so it no longer matches the selector. What happens?",
    options: [
      { id: "a", text: "The Pod is deleted immediately" },
      { id: "b", text: "The ReplicaSet changes the label back" },
      { id: "c", text: "Nothing, because the ReplicaSet still remembers the Pod by name" },
      { id: "d", text: "The ReplicaSet creates a replacement and the relabelled Pod keeps running on its own" },
    ],
    correctOptionId: "d",
    explanation:
      "The Pod is released: it no longer counts, so the ReplicaSet creates a new Pod to restore the count. The old Pod keeps running unmanaged, which is useful for debugging it outside the pool.",
  },
  {
    id: "replicasets-delete-bare-pod",
    topic: "ReplicaSets",
    difficulty: "intermediate",
    question: "You delete a Pod that you created directly, with no owner. What happens next?",
    options: [
      { id: "a", text: "The scheduler recreates it on another node" },
      { id: "b", text: "Nothing recreates it" },
      { id: "c", text: "The kubelet restarts it on the same node" },
      { id: "d", text: "A ReplicaSet is created automatically to replace it" },
    ],
    correctOptionId: "b",
    explanation:
      "Only a controller such as a ReplicaSet replaces deleted Pods. A Pod with no owner is gone for good once deleted.",
  },
  {
    id: "replicasets-why-deployments",
    topic: "ReplicaSets",
    difficulty: "intermediate",
    question: "Why do you usually create a Deployment instead of a ReplicaSet?",
    options: [
      { id: "a", text: "A Deployment rolls out template changes and can roll back, by managing ReplicaSets" },
      { id: "b", text: "A ReplicaSet cannot run more than one Pod" },
      { id: "c", text: "A ReplicaSet does not replace deleted Pods" },
      { id: "d", text: "ReplicaSets are deprecated and removed from current Kubernetes" },
    ],
    correctOptionId: "a",
    explanation:
      "A ReplicaSet keeps the count right but never updates existing Pods. A Deployment creates a new ReplicaSet for a new template and shifts Pods across gradually, keeping the old one for rollback.",
  },
  {
    id: "replicasets-yaml-matchlabels",
    topic: "ReplicaSet YAML",
    difficulty: "advanced",
    question:
      "A ReplicaSet's selector has matchLabels: {app: frontend, tier: web}. Which Pod matches it?",
    options: [
      { id: "a", text: "A Pod labelled app=frontend" },
      { id: "b", text: "A Pod labelled tier=web" },
      { id: "c", text: "A Pod labelled app=frontend, tier=web, env=prod" },
      { id: "d", text: "A Pod labelled app=frontend, tier=api" },
    ],
    correctOptionId: "c",
    explanation:
      "Every key-value pair in matchLabels must be present with an equal value. Extra labels on the Pod are allowed, but a missing or different value means no match.",
  },
  {
    id: "replicasets-scale-down-order",
    topic: "Scaling",
    difficulty: "advanced",
    question:
      "A ReplicaSet has 5 Pods: 3 Running and ready, 2 still in ContainerCreating. You scale it to 3. Which Pods are deleted first?",
    options: [
      { id: "a", text: "The 2 oldest Running Pods" },
      { id: "b", text: "2 Pods chosen strictly at random" },
      { id: "c", text: "The 2 Pods that are not ready yet" },
      { id: "d", text: "None, because scaling down waits for all Pods to become ready" },
    ],
    correctOptionId: "c",
    explanation:
      "When scaling down, the controller prefers to delete Pods that are not ready yet, so serving Pods are kept. Deleting ready Pods first would reduce capacity for no reason.",
  },
  {
    id: "replicasets-orphan-adopt",
    topic: "ReplicaSets",
    difficulty: "advanced",
    question:
      "You run kubectl delete replicaset frontend --cascade=orphan, then create a new ReplicaSet with the same selector and replicas. What happens to the old Pods?",
    options: [
      { id: "a", text: "The new ReplicaSet adopts them and creates no extra Pods" },
      { id: "b", text: "They were deleted along with the old ReplicaSet" },
      { id: "c", text: "They keep running unmanaged while the new ReplicaSet creates its own" },
      { id: "d", text: "The API server rejects the new ReplicaSet because the Pods are taken" },
    ],
    correctOptionId: "a",
    explanation:
      "--cascade=orphan deletes only the ReplicaSet and leaves its Pods without an owner. Ownerless Pods that match a selector are adopted, so the new ReplicaSet already finds the count it wants.",
  },
  {
    id: "replicasets-deployment-owner",
    topic: "ReplicaSets",
    difficulty: "advanced",
    question: "A Pod was created for a Deployment named web. What does the Pod's ownerReferences point to?",
    options: [
      { id: "a", text: "The Deployment web" },
      { id: "b", text: "A ReplicaSet named web-<hash>, which is owned by the Deployment" },
      { id: "c", text: "The node the Pod runs on" },
      { id: "d", text: "Nothing, because Deployment Pods have no owner" },
    ],
    correctOptionId: "b",
    explanation:
      "A Deployment owns ReplicaSets, and each ReplicaSet owns its Pods. The chain is Deployment to ReplicaSet to Pod, so the Pod's direct owner is the ReplicaSet.",
  },
  {
    id: "replicasets-template-change-delete",
    topic: "ReplicaSets",
    difficulty: "advanced",
    question:
      "A ReplicaSet runs 3 Pods with image v1. You change its template to v2, then delete one of the Pods. What is running afterwards?",
    options: [
      { id: "a", text: "3 Pods with v1" },
      { id: "b", text: "3 Pods with v2" },
      { id: "c", text: "2 Pods with v1 and no replacement" },
      { id: "d", text: "2 Pods with v1 and 1 Pod with v2" },
    ],
    correctOptionId: "d",
    explanation:
      "Existing Pods keep the image they were created with. The replacement is built from the current template, so it runs v2.",
  },
  {
    id: "replicasets-scale-command",
    topic: "Scaling",
    difficulty: "beginner",
    question: "Which command changes the frontend ReplicaSet to 5 Pods, and which field does it update?",
    options: [
      { id: "a", text: "kubectl apply --replicas=5 frontend, which updates status.replicas" },
      { id: "b", text: "kubectl create replicaset frontend --replicas=5, which updates metadata.replicas" },
      { id: "c", text: "kubectl scale replicaset frontend --replicas=5, which updates spec.replicas" },
      { id: "d", text: "kubectl run frontend --count=5, which updates spec.template.replicas" },
    ],
    correctOptionId: "c",
    explanation:
      "kubectl scale takes the resource type, its name, and --replicas. It changes the desired count in spec.replicas, and the controller then creates or deletes Pods to match.",
  },
  {
    id: "replicasets-shared-labels",
    topic: "Labels and selectors",
    difficulty: "intermediate",
    question: "Two separate ReplicaSets in one namespace both select app: web. Why is that a problem?",
    options: [
      { id: "a", text: "The API server merges them into a single ReplicaSet" },
      { id: "b", text: "The second ReplicaSet is rejected when you create it" },
      { id: "c", text: "It is not a problem, because each ReplicaSet only looks at Pods it created by name" },
      { id: "d", text: "Their selectors overlap, so they can fight over the same Pods, adopting or deleting Pods meant for the other" },
    ],
    correctOptionId: "d",
    explanation:
      "Selection is by label, not by name, so overlapping selectors make both controllers see the same Pods. Give each ReplicaSet a selector that only its own Pods carry. The API server does not check for overlap between workloads.",
  },
  {
    id: "replicasets-yaml-own-labels",
    topic: "ReplicaSet YAML",
    difficulty: "intermediate",
    question: "In a ReplicaSet manifest, what do the labels under the top-level metadata.labels do?",
    options: [
      { id: "a", text: "They select the Pods the ReplicaSet counts" },
      { id: "b", text: "They are copied onto every Pod the ReplicaSet creates" },
      { id: "c", text: "They label the ReplicaSet object itself, for filtering, and do not select Pods" },
      { id: "d", text: "They must equal spec.selector.matchLabels or the manifest is rejected" },
    ],
    correctOptionId: "c",
    explanation:
      "metadata.labels belong to the ReplicaSet itself. Pods are selected by spec.selector, and new Pods get their labels from spec.template.metadata.labels, which is the part that must match the selector.",
  },
  {
    id: "replicasets-yaml-extra-template-labels",
    topic: "ReplicaSet YAML",
    difficulty: "advanced",
    question: "selector.matchLabels is app: frontend, and the template labels are app: frontend, version: v1. What happens when you apply it?",
    options: [
      { id: "a", text: "It is rejected, because the template labels must equal the selector exactly" },
      { id: "b", text: "It is accepted, but new Pods only get app: frontend" },
      { id: "c", text: "It is accepted, and the selector is widened to include version: v1" },
      { id: "d", text: "It is accepted; the template may carry extra labels as long as it matches the selector" },
    ],
    correctOptionId: "d",
    explanation:
      "The rule is that Pods created from the template must match the selector. A Pod labelled app: frontend, version: v1 does match app: frontend, so extra labels are fine. The selector is never changed for you.",
  },
  {
    id: "replicasets-scale-zero",
    topic: "Scaling",
    difficulty: "intermediate",
    question: "You want to stop all of a ReplicaSet's Pods for now but keep the ReplicaSet so you can start them again later. What do you run?",
    options: [
      { id: "a", text: "kubectl scale replicaset frontend --replicas=0" },
      { id: "b", text: "kubectl delete pods -l app=frontend" },
      { id: "c", text: "kubectl delete replicaset frontend" },
      { id: "d", text: "kubectl label pods -l app=frontend app-" },
    ],
    correctOptionId: "a",
    explanation:
      "Scaling to 0 deletes the Pods and keeps the ReplicaSet, so scaling up again recreates them. Deleting its Pods only produces replacements, deleting the ReplicaSet removes it too, and removing the label releases the Pods while the ReplicaSet creates new ones.",
  },
];
