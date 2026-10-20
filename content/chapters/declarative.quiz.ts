import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "declarative-model",
    topic: "Declarative model",
    difficulty: "beginner",
    question: "What do you describe in a manifest file when working declaratively?",
    options: [
      { id: "a", text: "The kubectl commands to run, in order" },
      { id: "b", text: "The objects that should exist and their fields" },
      { id: "c", text: "The shell script that starts the containers" },
      { id: "d", text: "Only the changes since the last deploy" },
    ],
    correctOptionId: "b",
    explanation:
      "A manifest describes the desired objects in full. kubectl apply and the API server work out what has to change to reach that state.",
  },
  {
    id: "declarative-unchanged",
    topic: "kubectl apply",
    difficulty: "beginner",
    question: "You run kubectl apply -f web.yaml twice in a row without editing the file. What does the second run print?",
    options: [
      { id: "a", text: "deployment.apps/web created" },
      { id: "b", text: "Error from server (AlreadyExists)" },
      { id: "c", text: "deployment.apps/web unchanged" },
      { id: "d", text: "deployment.apps/web configured" },
    ],
    correctOptionId: "c",
    explanation:
      "The live object already matches the file, so nothing is written and apply reports unchanged. That is what makes apply idempotent.",
  },
  {
    id: "declarative-configured",
    topic: "kubectl apply",
    difficulty: "beginner",
    question: "You change replicas from 2 to 3 in web.yaml and apply it. The Deployment already exists. What does apply print?",
    options: [
      { id: "a", text: "deployment.apps/web configured" },
      { id: "b", text: "deployment.apps/web created" },
      { id: "c", text: "deployment.apps/web unchanged" },
      { id: "d", text: "deployment.apps/web scaled" },
    ],
    correctOptionId: "a",
    explanation:
      "The object existed and a field differs from the file, so it is updated and reported as configured. scaled is what kubectl scale prints, not apply.",
  },
  {
    id: "declarative-tabs",
    topic: "YAML syntax",
    difficulty: "beginner",
    question: "What should you use to indent a Kubernetes manifest?",
    options: [
      { id: "a", text: "Tabs, one per level" },
      { id: "b", text: "Any mix of tabs and spaces, as long as it looks aligned" },
      { id: "c", text: "Nothing, YAML ignores indentation" },
      { id: "d", text: "Spaces, usually two per level" },
    ],
    correctOptionId: "d",
    explanation:
      "YAML forbids tabs for indentation and uses indentation to define nesting. Spaces are required; two per level is the common convention.",
  },
  {
    id: "declarative-list-item",
    topic: "YAML syntax",
    difficulty: "beginner",
    question: "In a manifest, what does a line starting with - (dash and space) mean?",
    options: [
      { id: "a", text: "The line is a comment" },
      { id: "b", text: "The field is optional" },
      { id: "c", text: "It starts a new item in a list" },
      { id: "d", text: "The value is negative" },
    ],
    correctOptionId: "c",
    explanation:
      "A dash starts one list item, as in the containers list. Comments start with #, and YAML has no syntax for optional fields.",
  },
  {
    id: "declarative-quoted-number",
    topic: "YAML values",
    difficulty: "intermediate",
    question: "A Deployment manifest has replicas: \"3\" with quotes. What happens when you apply it?",
    options: [
      { id: "a", text: "It is rejected because replicas must be a number, not a string" },
      { id: "b", text: "It works the same as replicas: 3" },
      { id: "c", text: "The Deployment is created with 0 replicas" },
      { id: "d", text: "kubectl removes the quotes before sending it" },
    ],
    correctOptionId: "a",
    explanation:
      "Quotes make the value a string. replicas is an integer field, so the API server rejects the object instead of converting it.",
  },
  {
    id: "declarative-label-string",
    topic: "YAML values",
    difficulty: "intermediate",
    question: "You want a label version with the value 1.10. Which line is correct?",
    options: [
      { id: "a", text: "version: 1.10" },
      { id: "b", text: "- version: 1.10" },
      { id: "c", text: "version = 1.10" },
      { id: "d", text: "version: \"1.10\"" },
    ],
    correctOptionId: "d",
    explanation:
      "Unquoted, 1.10 is parsed as the number 1.1, and label values must be strings, so the object is rejected. Quoting keeps it the string 1.10.",
  },
  {
    id: "declarative-multidoc",
    topic: "YAML multi-document files",
    difficulty: "beginner",
    question: "How do you put a Namespace and a Deployment in the same file?",
    options: [
      { id: "a", text: "Wrap both in a list under a top-level items: key with kind: Bundle" },
      { id: "b", text: "Separate the two documents with a line containing only ---" },
      { id: "c", text: "Put them one after another with a blank line between" },
      { id: "d", text: "You cannot; each object needs its own file" },
    ],
    correctOptionId: "b",
    explanation:
      "--- separates YAML documents, and apply processes each one. Without it the second object's keys would collide with the first's in one document.",
  },
  {
    id: "declarative-multidoc-order",
    topic: "YAML multi-document files",
    difficulty: "intermediate",
    question: "A file holds a Deployment in namespace shop, then the shop Namespace. The namespace does not exist yet. Which order is safer?",
    options: [
      { id: "a", text: "Put the Namespace document first" },
      { id: "b", text: "Keep the Deployment first; apply sorts documents automatically" },
      { id: "c", text: "Order does not matter because apply is idempotent" },
      { id: "d", text: "Put the Deployment first so the Namespace can adopt it" },
    ],
    correctOptionId: "a",
    explanation:
      "apply sends documents in file order. If the Deployment comes first, the API server rejects it because namespace shop does not exist yet.",
  },
  {
    id: "declarative-indent-under",
    topic: "YAML syntax",
    difficulty: "intermediate",
    question: "In a containers list item, how must image line up?",
    options: [
      { id: "a", text: "With the dash in front of name" },
      { id: "b", text: "One level deeper than name" },
      { id: "c", text: "In the same column as name, the first key after the dash" },
      { id: "d", text: "At the start of the line" },
    ],
    correctOptionId: "c",
    explanation:
      "name and image are keys of the same map, the list item. Keys of one map must start in the same column, which is the column after the dash and space.",
  },
  {
    id: "declarative-api-version",
    topic: "Manifest YAML",
    difficulty: "beginner",
    question: "Which apiVersion goes with kind: Deployment?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "deployments/v1" },
      { id: "d", text: "core/v1" },
    ],
    correctOptionId: "b",
    explanation:
      "Deployments, ReplicaSets, and other workload controllers are in the apps group. v1 alone is the core group, used by Pods and Namespaces.",
  },
  {
    id: "declarative-selector",
    topic: "Manifest YAML",
    difficulty: "intermediate",
    question: "apply rejects a Deployment because the selector does not match the template labels. What is the usual fix?",
    options: [
      { id: "a", text: "Delete spec.selector; Kubernetes fills it in" },
      { id: "b", text: "Apply it twice so the second run succeeds" },
      { id: "c", text: "Add --force to kubectl apply" },
      { id: "d", text: "Make spec.template.metadata.labels include every label in spec.selector.matchLabels" },
    ],
    correctOptionId: "d",
    explanation:
      "The Deployment can only own Pods its selector matches, so its own template must carry those labels. apps/v1 requires the selector; it is not filled in for you.",
  },
  {
    id: "declarative-all-or-nothing",
    topic: "kubectl apply",
    difficulty: "intermediate",
    question: "In the simulator, a file has two valid documents and one invalid one. What does kubectl apply -f do?",
    options: [
      { id: "a", text: "Rejects the file and changes nothing" },
      { id: "b", text: "Applies the two valid ones and skips the other silently" },
      { id: "c", text: "Applies the invalid one with default values" },
      { id: "d", text: "Deletes the objects in the valid documents" },
    ],
    correctOptionId: "a",
    explanation:
      "The simulator validates every document first and applies none if one fails. A real cluster may apply the valid ones and report errors for the rest, so always read the full output.",
  },
  {
    id: "declarative-image-change",
    topic: "kubectl apply",
    difficulty: "intermediate",
    question: "You change image: nginx:1.27 to nginx:1.28 in a Deployment file and apply it. What happens?",
    options: [
      { id: "a", text: "Nothing until you delete the Pods by hand" },
      { id: "b", text: "The Deployment starts a rollout with a new ReplicaSet" },
      { id: "c", text: "The existing containers are patched in place" },
      { id: "d", text: "apply fails because the image field is immutable" },
    ],
    correctOptionId: "b",
    explanation:
      "The image is part of the Pod template. Changing the template makes the Deployment create a new ReplicaSet and replace the old Pods.",
  },
  {
    id: "declarative-delete-f",
    topic: "kubectl delete",
    difficulty: "beginner",
    question: "What does kubectl delete -f shop.yaml do?",
    options: [
      { id: "a", text: "Deletes the file shop.yaml" },
      { id: "b", text: "Deletes every object in the namespace shop" },
      { id: "c", text: "Reverts the objects to their previous version" },
      { id: "d", text: "Deletes the objects described in the file and leaves the file in place" },
    ],
    correctOptionId: "d",
    explanation:
      "It reads the kind, name, and namespace of each document and deletes those objects. The file is untouched, so you can apply it again later.",
  },
  {
    id: "declarative-drift",
    topic: "Drift",
    difficulty: "intermediate",
    question: "web.yaml says replicas: 3. During an incident someone ran kubectl scale deployment web --replicas=6. What does the next kubectl apply -f web.yaml do?",
    options: [
      { id: "a", text: "Keeps 6, because the live value is newer" },
      { id: "b", text: "Fails with a conflict error" },
      { id: "c", text: "Sets replicas back to 3" },
      { id: "d", text: "Changes the file to say 6" },
    ],
    correctOptionId: "c",
    explanation:
      "apply makes the object match the file, and the file says 3. Imperative changes to a file-managed object are lost on the next apply unless copied into the file.",
  },
  {
    id: "declarative-diff",
    topic: "Reviewing changes",
    difficulty: "intermediate",
    question: "On a real cluster, which command shows what apply would change without changing anything?",
    options: [
      { id: "a", text: "kubectl get -f web.yaml" },
      { id: "b", text: "kubectl diff -f web.yaml" },
      { id: "c", text: "kubectl describe -f web.yaml" },
      { id: "d", text: "kubectl apply -f web.yaml --force" },
    ],
    correctOptionId: "b",
    explanation:
      "kubectl diff compares the live objects with the file and prints a diff. The simulator does not support it; --dry-run=client is the closest it has.",
  },
  {
    id: "declarative-git",
    topic: "Reviewing changes",
    difficulty: "beginner",
    question: "Why keep manifests in a git repository?",
    options: [
      { id: "a", text: "Changes get history and review, and the same files can rebuild the cluster state" },
      { id: "b", text: "kubectl apply only reads files from git" },
      { id: "c", text: "The API server pulls from git on its own" },
      { id: "d", text: "Git converts YAML to JSON for the API server" },
    ],
    correctOptionId: "a",
    explanation:
      "Git records who changed what and why, lets changes be reviewed in pull requests, and keeps every version so you can revert and apply again.",
  },
  {
    id: "declarative-when-imperative",
    topic: "Declarative vs imperative",
    difficulty: "beginner",
    question: "Which job suits an imperative command better than an applied file?",
    options: [
      { id: "a", text: "The production Deployment that the whole team changes" },
      { id: "b", text: "A setup you need to recreate in a second cluster" },
      { id: "c", text: "Quickly starting a throwaway Pod to test something" },
      { id: "d", text: "A change that must be reviewed before it reaches the cluster" },
    ],
    correctOptionId: "c",
    explanation:
      "One-off, short-lived work is faster with kubectl run or create. Anything shared, repeatable, or reviewed belongs in a file.",
  },
  {
    id: "declarative-create-twice",
    topic: "Declarative vs imperative",
    difficulty: "intermediate",
    question: "Why can a deploy script safely run kubectl apply -f every time, but not kubectl create deployment web?",
    options: [
      { id: "a", text: "create needs admin rights and apply does not" },
      { id: "b", text: "apply runs asynchronously and create does not" },
      { id: "c", text: "create only works in the default namespace" },
      { id: "d", text: "apply creates, updates, or leaves the object alone, while create fails if it already exists" },
    ],
    correctOptionId: "d",
    explanation:
      "apply compares the file with the live object and does only what is needed. create is a single action and returns AlreadyExists on the second run.",
  },
  {
    id: "declarative-wrong-indent",
    topic: "YAML syntax",
    difficulty: "advanced",
    question:
      "In a Deployment file, replicas: 3 is indented two spaces less than intended, so it lines up with spec instead of sitting under it. What is the result?",
    options: [
      { id: "a", text: "replicas becomes a top-level key and is not part of spec" },
      { id: "b", text: "YAML fixes the indentation automatically" },
      { id: "c", text: "The Deployment gets 3 replicas as intended" },
      { id: "d", text: "The file is treated as two documents" },
    ],
    correctOptionId: "a",
    explanation:
      "Indentation decides nesting, so the line parses as a top-level field and spec.replicas is missing. Current kubectl rejects the unknown top-level field; with validation turned off it is dropped and replicas defaults to 1.",
  },
  {
    id: "declarative-dry-run",
    topic: "kubectl apply",
    difficulty: "advanced",
    question: "What does kubectl apply -f web.yaml --dry-run=client -o yaml do?",
    options: [
      { id: "a", text: "Applies the file and prints the result as YAML" },
      { id: "b", text: "Prints the objects as they would be sent, without changing the cluster" },
      { id: "c", text: "Writes the live objects back into web.yaml" },
      { id: "d", text: "Validates the file against the cluster and applies it if valid" },
    ],
    correctOptionId: "b",
    explanation:
      "--dry-run=client stops kubectl from sending a change, and -o yaml prints what it would have sent. Nothing is created or updated.",
  },
];
