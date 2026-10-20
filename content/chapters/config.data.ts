import type { ChapterData } from "../types";
import { quiz } from "./config.quiz";

const apiYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api:1.0
          ports:
            - containerPort: 8080
          env:
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: api-config
                  key: LOG_LEVEL
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: api-db
                  key: DB_PASSWORD
`;

export const data: ChapterData = {
  objectives: [
    "Explain why configuration and credentials belong in ConfigMaps and Secrets rather than in the image.",
    "Create ConfigMaps and Secrets from literals, files, and manifests, and read data versus stringData.",
    "Pass configuration to a container as environment variables or as files, and predict what an update changes.",
    "Say what actually protects a Secret, given that base64 is only an encoding.",
    "Diagnose and fix a Pod stuck in CreateContainerConfigError.",
  ],
  quiz,
  manifests: [
    {
      id: "configmap",
      title: "api-config.yaml",
      yaml: `apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: info
  APP_MODE: production`,
      notes: [
        { line: 1, text: "ConfigMaps are in the core API group, so the version is plain v1." },
        { line: 4, text: "Pods refer to the ConfigMap by this name, and only from the same namespace." },
        { line: 5, text: "Every value under data is a string. Quote numbers and booleans in your own manifests, such as \"8080\" or \"true\"." },
        { line: 6, text: "A key used as an env var should be a valid variable name. A key used as a file can also contain dots, like nginx.conf." },
      ],
    },
    {
      id: "secret",
      title: "api-db.yaml",
      yaml: `apiVersion: v1
kind: Secret
metadata:
  name: api-db
