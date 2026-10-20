import type { ChapterData } from "../types";
import { quiz } from "./labels.quiz";

export const data: ChapterData = {
  objectives: [
    "Write label keys and values that the API server accepts, including the recommended app.kubernetes.io labels.",
    "Select objects with equality-based and set-based selectors, on the command line and in manifests.",
    "Explain how ReplicaSets, Deployments, and Services use selectors, and pull a Pod out of a ReplicaSet by relabeling it.",
    "Choose between a label and an annotation, and add, change, or remove either with kubectl.",
  ],
  quiz,
  manifests: [
    {
      id: "labels-deployment",
      title: "checkout-deployment.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  labels:
    app.kubernetes.io/name: checkout
    app.kubernetes.io/instance: checkout-prod
    app.kubernetes.io/version: "1.1"
    app.kubernetes.io/component: api
    app.kubernetes.io/part-of: shop
    app.kubernetes.io/managed-by: kubectl
  annotations:
    kubernetes.io/change-cause: "Update example/api to 1.1"
    example.com/owner-team: payments
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: checkout
      app.kubernetes.io/instance: checkout-prod
  template:
    metadata:
      labels:
        app.kubernetes.io/name: checkout
        app.kubernetes.io/instance: checkout-prod
        app.kubernetes.io/version: "1.1"
        app.kubernetes.io/component: api
        tier: backend
        env: prod
    spec:
      containers:
        - name: checkout
          image: example/api:1.1
          ports:
            - containerPort: 8080`,
      notes: [
        { line: 5, text: "Labels on the Deployment object itself. They let you find the Deployment with -l, but they do not decide which Pods it owns." },
        { line: 6, text: "The application's name. The app.kubernetes.io prefix marks this as one of the recommended labels that tools such as dashboards understand." },
        { line: 7, text: "Tells apart several installs of the same application, for example checkout-prod and checkout-staging." },
        { line: 8, text: "The application version. Quoted so YAML keeps it a string: label values must be strings, and an unquoted 1.1 would be a number." },
        { line: 9, text: "The role this piece plays inside the larger application: api, database, cache, and so on." },
        { line: 10, text: "The larger application this belongs to. Every piece of the shop carries part-of: shop." },
        { line: 11, text: "The tool that manages the object, such as kubectl or Helm." },
        { line: 12, text: "Annotations: free-form metadata for people and tools. No selector can match on them." },
        { line: 13, text: "kubectl rollout history shows this value in its CHANGE-CAUSE column. Values can contain spaces and punctuation, unlike label values." },
        { line: 14, text: "A custom annotation under a domain you own. Use your own prefix so it cannot clash with another tool." },
        { line: 17, text: "The selector. It cannot be changed after the Deployment is created, so pick labels that stay fixed for the app's whole life." },
        { line: 18, text: "matchLabels is the equality form: every listed key must be present with exactly this value. matchExpressions also goes under selector, alongside or instead of matchLabels." },
        { line: 19, text: "name plus instance identifies this install. Version is left out on purpose: it changes every release and the selector cannot." },
        { line: 23, text: "Every Pod gets these labels. They must include every selector label, or the API server rejects the manifest." },
        { line: 26, text: "The template can carry labels the selector does not use. Changing them still starts a rollout, because the template changed." },
        { line: 28, text: "Short tier and env labels for day-to-day filtering, such as kubectl get pods -l tier=backend,env=prod." },
      ],
    },
  ],
  labs: [
    {
      id: "labels-relabel",
      title: "Label, select, and pull a Pod out of a ReplicaSet",
      difficulty: "intermediate",
      scenario:
        "Two standalone Pods, frontend and backend, are missing their tier and env labels. The api ReplicaSet runs three Pods, and one of them, api-87lt9, is answering slowly. You want to keep it running for investigation without it counting toward the ReplicaSet.",
      instructions: [
        "List the Pods with their labels.",
        "Label the frontend Pod tier=frontend and env=staging, and the backend Pod tier=backend and env=staging.",
        "Use a selector to list only the staging Pods, then only the staging Pods that are not backend.",
        "Change the app label of api-87lt9 to debug so the api ReplicaSet no longer selects it.",
        "Check that the ReplicaSet created a replacement and has three ready Pods again.",
        "Annotate api-87lt9 with example.com/debug-reason=slow-responses so others know why it is there.",
      ],
      fixture: {
        replicaSets: [{ name: "api", replicas: 3, image: "nginx:1.27", labels: { app: "api" } }],
        pods: [
          { name: "frontend", image: "nginx:1.27", labels: { app: "shop" } },
          { name: "backend", image: "nginx:1.27", labels: { app: "shop" } },
        ],
      },
      objectives: [
        {
          id: "frontend-tier",
          description: "The frontend Pod has tier=frontend.",
          validator: { kind: "label-equals", resourceType: "Pod", resourceName: "frontend", key: "tier", expectedValue: "frontend" },
        },
        {
          id: "frontend-env",
          description: "The frontend Pod has env=staging.",
          validator: { kind: "label-equals", resourceType: "Pod", resourceName: "frontend", key: "env", expectedValue: "staging" },
        },
        {
          id: "backend-tier",
          description: "The backend Pod has tier=backend.",
          validator: { kind: "label-equals", resourceType: "Pod", resourceName: "backend", key: "tier", expectedValue: "backend" },
        },
        {
          id: "backend-env",
          description: "The backend Pod has env=staging.",
          validator: { kind: "label-equals", resourceType: "Pod", resourceName: "backend", key: "env", expectedValue: "staging" },
        },
        {
          id: "orphaned",
          description: "api-87lt9 has app=debug, so the ReplicaSet no longer selects it.",
          validator: { kind: "label-equals", resourceType: "Pod", resourceName: "api-87lt9", key: "app", expectedValue: "debug" },
        },
        {
          id: "replacement",
          description: "The api ReplicaSet has 3 ready Pods.",
          validator: { kind: "ready-pod-count", ownerType: "ReplicaSet", ownerName: "api", expectedValue: 3 },
        },
        {
          id: "annotated",
          description: "api-87lt9 has the annotation example.com/debug-reason=slow-responses.",
          validator: {
            kind: "annotation-equals",
            resourceType: "Pod",
            resourceName: "api-87lt9",
            key: "example.com/debug-reason",
            expectedValue: "slow-responses",
          },
        },
      ],
      hints: [
        "kubectl get pods --show-labels adds a LABELS column.",
        "kubectl label pod <name> k1=v1 k2=v2 sets several labels in one command.",
        "A comma means AND: -l env=staging,tier!=backend. Quote set-based selectors: -l 'tier in (frontend,db)'.",
        "api-87lt9 already has app=api, so changing it needs --overwrite.",
        "The replacement Pod starts as ContainerCreating. Run kubectl get pods -l app=api again to see it ready.",
        "kubectl annotate works like kubectl label: kubectl annotate pod <name> <key>=<value>.",
      ],
      solution: [
        "kubectl get pods --show-labels",
        "kubectl label pod frontend tier=frontend env=staging",
        "kubectl label pod backend tier=backend env=staging",
        "kubectl get pods -l env=staging",
        "kubectl get pods -l env=staging,tier!=backend",
        "kubectl label pod api-87lt9 app=debug --overwrite",
        "kubectl get pods -l app=api",
        "kubectl annotate pod api-87lt9 example.com/debug-reason=slow-responses",
        "kubectl get pods -l app=api",
      ],
    },
  ],
  diagrams: [
    {
      id: "label-selectors",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "pods",
            label: "Pods in the namespace",
            sub: "same Pods, three selectors",
            detail: "Five Pods with different labels. A selector is a query over these labels; the same Pod can match many selectors.",
            children: [
              { id: "web-a", label: "web-a", sub: "tier=frontend env=prod", detail: "Labels: app=shop, tier=frontend, env=prod." },
              { id: "web-b", label: "web-b", sub: "tier=frontend env=staging", detail: "Labels: app=shop, tier=frontend, env=staging." },
              { id: "api-a", label: "api-a", sub: "tier=backend env=prod", detail: "Labels: app=shop, tier=backend, env=prod." },
              { id: "db-a", label: "db-a", sub: "tier=db env=prod", detail: "Labels: app=shop, tier=db, env=prod." },
              { id: "toolbox", label: "toolbox", sub: "app=toolbox, no tier or env", detail: "Labels: app=toolbox only. It has no tier key and no env key, which matters for != and notin." },
            ],
          },
          {
            id: "selectors",
            label: "Selectors",
            sub: "kubectl get pods -l ...",
            detail: "Each selector is a list of requirements joined by AND. A Pod is selected only if it meets all of them.",
            children: [
              { id: "sel-eq", label: "tier=frontend", sub: "equality", detail: "The tier key must exist with the value frontend. Matches web-a and web-b." },
              { id: "sel-and", label: "env=prod,tier!=db", sub: "equality, AND", detail: "env must be prod, and tier must not be db. Matches web-a and api-a. toolbox fails env=prod; db-a fails tier!=db." },
              { id: "sel-set", label: "tier notin (frontend,db)", sub: "set-based", detail: "Matches api-a, whose tier is backend, and also toolbox, because notin matches Pods that do not have the key at all." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "The Pods",
          text: "Five Pods with labels. Nothing groups them except the labels themselves.",
          highlight: ["pods"],
        },
        {
          title: "Equality: tier=frontend",
          text: "Only Pods whose tier label is exactly frontend: web-a and web-b.",
          highlight: ["sel-eq", "web-a", "web-b"],
        },
        {
          title: "Two requirements: env=prod,tier!=db",
          text: "The comma means AND. web-b fails env=prod, db-a fails tier!=db, toolbox has no env. That leaves web-a and api-a.",
          highlight: ["sel-and", "web-a", "api-a"],
        },
        {
          title: "Set-based: tier notin (frontend,db)",
          text: "api-a matches because backend is not in the set. toolbox matches too: notin, like !=, also selects Pods without the key.",
          highlight: ["sel-set", "api-a", "toolbox"],
        },
      ],
    },
  ],
};
