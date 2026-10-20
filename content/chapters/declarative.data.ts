import type { ChapterData } from "../types";
import { quiz } from "./declarative.quiz";

const brokenWeb = `apiVersion: apps/v1
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
        app: website
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
`;

export const data: ChapterData = {
  objectives: [
    "Describe the state you want in a manifest file and use kubectl apply to make the cluster match it.",
    "Write YAML that parses the way you expect: spaces for indentation, maps, lists, strings, and numbers.",
    "Read apply output and tell created, configured, and unchanged apart.",
    "Change a running app by editing its file and applying again, and remove it with kubectl delete -f.",
    "Choose between imperative commands and applied files, and avoid drift between the two.",
  ],
  quiz,
  manifests: [
    {
      id: "namespace-shop",
      title: "shop.yaml (document 1)",
      yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: shop`,
      notes: [
        { line: 1, text: "Namespaces are in the core API group, so the version is plain v1 with no group prefix." },
        { line: 2, text: "kind and apiVersion together pick the schema. Both are required in every document." },
        { line: 3, text: "metadata is a map. Its keys are indented under it with spaces, never tabs." },
        { line: 4, text: "A Namespace has no spec. The name is all it needs." },
      ],
    },
    {
      id: "deployment-shop",
      title: "shop.yaml (document 2)",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
  labels:
    app: web
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
            - containerPort: 80`,
      notes: [
        { line: 1, text: "Deployments live in the apps group. apiVersion: v1 with kind: Deployment is rejected because v1 has no Deployment kind." },
        { line: 3, text: "A key followed by a colon and nothing else starts a nested map. Everything indented under it belongs to it." },
        { line: 5, text: "The namespace is part of the file, so kubectl apply -f puts it in shop without a -n flag. The Namespace document must come first." },
        { line: 6, text: "Labels are a map of string keys to string values. A value like 1.0 or true must be quoted to stay a string." },
        { line: 9, text: "An unquoted 2 is a number, which is what replicas needs. Quoting it as \"2\" makes a string and the API server rejects it." },
        { line: 10, text: "The selector cannot be changed after the Deployment is created. To change it you delete and recreate the Deployment." },
        { line: 13, text: "The Pod template. Editing anything under it and applying starts a rollout." },
        { line: 16, text: "Must include every label in the selector above, or the API server rejects the whole file." },
        { line: 18, text: "containers is a list. Each item starts with a dash at the same indentation." },
        { line: 19, text: "The dash starts one list item, and that item is a map. Its other keys (image, ports) line up with name, not with the dash." },
        { line: 20, text: "Change this tag in the file and apply again to roll out a new version." },
        { line: 22, text: "A list inside a list item. containerPort is a number; \"80\" in quotes would be rejected." },
      ],
    },
  ],
  labs: [
    {
      id: "declarative-fix",
      title: "Fix and apply a manifest",
      difficulty: "intermediate",
      scenario:
        "A teammate left web.yaml, a Deployment manifest for the web app. Nobody has applied it yet, and it has a mistake. Get it running, then scale it through the file.",
      instructions: [
        "Run ls and cat web.yaml to read the file.",
        "Run kubectl apply -f web.yaml and read the error.",
        "Fix the mistake in web.yaml in the Files panel, then apply again.",
        "Change replicas to 3 in the file and apply once more. The output should say configured.",
        "Run kubectl get pods until all three Pods are ready.",
      ],
      fixture: { files: { "web.yaml": brokenWeb } },
      objectives: [
        {
          id: "desired",
          description: "The web Deployment asks for 3 replicas.",
          validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 3 },
        },
        {
          id: "ready",
          description: "3 Pods owned by web are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 3 },
        },
      ],
      hints: [
        "The error names the field that failed: spec.selector.",
        "Compare spec.selector.matchLabels with spec.template.metadata.labels. Every selector label must appear on the template.",
        "Change app: website to app: web in the template labels. Leave the selector alone.",
        "Scaling with kubectl scale works too, but the file would still say 2 and the next apply would set it back. Edit the file.",
        "New Pods start as ContainerCreating. Run kubectl get pods again to see them become ready.",
      ],
      solutionFiles: { "web.yaml": brokenWeb.replace("app: website", "app: web").replace("replicas: 2", "replicas: 3") },
      solution: ["kubectl apply -f web.yaml", "kubectl get pods"],
    },
  ],
  diagrams: [
    {
      id: "declarative-apply-loop",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "file",
            label: "web.yaml",
            sub: "the state you want",
            detail: "A manifest file you write and keep in git. It describes objects, not steps.",
          },
          {
            id: "apply",
            label: "kubectl apply -f web.yaml",
            sub: "sends each document",
            detail: "kubectl reads every document in the file and sends it to the API server. It does not decide what to change; the server compares.",
          },
          {
            id: "compare",
            label: "API server compares",
            sub: "file vs live object",
            detail: "The API server validates the object, then checks whether an object of that kind and name already exists and how it differs from the file.",
          },
          {
            id: "results",
            label: "Result per object",
            detail: "kubectl prints one line per object in the file, such as deployment.apps/web configured.",
            children: [
              { id: "created", label: "created", sub: "did not exist", detail: "No object with this kind, name, and namespace existed, so it was created from the file." },
              { id: "configured", label: "configured", sub: "file differs", detail: "The object existed and the file changed some fields. Only those fields were updated." },
              { id: "unchanged", label: "unchanged", sub: "already matches", detail: "The object already matched the file. Nothing was written, which is why apply is safe to run again." },
            ],
          },
        ],
      },
      steps: [
        { title: "Write the file", text: "You describe the Deployment you want in web.yaml.", highlight: ["file"] },
        { title: "Apply it", text: "kubectl apply sends each document in the file to the API server.", highlight: ["apply"] },
        { title: "Compare", text: "The API server validates the object and compares it with what it already stores.", highlight: ["compare"] },
        { title: "First run", text: "The Deployment does not exist yet, so the result is created.", highlight: ["created"] },
        { title: "After an edit", text: "You change replicas in the file and apply again. Only that field differs, so the result is configured.", highlight: ["configured"] },
        { title: "No edit", text: "Applying the same file again changes nothing and prints unchanged.", highlight: ["unchanged"] },
      ],
    },
    {
      id: "declarative-edit-reapply",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-0",
            label: "Applied",
            sub: "file and cluster agree",
            detail: "web.yaml says replicas: 2 and the Deployment runs 2 Pods.",
            children: [
              { id: "s0-file", label: "web.yaml", sub: "replicas: 2", detail: "The file as last applied." },
              { id: "s0-cluster", label: "Deployment web", sub: "2/2 ready", detail: "The live object matches the file." },
            ],
          },
          {
            id: "stage-1",
            label: "Edit the file",
            sub: "nothing happens yet",
            detail: "Saving the file does not touch the cluster. Only apply sends it.",
            children: [
              { id: "s1-file", label: "web.yaml", sub: "replicas: 3", detail: "Edited and saved, ideally reviewed in a pull request." },
              { id: "s1-cluster", label: "Deployment web", sub: "2/2 ready", detail: "Still the old desired state." },
            ],
          },
          {
            id: "stage-2",
            label: "kubectl apply -f web.yaml",
            sub: "deployment.apps/web configured",
            detail: "The API server finds one changed field, spec.replicas, and updates it. The ReplicaSet starts a third Pod.",
            children: [
              { id: "s2-file", label: "web.yaml", sub: "replicas: 3", detail: "Unchanged since the edit." },
              { id: "s2-cluster", label: "Deployment web", sub: "2/3 ready", detail: "Desired is 3. The new Pod is still starting." },
            ],
          },
          {
            id: "stage-3",
            label: "Apply again",
            sub: "deployment.apps/web unchanged",
            detail: "The file and the live object already agree, so apply writes nothing.",
            children: [
              { id: "s3-file", label: "web.yaml", sub: "replicas: 3", detail: "Still the source of truth." },
              { id: "s3-cluster", label: "Deployment web", sub: "3/3 ready", detail: "Observed state has caught up with the file." },
            ],
          },
        ],
      },
      steps: [
        { title: "In sync", text: "The file says 2 replicas and the cluster runs 2 Pods.", highlight: ["stage-0", "s0-file", "s0-cluster"] },
        { title: "Edit", text: "You change replicas to 3 and save. The cluster does not know yet.", highlight: ["stage-1", "s1-file"] },
        { title: "Apply", text: "apply reports configured. The Deployment now wants 3 Pods and a third one starts.", highlight: ["stage-2", "s2-cluster"] },
        { title: "Apply again", text: "Nothing differs, so apply reports unchanged. Running it twice is harmless.", highlight: ["stage-3", "s3-file", "s3-cluster"] },
      ],
    },
  ],
};