type: Opaque
stringData:
  DB_USER: api
  DB_PASSWORD: s3cr3t`,
      notes: [
        { line: 2, text: "Same shape as a ConfigMap. Kubernetes treats it differently: kubelets keep Secret volumes in memory and describe never prints values." },
        { line: 5, text: "Opaque is the default for arbitrary data. Types such as kubernetes.io/tls require specific keys." },
        { line: 6, text: "stringData takes plain values. The API server base64-encodes them into data, and reading the Secret back shows only data." },
        { line: 8, text: "This value is in plain text in the file. Keep files like this out of Git, or encrypt them." },
      ],
    },
    {
      id: "config-deployment",
      title: "api-deployment.yaml",
      yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api:1.0
          ports:
            - containerPort: 8080
          env:
            - name: LOG_LEVEL
              valueFrom:
                configMapKeyRef:
                  name: api-config
                  key: LOG_LEVEL
          envFrom:
            - secretRef:
                name: api-db`,
      notes: [
        { line: 20, text: "env sets variables one at a time. Values set here win over the same name from envFrom." },
        { line: 21, text: "The variable name the app sees. It does not have to match the key name." },
        { line: 23, text: "Read one key from a ConfigMap. Use secretKeyRef with the same name and key fields for a Secret." },
        { line: 24, text: "The ConfigMap name. If it does not exist, the container fails with CreateContainerConfigError." },
        { line: 25, text: "The key inside the ConfigMap. A missing key causes the same error unless optional: true is set." },
        { line: 26, text: "envFrom turns every key of the source into a variable of the same name." },
        { line: 27, text: "All keys of the api-db Secret, here DB_USER and DB_PASSWORD. Values are set when the container starts and do not change while it runs." },
      ],
    },
  ],
  labs: [
    {
      id: "config-missing",
      title: "Unblock a Deployment missing its config",
      difficulty: "intermediate",
      scenario:
        "Someone applied api.yaml, but none of the api Pods have started. The app needs LOG_LEVEL set to info and DB_PASSWORD set to s3cr3t.",
      instructions: [
        "Run kubectl get pods and note the status.",
        "Run kubectl describe pod on one Pod, or cat api.yaml, to see which ConfigMap, Secret, and keys the container needs.",
        "Create the ConfigMap with the LOG_LEVEL key using kubectl create configmap and --from-literal.",
        "Create the Secret with the DB_PASSWORD key using kubectl create secret generic and --from-literal.",
        "Run kubectl get pods until both Pods are Running and ready.",
      ],
      fixture: { files: { "api.yaml": apiYaml }, apply: ["api.yaml"] },
      objectives: [
        {
          id: "configmap",
          description: "ConfigMap api-config has LOG_LEVEL=info.",
          validator: { kind: "config-key", resourceType: "ConfigMap", resourceName: "api-config", key: "LOG_LEVEL", expectedValue: "info" },
        },
        {
          id: "secret",
          description: "Secret api-db has DB_PASSWORD=s3cr3t.",
          validator: { kind: "config-key", resourceType: "Secret", resourceName: "api-db", key: "DB_PASSWORD", expectedValue: "s3cr3t" },
        },
        {
          id: "ready",
          description: "2 Pods owned by api are ready.",
          validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "api", expectedValue: 2 },
        },
      ],
      hints: [
        "CreateContainerConfigError means the container's env refers to something that does not exist.",
        "In api.yaml, configMapKeyRef names api-config with key LOG_LEVEL, and secretKeyRef names api-db with key DB_PASSWORD.",
        "kubectl create configmap api-config --from-literal=LOG_LEVEL=info",
        "kubectl create secret generic api-db --from-literal=DB_PASSWORD=s3cr3t",
        "You do not need to restart or reapply the Deployment. The kubelet retries, so run kubectl get pods again.",
        "Key names are case-sensitive: log_level does not satisfy a reference to LOG_LEVEL.",
      ],
      solution: [
        "kubectl create configmap api-config --from-literal=LOG_LEVEL=info",
        "kubectl create secret generic api-db --from-literal=DB_PASSWORD=s3cr3t",
        "kubectl get pods",
        "kubectl get pods",
      ],
    },
  ],
  diagrams: [
    {
      id: "config-paths",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "sources",
            label: "Sources",
            sub: "same namespace as the Pod",
            detail: "ConfigMaps and Secrets are separate API objects. You can change them without rebuilding the image.",
            children: [
              {
                id: "cm",
                label: "ConfigMap api-config",
                sub: "LOG_LEVEL, nginx.conf",
                detail: "Plain string values under data. For settings and config files that are not sensitive.",
              },
              {
                id: "secret",
                label: "Secret api-db",
                sub: "DB_PASSWORD (base64)",
                detail: "Values stored base64-encoded under data. Readable by anyone with get access, so RBAC and encryption at rest do the protecting.",
              },
            ],
          },
          {
            id: "paths",
            label: "How the Pod spec references them",
            sub: "pick per container",
            detail: "One container can use both paths at once, for example a password as env and a config file as a volume.",
            children: [
              {
                id: "env",
                label: "env / envFrom",
                sub: "read once at start",
                detail: "valueFrom.configMapKeyRef or secretKeyRef sets one variable. envFrom turns every key into a variable. Missing references cause CreateContainerConfigError.",
              },
              {
                id: "volume",
                label: "volume + volumeMount",
                sub: "one file per key",
                detail: "Each key becomes a file under mountPath. Secret volumes are held in memory on the node. A missing source leaves the Pod in ContainerCreating.",
              },
            ],
          },
          {
            id: "container",
            label: "Container",
            sub: "the app reads $LOG_LEVEL or /etc/app/...",
            detail: "The app does not know Kubernetes is involved. It reads ordinary environment variables or files.",
          },
        ],
      },
      steps: [
        {
          title: "Store the configuration",
          text: "Settings go in a ConfigMap and credentials in a Secret, both in the Pod's namespace.",
          highlight: ["cm", "secret"],
        },
        {
          title: "Environment variables",
          text: "env and envFrom copy values into the container's environment when it starts.",
          highlight: ["env"],
        },
        {
          title: "Files",
          text: "A volume projects each key as a file. Use this for whole config files or certificates.",
          highlight: ["volume"],
        },
        {
          title: "The app reads them",
          text: "Either way the container sees normal variables or files, so the same image runs in every environment.",
          highlight: ["container"],
        },
      ],
    },
    {
      id: "config-update",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "u-edit",
            label: "You change the ConfigMap",
            sub: "LOG_LEVEL: info → debug",
            detail: "kubectl apply or edit updates the object in the API server. Nothing restarts.",
          },
          {
            id: "u-after",
            label: "A minute or so later",
            sub: "running Pods",
            detail: "The kubelet syncs volumes periodically and uses a cache, so file updates arrive after a delay rather than instantly.",
            children: [
              { id: "u-env", label: "env / envFrom", sub: "still info", detail: "Environment variables are fixed when the container starts. They never change in a running container." },
              { id: "u-vol", label: "Volume mount", sub: "file now says debug", detail: "The kubelet swaps the files in place. The app must re-read the file to notice." },
              { id: "u-sub", label: "subPath mount", sub: "still info", detail: "A subPath file is copied at container start and is never updated." },
            ],
          },
          {
            id: "u-restart",
            label: "kubectl rollout restart deployment/api",
            sub: "new Pods",
            detail: "New Pods start with the current ConfigMap, so env, volume, and subPath all show debug. Immutable ConfigMaps skip all of this: you create a new one and point the Deployment at it.",
          },
        ],
      },
      steps: [
        {
          title: "Change",
          text: "The ConfigMap changes in the API server. Running containers are not restarted.",
          highlight: ["u-edit"],
        },
        {
          title: "Env vars stay old",
          text: "Variables were set when the container started, so they still say info.",
          highlight: ["u-after", "u-env"],
        },
        {
          title: "Volume files update",
          text: "After the kubelet's next sync the mounted file holds debug. subPath files do not.",
          highlight: ["u-vol", "u-sub"],
        },
        {
          title: "Restart to apply everywhere",
          text: "Replacing the Pods is the only way to get the new value into env vars and subPath files.",
          highlight: ["u-restart"],
        },
      ],
    },
  ],
};
