import type { ChapterData } from "../types";
import { quiz } from "./imperative.quiz";

export const data: ChapterData = {
  objectives: [
    "Explain the difference between imperative commands and declarative configuration.",
    "Create Pods, Deployments, and Namespaces with kubectl run and kubectl create, and know which labels each sets.",
    "Scale a Deployment and change its image with kubectl set image.",
    "Generate a manifest from a command with --dry-run=client -o yaml and save it to a file.",
    "Judge when an imperative command is the right tool and when it causes drift.",
  ],
  quiz,
  manifests: [
    {
      id: "generated-deployment",
      title: "web.yaml (from --dry-run=client -o yaml)",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: default
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
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%`,
      notes: [
        { line: 1, text: "kubectl knows Deployments live in the apps/v1 API group, so you never typed this." },
        { line: 4, text: "From the name argument: kubectl create deployment web." },
        { line: 5, text: "The namespace the command would have used. Without -n it is default. Delete this line if the file should work in any namespace." },
        { line: 7, text: "kubectl create deployment always adds app=<name>. kubectl run would add run=<name> instead." },
        { line: 9, text: "From --replicas=2. Without the flag it is 1." },
        { line: 12, text: "The selector reuses the same app=web label, so it matches the template below and the manifest is valid." },
        { line: 16, text: "Every Pod gets app=web. This is what kubectl get pods -l app=web filters on." },
        { line: 19, text: "The container name comes from the image name without the registry or tag. kubectl set image needs this name." },
        { line: 20, text: "From --image=nginx:1.27. Change it here and apply the file to start a rollout." },
        { line: 21, text: "The default update strategy, written out. The command has no flag for it, so edit the file if you want something else." },
        { line: 24, text: "25% is the default maxSurge: up to a quarter more Pods than replicas during a rollout, rounded up." },
        { line: 25, text: "25% is the default maxUnavailable: up to a quarter of replicas may be missing during a rollout, rounded down." },
      ],
    },
  ],
  labs: [
    {
      id: "imperative-basics",
      title: "Build a small app with commands",
      difficulty: "beginner",
      scenario:
        "The cluster is empty. You need a throwaway Pod for debugging, an api Deployment with three replicas, a newer nginx image on it, and a copy of its manifest for the team to review.",
      instructions: [
        "Run a Pod named debug from the busybox:1.36 image.",
        "Create a Deployment named api from nginx:1.27 with 3 replicas.",
        "Change the api image to nginx:1.28 with kubectl set image. The container is named nginx.",
        "Save a manifest for api (nginx:1.28, 3 replicas) to api.yaml with --dry-run=client -o yaml and a > redirect. Check it with cat api.yaml.",
        "Keep checking kubectl get pods until everything is ready.",
      ],
      fixture: {},
      objectives: [
        {
          id: "debug-pod",
          description: "A Pod named debug exists.",
          validator: { kind: "resource-exists", resourceType: "Pod", resourceName: "debug" },
        },
        {
          id: "api-replicas",
          description: "The api Deployment asks for 3 replicas.",
          validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "api", expectedValue: 3 },
        },
        {
          id: "api-ready",
          description: "3 Pods owned by api are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: 3 },
        },
      ],
      hints: [
        "kubectl run <name> --image=<image> creates a single Pod.",
        "kubectl create deployment <name> --image=<image> --replicas=<n> creates a Deployment.",
        "kubectl set image deployment/api nginx=nginx:1.28. The part before = is the container name.",
        "Add --dry-run=client -o yaml to a create deployment command and end it with > api.yaml. Nothing is created in the cluster.",
        "New Pods start as ContainerCreating. Run kubectl get pods again to see them become ready.",
      ],
      solution: [
        "kubectl run debug --image=busybox:1.36",
        "kubectl create deployment api --image=nginx:1.27 --replicas=3",
        "kubectl set image deployment/api nginx=nginx:1.28",
        "kubectl create deployment api --image=nginx:1.28 --replicas=3 --dry-run=client -o yaml > api.yaml",
        "kubectl get pods",
      ],
    },
  ],
  diagrams: [
    {
      id: "imperative-vs-declarative",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "imperative",
            label: "Imperative",
            sub: "you say what to do",
            layout: "column",
            flow: true,
            detail: "Each command is one action against the live cluster. The cluster's current state is the only record of the result.",
            children: [
              {
                id: "imp-create",
                label: "kubectl create deployment web",
                sub: "action 1",
                detail: "Creates the Deployment now, with the image and replicas from the flags.",
              },
              {
                id: "imp-scale",
                label: "kubectl scale deployment web",
                sub: "action 2",
                detail: "Changes replicas on the live object. Nothing outside the cluster records the new value.",
              },
              {
                id: "imp-cluster",
                label: "Cluster",
                sub: "the only source of truth",
                detail: "To know what is running, you have to ask the cluster. To rebuild it elsewhere, you have to repeat every command.",
              },
            ],
          },
          {
            id: "declarative",
            label: "Declarative",
            sub: "you say what you want",
            layout: "column",
            flow: true,
            detail: "You describe the full desired state in files and let kubectl work out the changes. Covered in the next chapter.",
            children: [
              {
                id: "dec-file",
                label: "web.yaml",
                sub: "kept in git",
                detail: "The whole Deployment, including replicas and image. Changes go through a diff and review.",
              },
              {
                id: "dec-apply",
                label: "kubectl apply -f web.yaml",
                sub: "same command every time",
                detail: "kubectl compares the file with the live object and sends only the differences.",
              },
              {
                id: "dec-cluster",
                label: "Cluster",
                sub: "matches the file",
                detail: "The file says what should be running. Applying it again in another cluster gives the same result.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Imperative: one action at a time",
          text: "You run a command for each change. Each one takes effect immediately.",
          highlight: ["imp-create", "imp-scale"],
        },
        {
          title: "The cluster holds the result",
          text: "Nothing outside the cluster says replicas is now 5. Your shell history is the closest thing to a record.",
          highlight: ["imp-cluster"],
        },
        {
          title: "Declarative: describe the result",
          text: "You edit a file that describes the whole object, review it like code, and apply it.",
          highlight: ["dec-file", "dec-apply"],
        },
        {
          title: "The file holds the result",
          text: "The cluster is made to match the file, so the file is the record you can review and repeat.",
          highlight: ["dec-cluster"],
        },
      ],
    },
    {
      id: "imperative-creates",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "run",
            label: "kubectl run debug --image=busybox:1.36",
            layout: "column",
            flow: true,
            detail: "Creates exactly one object, a Pod. There is no controller watching it.",
            children: [
              {
                id: "run-pod",
                label: "Pod debug",
                sub: "label run=debug",
                detail: "A bare Pod with one container named busybox. If it is deleted or its node fails, nothing recreates it.",
              },
            ],
          },
          {
            id: "create",
            label: "kubectl create deployment api --image=nginx:1.27 --replicas=3",
            layout: "column",
            flow: true,
            detail: "Creates one object, the Deployment. The controllers create everything below it.",
            children: [
              {
                id: "create-deploy",
                label: "Deployment api",
                sub: "label app=api",
                detail: "The object the command creates. Its selector and Pod template both use app=api, and the container is named nginx.",
              },
              {
                id: "create-rs",
                label: "ReplicaSet api-<hash>",
                sub: "created by the Deployment",
                detail: "The Deployment controller creates it for the current Pod template. kubectl set image makes a second one.",
              },
              {
                id: "create-pods",
                label: "3 Pods api-<hash>-<suffix>",
                sub: "label app=api",
                detail: "Created by the ReplicaSet. Delete one and the ReplicaSet makes a replacement.",
              },
            ],
          },
        ],
      },
      steps: [
        {
          title: "kubectl run makes one Pod",
          text: "One command, one Pod, labelled run=debug. Good for a throwaway debugging shell, not for an app.",
          highlight: ["run-pod"],
        },
        {
          title: "kubectl create deployment makes a Deployment",
          text: "The command creates only the Deployment, labelled app=api.",
          highlight: ["create-deploy"],
        },
        {
          title: "Controllers do the rest",
          text: "The Deployment creates a ReplicaSet and the ReplicaSet creates three Pods, all carrying app=api.",
          highlight: ["create-rs", "create-pods"],
        },
      ],
    },
    {
      id: "dry-run-bridge",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "bridge-command",
            label: "kubectl create deployment web ... --dry-run=client -o yaml",
            sub: "nothing sent to the cluster",
            detail: "kubectl builds the object locally and prints it as YAML instead of creating it.",
          },
          {
            id: "bridge-file",
            label: "> web.yaml",
            sub: "output saved to a file",
            detail: "The redirect writes the printed YAML to a file. In this simulator, ls and cat show it.",
          },
          {
            id: "bridge-edit",
            label: "Edit and commit",
            sub: "add what the flags cannot set",
            detail: "Remove empty placeholders, add ports, resources, or a different strategy, then commit the file so others can review it.",
          },
          {
            id: "bridge-apply",
            label: "kubectl apply -f web.yaml",
            sub: "declarative from here on",
            detail: "From now on, change the file and apply it again rather than running imperative commands against this Deployment.",
          },
        ],
      },
      steps: [
        {
          title: "Generate",
          text: "--dry-run=client -o yaml turns the command into a manifest without creating anything.",
          highlight: ["bridge-command"],
        },
        {
          title: "Save",
          text: "The > redirect stores the manifest in web.yaml.",
          highlight: ["bridge-file"],
        },
        {
          title: "Edit",
          text: "Tidy the file and add fields the command has no flags for. Commit it.",
          highlight: ["bridge-edit"],
        },
        {
          title: "Apply",
          text: "kubectl apply -f creates the Deployment from the file. The file is now the source of truth.",
          highlight: ["bridge-apply"],
        },
      ],
    },
  ],
};
