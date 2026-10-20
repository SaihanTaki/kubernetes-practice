import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "labels-purpose",
    topic: "Labels",
    difficulty: "beginner",
    question: "What are labels mainly used for?",
    options: [
      { id: "a", text: "Identifying and selecting groups of objects" },
      { id: "b", text: "Storing build logs for a Pod" },
      { id: "c", text: "Setting environment variables in containers" },
      { id: "d", text: "Choosing the container runtime" },
    ],
    correctOptionId: "a",
    explanation:
      "Labels are short key/value pairs that selectors query. kubectl -l, ReplicaSets, Deployments, and Services all find their objects through labels. Environment variables live in the container spec.",
  },
  {
    id: "labels-name-length",
    topic: "Labels",
    difficulty: "beginner",
    question: "What is the maximum length of the name part of a label key (the part after any prefix and slash)?",
    options: [
      { id: "a", text: "16 characters" },
      { id: "b", text: "63 characters" },
      { id: "c", text: "253 characters" },
      { id: "d", text: "No limit" },
    ],
    correctOptionId: "b",
    explanation:
      "The name part is at most 63 characters and must start and end with a letter or digit. 253 is the limit for the optional DNS subdomain prefix, not the name.",
  },
  {
    id: "labels-valid-key",
    topic: "Labels",
    difficulty: "intermediate",
    question: "Which of these is a valid label key?",
    options: [
      { id: "a", text: "-tier" },
      { id: "b", text: "team name" },
      { id: "c", text: "example.com/team" },
      { id: "d", text: "example.com/team/backend" },
    ],
    correctOptionId: "c",
    explanation:
      "A key is an optional DNS subdomain prefix, one slash, and a name. -tier starts with a dash, team name contains a space, and a key cannot have two slashes.",
  },
  {
    id: "labels-valid-value",
    topic: "Labels",
    difficulty: "intermediate",
    question: "Which label value is rejected by the API server?",
    options: [
      { id: "a", text: "v1.2.3" },
      { id: "b", text: "an empty string" },
      { id: "c", text: "prod_eu-1" },
      { id: "d", text: "fix login bug" },
    ],
    correctOptionId: "d",
    explanation:
      "Label values may be empty, or up to 63 characters of letters, digits, dashes, underscores, and dots, starting and ending with a letter or digit. Spaces are not allowed. Free text like this belongs in an annotation.",
  },
  {
    id: "labels-reserved-prefix",
    topic: "Labels",
    difficulty: "intermediate",
    question: "Which key prefixes are reserved for Kubernetes core components?",
    options: [
      { id: "a", text: "kubernetes.io/ and k8s.io/" },
      { id: "b", text: "app/ and tier/" },
      { id: "c", text: "Any prefix ending in .com/" },
      { id: "d", text: "Keys with no prefix" },
    ],
    correctOptionId: "a",
    explanation:
      "kubernetes.io/ and k8s.io/ are reserved. Keys without a prefix are treated as private to the user, and your own domain is the usual choice for a custom prefix.",
  },
  {
    id: "labels-recommended",
    topic: "Labels",
    difficulty: "beginner",
    question: "Which label is one of the recommended app.kubernetes.io labels?",
    options: [
      { id: "a", text: "app.kubernetes.io/owner" },
      { id: "b", text: "app.kubernetes.io/team" },
      { id: "c", text: "app.kubernetes.io/region" },
      { id: "d", text: "app.kubernetes.io/part-of" },
    ],
    correctOptionId: "d",
    explanation:
      "The recommended set is name, instance, version, component, part-of, and managed-by. part-of names the larger application, such as shop. The other three are not part of the set.",
  },
  {
    id: "labels-not-equal",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "Which Pods does kubectl get pods -l tier!=frontend return?",
    options: [
      { id: "a", text: "Only Pods that have a tier label with a value other than frontend" },
      { id: "b", text: "Pods whose tier is not frontend, including Pods with no tier label at all" },
      { id: "c", text: "Only Pods with no tier label" },
      { id: "d", text: "No Pods, because != is not a valid selector operator" },
    ],
    correctOptionId: "b",
    explanation:
      "!= matches any object whose tier is not frontend, and an object without the key qualifies. Add a plain tier requirement (-l tier,tier!=frontend) if the key must exist.",
  },
  {
    id: "labels-comma",
    topic: "Selectors",
    difficulty: "beginner",
    question: "What does the comma mean in -l env=prod,tier=backend?",
    options: [
      { id: "a", text: "OR: either label matches" },
      { id: "b", text: "It separates two namespaces" },
      { id: "c", text: "AND: both labels must match" },
      { id: "d", text: "The second label is optional" },
    ],
    correctOptionId: "c",
    explanation:
      "Selector requirements are always joined by AND. There is no OR between keys; for several values of one key, use a set-based in (a,b) requirement.",
  },
  {
    id: "labels-in",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "Which selector lists Pods whose env is staging or qa?",
    options: [
      { id: "a", text: "-l 'env in (staging,qa)'" },
      { id: "b", text: "-l env=staging,env=qa" },
      { id: "c", text: "-l env=staging|qa" },
      { id: "d", text: "-l env" },
    ],
    correctOptionId: "a",
    explanation:
      "in matches any value in the set. env=staging,env=qa needs both at once, which no Pod can satisfy. | is not selector syntax, and a bare env matches every Pod that has the key.",
  },
  {
    id: "labels-exists",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "What does kubectl get pods -l '!canary' return?",
    options: [
      { id: "a", text: "Pods whose canary label is false" },
      { id: "b", text: "Pods that have a canary label" },
      { id: "c", text: "An error, because a selector needs a value" },
      { id: "d", text: "Pods that have no canary label" },
    ],
    correctOptionId: "d",
    explanation:
      "A bare key is an existence check, and ! negates it. The value is ignored. The quotes stop the shell from treating ! as history expansion.",
  },
  {
    id: "labels-notin-missing",
    topic: "Selectors",
    difficulty: "advanced",
    question:
      "Pods: a (tier=frontend), b (tier=backend), c (no tier label). Which does -l 'tier notin (frontend)' select?",
    options: [
      { id: "a", text: "b only" },
      { id: "b", text: "b and c" },
      { id: "c", text: "a only" },
      { id: "d", text: "None of them" },
    ],
    correctOptionId: "b",
    explanation:
      "notin selects objects whose value is outside the set and also objects without the key. So c is included along with b.",
  },
  {
    id: "labels-service-selector",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "Which kind of selector does a Service's spec.selector support?",
    options: [
      { id: "a", text: "matchExpressions only" },
      { id: "b", text: "Both matchLabels and matchExpressions" },
      { id: "c", text: "A plain map of labels, equality only" },
      { id: "d", text: "A regular expression on Pod names" },
    ],
    correctOptionId: "c",
    explanation:
      "A Service selector is a plain key/value map, and every pair must match. ReplicaSets, Deployments, Jobs, and DaemonSets use the richer form with matchLabels and matchExpressions.",
  },
  {
    id: "labels-deploy-immutable",
    topic: "Selectors",
    difficulty: "intermediate",
    question: "You change spec.selector of an existing apps/v1 Deployment and apply it. What happens?",
    options: [
      { id: "a", text: "The API server rejects the change because the selector is immutable" },
      { id: "b", text: "The Deployment adopts the newly matching Pods" },
      { id: "c", text: "A rollout starts with a new ReplicaSet" },
      { id: "d", text: "The old Pods are relabeled to match" },
    ],
    correctOptionId: "a",
    explanation:
      "In apps/v1 a Deployment's selector cannot change after creation. To use a different selector, create a new Deployment and delete the old one.",
  },
  {
    id: "labels-orphan",
    topic: "Selectors",
    difficulty: "intermediate",
    question:
      "A ReplicaSet with replicas: 3 selects app=api. You run kubectl label pod api-87lt9 app=debug --overwrite. What happens?",
    options: [
      { id: "a", text: "The ReplicaSet changes the label back to app=api" },
      { id: "b", text: "The Pod is deleted and replaced" },
      { id: "c", text: "The ReplicaSet scales down to 2" },
      { id: "d", text: "The Pod keeps running on its own and the ReplicaSet creates a replacement" },
    ],
    correctOptionId: "d",
    explanation:
      "The Pod no longer matches, so the ReplicaSet releases it and counts only 2 Pods. It creates a third. The relabeled Pod keeps running with no owner until you delete it.",
  },
  {
    id: "labels-readopt",
    topic: "Selectors",
    difficulty: "advanced",
    question:
      "After debugging, you set the orphaned Pod's label back to app=api. The ReplicaSet already has 3 Pods. What happens?",
    options: [
      { id: "a", text: "Nothing: an orphaned Pod is never adopted again" },
      { id: "b", text: "The ReplicaSet adopts it, sees 4 Pods, and deletes one" },
      { id: "c", text: "The ReplicaSet scales to 4" },
      { id: "d", text: "The API server rejects the label change" },
    ],
    correctOptionId: "b",
    explanation:
      "A ReplicaSet adopts any ownerless Pod that matches its selector. It then has one Pod too many and removes one to get back to replicas.",
  },
  {
    id: "labels-annotation-select",
    topic: "Annotations",
    difficulty: "beginner",
    question: "Can a selector match objects by their annotations?",
    options: [
      { id: "a", text: "Yes, with -l" },
      { id: "b", text: "Only in Services" },
      { id: "c", text: "No, selectors only look at labels" },
      { id: "d", text: "Only with matchExpressions" },
    ],
    correctOptionId: "c",
    explanation:
      "Annotations are not indexed for selection. They exist for people and tools to read. If you need to select by a value, make it a label.",
  },
  {
    id: "labels-annotation-use",
    topic: "Annotations",
    difficulty: "beginner",
    question: "Which value belongs in an annotation rather than a label?",
    options: [
      { id: "a", text: "env=prod, used to list production Pods" },
      { id: "b", text: "A sentence explaining why the last rollout happened" },
      { id: "c", text: "app=web, used by a Service to find Pods" },
      { id: "d", text: "tier=backend, used by a ReplicaSet selector" },
    ],
    correctOptionId: "b",
    explanation:
      "A free-text sentence has spaces and is never selected on, so it is an annotation, such as kubernetes.io/change-cause. The others are used by selectors and must be labels.",
  },
  {
    id: "labels-overwrite",
    topic: "kubectl label",
    difficulty: "intermediate",
    question: "A Pod already has env=staging. What does kubectl label pod web env=prod do?",
    options: [
      { id: "a", text: "Adds a second env label" },
      { id: "b", text: "Replaces the value with prod" },
      { id: "c", text: "Removes the env label" },
      { id: "d", text: "Fails, because changing an existing value needs --overwrite" },
    ],
    correctOptionId: "d",
    explanation:
      "kubectl label refuses to change an existing value unless you pass --overwrite. A key appears at most once on an object, so a second env label is impossible.",
  },
  {
    id: "labels-remove",
    topic: "kubectl label",
    difficulty: "beginner",
    question: "How do you remove the env label from the Pod web?",
    options: [
      { id: "a", text: "kubectl label pod web env-" },
      { id: "b", text: "kubectl label pod web env=" },
      { id: "c", text: "kubectl label pod web --delete env" },
      { id: "d", text: "kubectl unlabel pod web env" },
    ],
    correctOptionId: "a",
    explanation:
      "A key followed by a dash removes it. env= would set the label to an empty value, which is still a label. kubectl annotate removes annotations the same way.",
  },
  {
    id: "labels-yaml-template",
    topic: "Labels YAML",
    difficulty: "beginner",
    question: "In a Deployment manifest, which labels are copied onto the Pods it creates?",
    options: [
      { id: "a", text: "metadata.labels" },
      { id: "b", text: "spec.template.metadata.labels" },
      { id: "c", text: "spec.selector.matchLabels" },
      { id: "d", text: "metadata.annotations" },
    ],
    correctOptionId: "b",
    explanation:
      "Pods are built from the template, so they get the template's labels. metadata.labels belong to the Deployment object, and the selector only queries labels.",
  },
  {
    id: "labels-yaml-quote",
    topic: "Labels YAML",
    difficulty: "intermediate",
    question: "Why is the version written as app.kubernetes.io/version: \"1.1\" with quotes?",
    options: [
      { id: "a", text: "Quotes make the label immutable" },
      { id: "b", text: "Keys with a slash need quoted values" },
      { id: "c", text: "Without quotes YAML reads 1.1 as a number, and label values must be strings" },
      { id: "d", text: "Quotes are needed for kubectl to show it in --show-labels" },
    ],
    correctOptionId: "c",
    explanation:
      "Unquoted 1.1 is a YAML float, and labels are a map of strings, so the manifest is rejected. The same applies to true, false, and plain numbers.",
  },
  {
    id: "labels-yaml-matchexpressions",
    topic: "Selector YAML",
    difficulty: "advanced",
    question:
      "A selector has matchLabels {app: web} and matchExpressions [{key: env, operator: In, values: [prod, staging]}]. Which Pod does it select?",
    options: [
      { id: "a", text: "app=api, env=prod" },
      { id: "b", text: "app=web, env=dev" },
      { id: "c", text: "app=web, with no env label" },
      { id: "d", text: "app=web, env=staging" },
    ],
    correctOptionId: "d",
    explanation:
      "matchLabels and every matchExpressions entry are ANDed. The Pod needs app=web and an env value in the set. In requires the key to be present.",
  },
  {
    id: "labels-yaml-exists",
    topic: "Selector YAML",
    difficulty: "advanced",
    question: "Which matchExpressions entry is valid?",
    options: [
      { id: "a", text: "{key: canary, operator: Exists, values: [\"true\"]}" },
      { id: "b", text: "{key: canary, operator: In, values: []}" },
      { id: "c", text: "{key: canary, operator: DoesNotExist}" },
      { id: "d", text: "{key: canary, operator: Equals, values: [\"true\"]}" },
    ],
    correctOptionId: "c",
    explanation:
      "Exists and DoesNotExist must have no values. In and NotIn need at least one value. The operators are In, NotIn, Exists, and DoesNotExist; there is no Equals.",
  },
  {
    id: "labels-yaml-selector-version",
    topic: "Labels YAML",
    difficulty: "intermediate",
    question: "Why should a Deployment's selector not include app.kubernetes.io/version?",
    options: [
      { id: "a", text: "The version changes every release, but the selector cannot change" },
      { id: "b", text: "Only Services may select on version" },
      { id: "c", text: "The version label is set automatically by Kubernetes" },
      { id: "d", text: "Selectors cannot use keys with a prefix" },
    ],
    correctOptionId: "a",
    explanation:
      "The selector is immutable and must match the template. A new version would need a new selector, which the API server rejects. Keep version as a template label only.",
  },
];
