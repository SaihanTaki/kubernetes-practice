import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "rollouts-trigger",
    topic: "Rollouts",
    difficulty: "beginner",
    question: "Which of these changes to a Deployment starts a new rollout?",
    options: [
      { id: "a", text: "Adding an environment variable to the container in spec.template" },
      { id: "b", text: "Running kubectl scale deployment api --replicas=6" },
      { id: "c", text: "Changing strategy.rollingUpdate.maxSurge from 1 to 2" },
      { id: "d", text: "Adding a label to the Deployment's own metadata" },
    ],
    correctOptionId: "a",
    explanation:
      "Only changes under spec.template create a new ReplicaSet and revision. Scaling resizes the current ReplicaSet, and strategy or Deployment metadata changes update the Deployment object only.",
  },
  {
    id: "rollouts-math-6",
    topic: "Rollouts",
    difficulty: "intermediate",
    question:
      "A Deployment has replicas: 6, maxSurge: 2, and maxUnavailable: 1. During a rolling update, what is the most Pods that can exist and the fewest that must stay ready?",
    options: [
      { id: "a", text: "7 at most, 4 ready at least" },
      { id: "b", text: "8 at most, 5 ready at least" },
      { id: "c", text: "6 at most, 5 ready at least" },
      { id: "d", text: "8 at most, 6 ready at least" },
    ],
    correctOptionId: "b",
    explanation:
      "maxSurge adds to replicas: 6 + 2 = 8 Pods at most. maxUnavailable subtracts: 6 - 1 = 5 Pods must stay ready.",
  },
  {
    id: "rollouts-math-4-default",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "With replicas: 4 and the default rolling update bounds, how many Pods must stay ready during an update?",
    options: [
      { id: "a", text: "4, because the defaults never allow downtime" },
      { id: "b", text: "2, because 25% of 4 rounds up to 2" },
      { id: "c", text: "3, because maxUnavailable 25% of 4 is 1" },
      { id: "d", text: "0, because the defaults allow all Pods to be replaced at once" },
    ],
    correctOptionId: "c",
    explanation:
      "Both defaults are 25%. 25% of 4 is exactly 1, so one Pod may be unavailable and 3 must stay ready. Up to 5 Pods may exist at once.",
  },
  {
    id: "rollouts-readiness-gate",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "During a rolling update, what lets the controller remove another old Pod?",
    options: [
      { id: "a", text: "A fixed timer of 30 seconds per Pod" },
      { id: "b", text: "The new Pod being scheduled to a node" },
      { id: "c", text: "The new Pod's container image finishing its download" },
      { id: "d", text: "A new Pod becoming available: ready, and ready for minReadySeconds" },
    ],
    correctOptionId: "d",
    explanation:
      "Old Pods go only while the number of available Pods stays at or above replicas minus maxUnavailable. A new Pod counts once it passes readiness and stays ready for minReadySeconds.",
  },
  {
    id: "rollouts-recreate-when",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "When is strategy.type: Recreate the better choice?",
    options: [
      { id: "a", text: "When the old and new versions must never run at the same time" },
      { id: "b", text: "When the app must stay available during the update" },
      { id: "c", text: "When you want the update to keep old Pods for rollback" },
      { id: "d", text: "When the Deployment has more than 10 replicas" },
    ],
    correctOptionId: "a",
    explanation:
      "Recreate stops every old Pod before starting new ones, so the two versions never overlap. The cost is downtime between the two steps. Rollback history works the same with either strategy.",
  },
  {
    id: "rollouts-status",
    topic: "Rollouts",
    difficulty: "beginner",
    question: "Which command waits until a Deployment's rollout finishes and fails if it does not?",
    options: [
      { id: "a", text: "kubectl get deployment api --watch" },
      { id: "b", text: "kubectl rollout status deployment/api" },
      { id: "c", text: "kubectl rollout history deployment/api" },
      { id: "d", text: "kubectl describe replicaset api" },
    ],
    correctOptionId: "b",
    explanation:
      "rollout status reports progress until the rollout completes and exits 0, or exits with an error if the progress deadline passes. That is why CI runs it after apply. history only lists revisions.",
  },
  {
    id: "rollouts-history-cause",
    topic: "Rollouts",
    difficulty: "beginner",
    question: "Where does the CHANGE-CAUSE column in kubectl rollout history come from?",
    options: [
      { id: "a", text: "The commit message of the manifest in Git" },
      { id: "b", text: "The image tag of each revision" },
      { id: "c", text: "The kubernetes.io/change-cause annotation, copied from the Deployment to each revision's ReplicaSet" },
      { id: "d", text: "The last event in kubectl describe" },
    ],
    correctOptionId: "c",
    explanation:
      "Kubernetes knows nothing about Git. The controller copies the Deployment's kubernetes.io/change-cause annotation onto the current ReplicaSet, and history prints it per revision. Without it the column shows <none>.",
  },
  {
    id: "rollouts-record",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "What should you use instead of the --record flag to fill in CHANGE-CAUSE?",
    options: [
      { id: "a", text: "kubectl label deployment api change-cause=..." },
      { id: "b", text: "kubectl rollout history deployment/api --record" },
      { id: "c", text: "Nothing, CHANGE-CAUSE is filled in automatically" },
      { id: "d", text: "kubectl annotate deployment api kubernetes.io/change-cause=... --overwrite" },
    ],
    correctOptionId: "d",
    explanation:
      "--record is deprecated and only saved the command line. Set the kubernetes.io/change-cause annotation directly. A label would not be read by rollout history, and label values cannot hold free text.",
  },
  {
    id: "rollouts-undo-previous",
    topic: "Rollouts",
    difficulty: "beginner",
    question: "What does kubectl rollout undo deployment/api do with no other flags?",
    options: [
      { id: "a", text: "Rolls back to the previous revision" },
      { id: "b", text: "Rolls back to revision 1" },
      { id: "c", text: "Deletes the newest ReplicaSet and its Pods instantly" },
      { id: "d", text: "Pauses the current rollout" },
    ],
    correctOptionId: "a",
    explanation:
      "Without --to-revision, undo goes to the revision before the current one. It applies that revision's template, which starts an ordinary rolling update. Revision 1 needs --to-revision=1.",
  },
  {
    id: "rollouts-undo-renumber",
    topic: "Rollouts",
    difficulty: "advanced",
    question:
      "History shows revisions 1, 2, and 3, with 3 current. You run kubectl rollout undo deployment/api --to-revision=1. What does history show afterwards?",
    options: [
      { id: "a", text: "1, 2, 3, with 1 current" },
      { id: "b", text: "2, 3, 4, with 4 current" },
      { id: "c", text: "1, 2, 3, 4, with 4 current" },
      { id: "d", text: "1 only, because undo deletes newer revisions" },
    ],
    correctOptionId: "b",
    explanation:
      "Undo reuses revision 1's ReplicaSet and gives it the next number, 4. Its old number disappears, so history lists 2, 3, and 4. Newer revisions are kept, not deleted.",
  },
  {
    id: "rollouts-history-revision",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "How do you see which image revision 2 ran before rolling back to it?",
    options: [
      { id: "a", text: "kubectl get replicasets --revision=2" },
      { id: "b", text: "kubectl rollout undo deployment/api --dry-run" },
      { id: "c", text: "kubectl rollout history deployment/api --revision=2" },
      { id: "d", text: "kubectl describe deployment api --revision=2" },
    ],
    correctOptionId: "c",
    explanation:
      "rollout history with --revision prints the Pod template stored for that revision, including the image. get and describe do not take a --revision flag.",
  },
  {
    id: "rollouts-stuck-signs",
    topic: "Stuck rollouts",
    difficulty: "intermediate",
    question:
      "replicas: 4, maxSurge: 1, maxUnavailable: 1. You roll out an image that crashes on start. What do you see once the rollout stops progressing?",
    options: [
      { id: "a", text: "0 Pods running: the old Pods are deleted first" },
      { id: "b", text: "4 crashing new Pods and no old Pods" },
      { id: "c", text: "4 ready old Pods and no new Pods" },
      { id: "d", text: "3 ready old Pods and 2 new Pods in CrashLoopBackOff" },
    ],
    correctOptionId: "d",
    explanation:
      "One old Pod may go (maxUnavailable: 1), leaving 3 ready. The new ReplicaSet uses the surge slot and the freed slot, giving 5 Pods. The new Pods never become ready, so no more old Pods are removed.",
  },
  {
    id: "rollouts-imagepull",
    topic: "Stuck rollouts",
    difficulty: "beginner",
    question: "New Pods from a rollout show ImagePullBackOff. What is the most likely cause?",
    options: [
      { id: "a", text: "The image tag does not exist or the registry refused the pull" },
      { id: "b", text: "The readiness probe path is wrong" },
      { id: "c", text: "maxSurge is set to 0" },
      { id: "d", text: "The application crashed after starting" },
    ],
    correctOptionId: "a",
    explanation:
      "ImagePullBackOff means the kubelet could not pull the image, so the container never started. A crash after start shows CrashLoopBackOff, and a failing readiness probe leaves the Pod Running but 0/1 ready.",
  },
  {
    id: "rollouts-deadline",
    topic: "Stuck rollouts",
    difficulty: "advanced",
    question: "A rollout exceeds progressDeadlineSeconds. What does Kubernetes do?",
    options: [
      { id: "a", text: "Rolls back to the previous revision automatically" },
      { id: "b", text: "Marks the Progressing condition False with reason ProgressDeadlineExceeded and leaves the Pods as they are" },
      { id: "c", text: "Deletes the new ReplicaSet" },
      { id: "d", text: "Switches the strategy to Recreate" },
    ],
    correctOptionId: "b",
    explanation:
      "The deadline only reports failure: the condition changes and kubectl rollout status exits with an error. There is no automatic rollback; you run undo or ship a fix.",
  },
  {
    id: "rollouts-undo-then-apply",
    topic: "Stuck rollouts",
    difficulty: "intermediate",
    question:
      "You undo a bad rollout of example/api:2.0. The manifest in Git still says 2.0. What happens on the next kubectl apply of that file?",
    options: [
      { id: "a", text: "Nothing, because undo locked the Deployment" },
      { id: "b", text: "apply fails because the revision already exists" },
      { id: "c", text: "The 2.0 image rolls out again" },
      { id: "d", text: "apply keeps 1.1 because it was the last successful revision" },
    ],
    correctOptionId: "c",
    explanation:
      "Undo changes only the live Deployment. apply makes the cluster match the file, so the bad template comes back. Fix the file after an undo.",
  },
  {
    id: "rollouts-pause",
    topic: "Rollouts",
    difficulty: "intermediate",
    question:
      "You run kubectl rollout pause, then change the image and an environment variable, then kubectl rollout resume. How many new revisions result?",
    options: [
      { id: "a", text: "One, containing both changes" },
      { id: "b", text: "Two, one per change" },
      { id: "c", text: "None, changes made while paused are discarded" },
      { id: "d", text: "Three, including one for the resume" },
    ],
    correctOptionId: "a",
    explanation:
      "While paused, template changes are stored but no ReplicaSet is created. Resume starts one rollout with the final template, so both changes land as a single revision.",
  },
  {
    id: "rollouts-restart",
    topic: "Rollouts",
    difficulty: "intermediate",
    question: "How does kubectl rollout restart deployment/api replace the Pods?",
    options: [
      { id: "a", text: "It deletes all Pods at once and lets the ReplicaSet recreate them" },
      { id: "b", text: "It restarts the containers inside the existing Pods" },
      { id: "c", text: "It scales the Deployment to 0 and back" },
      { id: "d", text: "It adds a restartedAt annotation to the Pod template, which starts a normal rolling update" },
    ],
    correctOptionId: "d",
    explanation:
      "restart sets kubectl.kubernetes.io/restartedAt on the template. That is a template change, so a new ReplicaSet rolls out under the usual maxSurge and maxUnavailable, with no downtime.",
  },
  {
    id: "rollouts-yaml-percent",
    topic: "Rollout YAML",
    difficulty: "advanced",
    question:
      "A Deployment has replicas: 5, maxSurge: 25%, and maxUnavailable: 25%. What do the two percentages resolve to?",
    options: [
      { id: "a", text: "maxSurge 1, maxUnavailable 1" },
      { id: "b", text: "maxSurge 2, maxUnavailable 1" },
      { id: "c", text: "maxSurge 1, maxUnavailable 2" },
      { id: "d", text: "maxSurge 2, maxUnavailable 2" },
    ],
    correctOptionId: "b",
    explanation:
      "25% of 5 is 1.25. maxSurge rounds up to 2 and maxUnavailable rounds down to 1, so up to 7 Pods exist and at least 4 stay ready.",
  },
  {
    id: "rollouts-yaml-annotation",
    topic: "Rollout YAML",
    difficulty: "intermediate",
    question: "In a Deployment manifest, where does the kubernetes.io/change-cause annotation go?",
    options: [
      { id: "a", text: "spec.template.metadata.labels" },
      { id: "b", text: "spec.strategy" },
      { id: "c", text: "metadata.annotations of the Deployment" },
      { id: "d", text: "spec.selector.matchLabels" },
    ],
    correctOptionId: "c",
    explanation:
      "The change cause belongs in the Deployment's own metadata.annotations. Putting it in the template would change the template and start an extra rollout; labels and selectors cannot hold free text.",
  },
  {
    id: "rollouts-yaml-history-limit",
    topic: "Rollout YAML",
    difficulty: "intermediate",
    question: "A Deployment sets revisionHistoryLimit: 3 and has been updated 8 times. What can kubectl rollout undo --to-revision reach?",
    options: [
      { id: "a", text: "All 8 earlier revisions" },
      { id: "b", text: "Only revision 1" },
      { id: "c", text: "Nothing, a limit of 3 disables rollback" },
      { id: "d", text: "The 3 most recent old revisions" },
    ],
    correctOptionId: "d",
    explanation:
      "revisionHistoryLimit is the number of old ReplicaSets kept at 0 replicas. Older ones are deleted, and a revision without its ReplicaSet cannot be restored.",
  },
  {
    id: "rollouts-yaml-min-ready",
    topic: "Rollout YAML",
    difficulty: "advanced",
    question: "What does spec.minReadySeconds: 10 change about a rolling update?",
    options: [
      { id: "a", text: "A new Pod must stay ready for 10 seconds before it counts as available" },
      { id: "b", text: "The rollout fails if it takes longer than 10 seconds" },
      { id: "c", text: "Each container gets 10 seconds to shut down" },
      { id: "d", text: "Readiness probes run every 10 seconds" },
    ],
    correctOptionId: "a",
    explanation:
      "minReadySeconds delays availability, which slows the rollout and catches Pods that crash soon after their first passing probe. The failure deadline is progressDeadlineSeconds, and probe timing is set on the probe.",
  },
  {
    id: "rollouts-yaml-recreate-fields",
    topic: "Rollout YAML",
    difficulty: "intermediate",
    question: "Which strategy block is valid for a Deployment that must not run two versions at once?",
    options: [
      { id: "a", text: "type: RollingUpdate with maxSurge: 0 and maxUnavailable: 0" },
      { id: "b", text: "type: Recreate, with no rollingUpdate block" },
      { id: "c", text: "type: Recreate with rollingUpdate.maxSurge: 0" },
      { id: "d", text: "type: Replace" },
    ],
    correctOptionId: "b",
    explanation:
      "Recreate takes no parameters, and the API rejects a rollingUpdate block with it. Both bounds at 0 is rejected because no Pod could ever be swapped, and Replace is not a strategy type.",
  },
  {
    id: "rollouts-yaml-probe",
    topic: "Rollout YAML",
    difficulty: "advanced",
    question:
      "A new release passes its readiness probe on / but cannot reach its database, and the rollout completes with every request failing. Which manifest change would have stopped the rollout?",
    options: [
      { id: "a", text: "Raising maxSurge" },
      { id: "b", text: "Setting revisionHistoryLimit: 0" },
      { id: "c", text: "Pointing the readiness probe at an endpoint that checks the database, such as /ready" },
      { id: "d", text: "Removing the readiness probe" },
    ],
    correctOptionId: "c",
    explanation:
      "The rollout trusts readiness. If the probe checks something that matters, broken Pods never become ready and the old Pods keep serving. Removing the probe makes Pods ready as soon as they start.",
  },
  {
    id: "rollouts-same-template",
    topic: "Rollouts",
    difficulty: "advanced",
    question:
      "Revision 1 ran example/api:1.0 and revision 2 runs 1.1. You apply a manifest whose template is identical to revision 1. What happens?",
    options: [
      { id: "a", text: "A new ReplicaSet is created as revision 3, next to the unused revision 1" },
      { id: "b", text: "Nothing, because the template already exists in the history" },
      { id: "c", text: "The apply is rejected as a duplicate" },
      { id: "d", text: "The revision 1 ReplicaSet is scaled back up and becomes revision 3" },
    ],
    correctOptionId: "d",
    explanation:
      "Kubernetes does not create a duplicate ReplicaSet for a template it already has. It reuses the old one and gives it the next revision number, the same way rollout undo does.",
  },
  {
    id: "rollouts-fix-forward",
    topic: "Stuck rollouts",
    difficulty: "intermediate",
    question:
      "A rollout to example/api:2.0 is stuck in CrashLoopBackOff. Instead of undo, you set the image to a fixed tag, 2.0.1. What happens?",
    options: [
      { id: "a", text: "The change waits until the stuck rollout reaches its progress deadline" },
      { id: "b", text: "The rollout moves on to the 2.0.1 template and the failing 2.0 ReplicaSet is scaled down" },
      { id: "c", text: "The API server rejects template changes during a rollout" },
      { id: "d", text: "Both 2.0 and 2.0.1 Pods keep running until you delete the 2.0 ReplicaSet" },
    ],
    correctOptionId: "b",
    explanation:
      "A new template starts a new rollout right away. The controller scales the newest ReplicaSet up and the older ones down, including the failing one. You do not have to wait for the deadline or undo first.",
  },
  {
    id: "rollouts-paused-undo",
    topic: "Rollouts",
    difficulty: "advanced",
    question: "A Deployment is paused with kubectl rollout pause. Which still works without resuming?",
    options: [
      { id: "a", text: "kubectl rollout undo deployment/api" },
      { id: "b", text: "A template change rolling out new Pods at once" },
      { id: "c", text: "kubectl scale deployment api --replicas=6" },
      { id: "d", text: "None, a paused Deployment ignores every change" },
    ],
    correctOptionId: "c",
    explanation:
      "Scaling still applies while paused. Template changes are stored but create no ReplicaSet until resume, and rollout undo refuses to run on a paused Deployment.",
  },
  {
    id: "rollouts-restart-configmap",
    topic: "Rollouts",
    difficulty: "intermediate",
    question:
      "You changed a ConfigMap that the api Pods read only at startup. The Deployment itself did not change. How do you get the Pods to use the new values without downtime?",
    options: [
      { id: "a", text: "kubectl rollout undo deployment/api" },
      { id: "b", text: "kubectl rollout status deployment/api" },
      { id: "c", text: "kubectl apply the unchanged Deployment manifest again" },
      { id: "d", text: "kubectl rollout restart deployment/api" },
    ],
    correctOptionId: "d",
    explanation:
      "restart changes the template through the restartedAt annotation, so new Pods roll out and read the new ConfigMap. Applying an unchanged manifest changes nothing, so no rollout starts. undo would switch to an older template.",
  },
];
