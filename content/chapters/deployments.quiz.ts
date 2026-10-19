import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "deploy-owner",
    topic: "Deployments",
    difficulty: "beginner",
    question: "Which object creates the Pods for a Deployment?",
    options: [
      { id: "a", text: "The Deployment creates them directly" },
      { id: "b", text: "A ReplicaSet owned by the Deployment" },
      { id: "c", text: "The kube-scheduler" },
      { id: "d", text: "The kubelet on the control plane node" },
    ],
    correctOptionId: "b",
    explanation:
      "A Deployment manages ReplicaSets, and each ReplicaSet creates and removes Pods to match its replica count. The scheduler only picks a node for a Pod that already exists.",
  },
  {
    id: "deploy-delete-pod",
    topic: "Deployments",
    difficulty: "beginner",
    question: "A Deployment has replicas: 3. You delete one of its Pods. What happens next?",
    options: [
      { id: "a", text: "The Deployment drops to 2 replicas" },
      { id: "b", text: "Nothing until you run kubectl apply again" },
      { id: "c", text: "The ReplicaSet creates a new Pod with a new name" },
      { id: "d", text: "The deleted Pod restarts with the same name" },
    ],
    correctOptionId: "c",
    explanation:
      "Desired state is still 3. The ReplicaSet sees only 2 matching Pods and creates a replacement. The new Pod gets a new generated name.",
  },
  {
    id: "deploy-selector",
    topic: "Deployment YAML",
    difficulty: "intermediate",
    question: "In a Deployment manifest, spec.selector.matchLabels must match which field?",
    options: [
      { id: "a", text: "metadata.labels of the Deployment" },
      { id: "b", text: "spec.template.metadata.labels" },
      { id: "c", text: "The container name" },
      { id: "d", text: "metadata.name of the Deployment" },
    ],
    correctOptionId: "b",
    explanation:
      "The selector decides which Pods belong to the Deployment, so the Pod template must carry those labels. If they do not match, the API server rejects the manifest. The Deployment's own labels are free to differ.",
  },
  {
    id: "deploy-surge",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question:
      "A Deployment has replicas: 4, maxSurge: 1, and maxUnavailable: 0. During a rolling update, what is the most Pods that can exist at once?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "5" },
      { id: "c", text: "6" },
      { id: "d", text: "8" },
    ],
    correctOptionId: "b",
    explanation:
      "maxSurge: 1 allows one Pod above the desired 4. maxUnavailable: 0 means an old Pod is only removed after a new one is ready, so the count never exceeds 5.",
  },
  {
    id: "deploy-scale-cmd",
    topic: "Deployments",
    difficulty: "beginner",
    question: "Which command changes the Deployment named web to 5 replicas?",
    options: [
      { id: "a", text: "kubectl scale deployment web --replicas=5" },
      { id: "b", text: "kubectl scale replicaset web --replicas=5" },
      { id: "c", text: "kubectl set replicas deployment web 5" },
      { id: "d", text: "kubectl rollout scale deployment web 5" },
    ],
    correctOptionId: "a",
    explanation:
      "kubectl scale on the Deployment updates spec.replicas, and the Deployment passes the new count to its ReplicaSet. Scaling the ReplicaSet directly is undone by the Deployment.",
  },
  {
    id: "deploy-ready-column",
    topic: "Deployments",
    difficulty: "beginner",
    question: "kubectl get deployments shows READY 2/3 for web. What does that mean?",
    options: [
      { id: "a", text: "2 Pods failed and 3 are running" },
      { id: "b", text: "2 of the Deployment's 3 ReplicaSets are active" },
      { id: "c", text: "The Deployment is spread over 2 of 3 nodes" },
      { id: "d", text: "3 Pods are desired and 2 of them are ready" },
    ],
    correctOptionId: "d",
    explanation:
      "READY is observed over desired: ready Pods out of spec.replicas. A gap like this is normal for a short time after scaling up, while new containers start.",
  },
  {
    id: "deploy-apiversion",
    topic: "Deployment YAML",
    difficulty: "beginner",
    question: "Which apiVersion does a Deployment manifest use?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "batch/v1" },
      { id: "c", text: "deployments/v1" },
      { id: "d", text: "apps/v1" },
    ],
    correctOptionId: "d",
    explanation:
      "Deployments, ReplicaSets, StatefulSets, and DaemonSets live in the apps API group, so the manifest uses apps/v1. Plain v1 is the core group used by Pods and Services.",
  },
  {
    id: "deploy-delete-deployment",
    topic: "Deployments",
    difficulty: "beginner",
    question: "You run kubectl delete deployment web. What happens to its ReplicaSets and Pods?",
    options: [
      { id: "a", text: "They are deleted too" },
      { id: "b", text: "They keep running without an owner" },
      { id: "c", text: "The ReplicaSets are deleted but the Pods keep running" },
      { id: "d", text: "The ReplicaSets stay at 0 replicas for rollback" },
    ],
    correctOptionId: "a",
    explanation:
      "The ReplicaSets are owned by the Deployment and the Pods by the ReplicaSets, so deleting the Deployment removes all of them. Deleting a single Pod, by contrast, only triggers a replacement.",
  },
  {
    id: "deploy-undo",
    topic: "Deployments",
    difficulty: "beginner",
    question: "A rollout to a new image is failing. Which command returns web to its previous revision?",
    options: [
      { id: "a", text: "kubectl rollout history deployment/web" },
      { id: "b", text: "kubectl rollout status deployment/web" },
      { id: "c", text: "kubectl rollout undo deployment/web" },
      { id: "d", text: "kubectl delete replicaset with the newest hash" },
    ],
    correctOptionId: "c",
    explanation:
      "rollout undo scales the previous ReplicaSet back up and the new one down. rollout history only lists revisions, and rollout status only reports progress.",
  },
  {
    id: "deploy-rs-name",
    topic: "Deployments",
    difficulty: "intermediate",
    question: "A Deployment named web owns a ReplicaSet named web-7c5ddbdf54. What is 7c5ddbdf54?",
    options: [
      { id: "a", text: "A hash of the Pod template" },
      { id: "b", text: "The revision number in hexadecimal" },
      { id: "c", text: "A random suffix chosen when the Deployment was created" },
      { id: "d", text: "The ID of the node running the Pods" },
    ],
    correctOptionId: "a",
    explanation:
      "The suffix is the pod-template-hash, computed from the Pod template. A changed template gives a different hash and so a new ReplicaSet, while each Pod adds its own random suffix after it.",
  },
  {
    id: "deploy-scale-rs",
    topic: "Deployments",
    difficulty: "intermediate",
    question:
      "A Deployment has replicas: 3. You run kubectl scale replicaset web-7c5ddbdf54 --replicas=5 on its ReplicaSet. What is the result?",
    options: [
      { id: "a", text: "The Deployment's spec.replicas changes to 5" },
      { id: "b", text: "The ReplicaSet keeps 5 Pods and the Deployment shows 5/3" },
      { id: "c", text: "The command is rejected because the ReplicaSet has an owner" },
      { id: "d", text: "The Deployment sets the ReplicaSet back to 3" },
    ],
    correctOptionId: "d",
    explanation:
      "The Deployment controller keeps its ReplicaSet's count equal to spec.replicas, so your change is reverted. The command itself succeeds, which is why this mistake is easy to miss.",
  },
  {
    id: "deploy-trigger",
    topic: "Deployments",
    difficulty: "intermediate",
    question: "Which change to a Deployment starts a new rollout?",
    options: [
      { id: "a", text: "Changing spec.replicas from 3 to 5" },
      { id: "b", text: "Adding a label to the Deployment's own metadata" },
      { id: "c", text: "Changing strategy.rollingUpdate.maxSurge" },
      { id: "d", text: "Changing the container image in spec.template" },
    ],
    correctOptionId: "d",
    explanation:
      "Only changes to the Pod template (spec.template) create a new ReplicaSet and a new revision. Changing replicas just scales the current ReplicaSet.",
  },
  {
    id: "deploy-rolling",
    topic: "Deployments",
    difficulty: "intermediate",
    question: "You change the image of a Deployment that uses the default RollingUpdate strategy. What does it do?",
    options: [
      { id: "a", text: "Updates the existing ReplicaSet's template so it replaces its Pods" },
      { id: "b", text: "Restarts the containers in place with the new image" },
      {
        id: "c",
        text: "Creates a new ReplicaSet, scales it up while scaling the old one down, and keeps the old one at 0 replicas",
      },
      { id: "d", text: "Deletes all Pods, then creates new ones from the new template" },
    ],
    correctOptionId: "c",
    explanation:
      "Each template version gets its own ReplicaSet, and Pods move across a few at a time. The old ReplicaSet is kept at 0 so you can roll back. Deleting everything first is the Recreate strategy.",
  },
  {
    id: "deploy-recreate",
    topic: "Deployment YAML",
    difficulty: "intermediate",
    question: "A Deployment sets strategy.type: Recreate. How does it apply a new image?",
    options: [
      { id: "a", text: "It stops all old Pods first, then creates the new ones, so there is a short outage" },
      { id: "b", text: "It creates all new Pods first, then deletes the old ones" },
      { id: "c", text: "It replaces Pods one at a time, like RollingUpdate with maxSurge: 0" },
      { id: "d", text: "It recreates the Deployment object, losing its rollout history" },
    ],
    correctOptionId: "a",
    explanation:
      "Recreate kills every existing Pod before starting new ones. Use it when two versions must never run at the same time and brief downtime is acceptable.",
  },
  {
    id: "deploy-history-limit",
    topic: "Deployment YAML",
    difficulty: "intermediate",
    question: "What does spec.revisionHistoryLimit control, and what is its default?",
    options: [
      { id: "a", text: "How many times a failing Pod is restarted; default 10" },
      { id: "b", text: "How many old ReplicaSets are kept for rollback; default 10" },
      { id: "c", text: "How many old ReplicaSets are kept for rollback; default 3" },
      { id: "d", text: "How many rollouts may run at once; default 1" },
    ],
    correctOptionId: "b",
    explanation:
      "Each old ReplicaSet at 0 replicas is a revision you can roll back to, and Kubernetes keeps 10 by default. Older ones beyond the limit are garbage collected.",
  },
  {
    id: "deploy-up-to-date",
    topic: "Deployments",
    difficulty: "intermediate",
    question:
      "During a rollout, kubectl get deployments shows READY 3/3, UP-TO-DATE 1, AVAILABLE 3. What does UP-TO-DATE 1 tell you?",
    options: [
      { id: "a", text: "Only 1 Pod is ready to serve traffic" },
      { id: "b", text: "The Deployment has had 1 revision" },
      { id: "c", text: "1 Pod has been created from the current Pod template" },
      { id: "d", text: "1 old ReplicaSet is kept for rollback" },
    ],
    correctOptionId: "c",
    explanation:
      "UP-TO-DATE counts Pods running the latest template, so the rollout has replaced 1 of 3 so far. READY and AVAILABLE count all ready Pods, old and new.",
  },
  {
    id: "deploy-hash-label",
    topic: "Deployments",
    difficulty: "intermediate",
    question: "Why does the Deployment add a pod-template-hash label to each ReplicaSet and its Pods?",
    options: [
      { id: "a", text: "So the old and new ReplicaSets do not select each other's Pods" },
      { id: "b", text: "So the scheduler places Pods of one version on the same node" },
      { id: "c", text: "So Services send traffic only to the newest version" },
      { id: "d", text: "So kubectl can verify the image digest" },
    ],
    correctOptionId: "a",
    explanation:
      "All ReplicaSets of a Deployment share your selector labels. The extra hash label makes each ReplicaSet's selector unique, so each one counts only its own Pods.",
  },
  {
    id: "deploy-history-zero",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question: "A Deployment sets revisionHistoryLimit: 0. What is the consequence?",
    options: [
      { id: "a", text: "Rollout history is unlimited" },
      { id: "b", text: "Rolling updates are disabled and Recreate is used" },
      { id: "c", text: "The API server rejects the manifest" },
      { id: "d", text: "Old ReplicaSets are deleted after each rollout, so there is nothing to roll back to" },
    ],
    correctOptionId: "d",
    explanation:
      "Rollback works by scaling an old ReplicaSet back up. With a limit of 0, those ReplicaSets are cleaned up, so kubectl rollout undo has no previous revision to use.",
  },
  {
    id: "deploy-selector-immutable",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question:
      "You edit an existing apps/v1 Deployment, changing spec.selector.matchLabels and the template labels to app: web2, then run kubectl apply. What happens?",
    options: [
      { id: "a", text: "A new ReplicaSet is created with the new labels" },
      { id: "b", text: "The existing Pods are relabeled to app: web2" },
      { id: "c", text: "The API server rejects the change because the selector is immutable" },
      { id: "d", text: "The old Pods are orphaned and new Pods are created" },
    ],
    correctOptionId: "c",
    explanation:
      "In apps/v1 a Deployment's selector cannot change after creation. To use a new selector you create a new Deployment (or delete and recreate this one).",
  },
  {
    id: "deploy-percent",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question:
      "A Deployment has replicas: 10, maxSurge: 25%, and maxUnavailable: 25%. During a rolling update, what is the most Pods that can exist and the fewest that must stay available?",
    options: [
      { id: "a", text: "13 at most, 8 available at least" },
      { id: "b", text: "12 at most, 8 available at least" },
      { id: "c", text: "13 at most, 7 available at least" },
      { id: "d", text: "12 at most, 7 available at least" },
    ],
    correctOptionId: "a",
    explanation:
      "25% of 10 is 2.5. maxSurge rounds up to 3, giving 13 Pods at most. maxUnavailable rounds down to 2, so at least 8 must stay available.",
  },
  {
    id: "deploy-rounding",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question:
      "A Deployment has replicas: 3 and the default maxSurge: 25% and maxUnavailable: 25%. How does a rolling update proceed?",
    options: [
      { id: "a", text: "It may remove 1 old Pod before adding a new one" },
      { id: "b", text: "It adds 1 new Pod before removing an old one, and never drops below 3 available" },
      { id: "c", text: "It stalls, because both values round to 0" },
      { id: "d", text: "It replaces all 3 Pods at once" },
    ],
    correctOptionId: "b",
    explanation:
      "25% of 3 is 0.75. maxSurge rounds up to 1 and maxUnavailable rounds down to 0, so the Deployment must start a new Pod and wait for it to be ready before removing an old one.",
  },
  {
    id: "deploy-both-zero",
    topic: "Deployment YAML",
    difficulty: "advanced",
    question: "What happens if you apply a Deployment with maxSurge: 0 and maxUnavailable: 0?",
    options: [
      { id: "a", text: "Rolling updates replace Pods one at a time in place" },
      { id: "b", text: "The Deployment falls back to the Recreate strategy" },
      { id: "c", text: "It is accepted, but every rollout hangs" },
      { id: "d", text: "The API server rejects it, because a rollout could never make progress" },
    ],
    correctOptionId: "d",
    explanation:
      "With no extra Pods allowed and no Pods allowed to be missing, the Deployment could never swap an old Pod for a new one. Validation rejects this combination, so at least one value must be above 0.",
  },
];
