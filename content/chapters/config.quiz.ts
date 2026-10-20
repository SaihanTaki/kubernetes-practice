import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "config-why",
    topic: "ConfigMaps",
    difficulty: "beginner",
    question: "Why keep a database host and log level in a ConfigMap instead of in the container image?",
    options: [
      { id: "a", text: "ConfigMaps make containers start faster" },
      { id: "b", text: "The same image can run in every environment with different settings" },
      { id: "c", text: "Images cannot contain environment variables" },
      { id: "d", text: "ConfigMaps encrypt the values automatically" },
    ],
    correctOptionId: "b",
    explanation:
      "Separating configuration from the image means you build once and change only the ConfigMap per environment. ConfigMaps do not encrypt anything, and images can set default env vars.",
  },
  {
    id: "config-from-literal",
    topic: "ConfigMaps",
    difficulty: "beginner",
    question: "Which command creates a ConfigMap named api-config with the key LOG_LEVEL set to info?",
    options: [
      { id: "a", text: "kubectl create configmap api-config --env=LOG_LEVEL=info" },
      { id: "b", text: "kubectl run configmap api-config LOG_LEVEL=info" },
      { id: "c", text: "kubectl create configmap api-config --from-literal=LOG_LEVEL=info" },
      { id: "d", text: "kubectl create secret configmap api-config --from-literal=LOG_LEVEL=info" },
    ],
    correctOptionId: "c",
    explanation:
      "--from-literal=<key>=<value> adds one key per flag. kubectl run creates Pods, and there is no --env flag on create configmap.",
  },
  {
    id: "config-from-env-file",
    topic: "ConfigMaps",
    difficulty: "intermediate",
    question: "app.env contains two lines, A=1 and B=2. What does kubectl create configmap x --from-env-file=app.env produce?",
    options: [
      { id: "a", text: "Two keys, A and B, with values 1 and 2" },
      { id: "b", text: "One key named app.env holding both lines" },
      { id: "c", text: "One key named A holding the whole file" },
      { id: "d", text: "An error, because env files are only for Secrets" },
    ],
    correctOptionId: "a",
    explanation:
      "--from-env-file parses each KEY=value line into its own key. --from-file=app.env would store the whole file under one key named app.env.",
  },
  {
    id: "config-namespace",
    topic: "ConfigMaps",
    difficulty: "beginner",
    question: "A Pod in namespace shop references ConfigMap settings, which exists only in namespace default. What happens?",
    options: [
      { id: "a", text: "Kubernetes finds it in default automatically" },
      { id: "b", text: "The Pod runs with the variables empty" },
      { id: "c", text: "The ConfigMap is copied into shop" },
      { id: "d", text: "The container fails to start because the ConfigMap is not found in shop" },
    ],
    correctOptionId: "d",
    explanation:
      "Pods can only reference ConfigMaps and Secrets in their own namespace. From the Pod's point of view the ConfigMap does not exist, so the container gets CreateContainerConfigError.",
  },
  {
    id: "config-env-update",
    topic: "Updates",
    difficulty: "intermediate",
    question: "A running Pod reads LOG_LEVEL from a ConfigMap through env valueFrom. You change the value in the ConfigMap. When does the container see the new value?",
    options: [
      { id: "a", text: "Immediately" },
      { id: "b", text: "After the kubelet's next sync, about a minute later" },
      { id: "c", text: "Only after the Pod is replaced, for example by kubectl rollout restart" },
      { id: "d", text: "Never, ConfigMaps cannot be changed" },
    ],
    correctOptionId: "c",
    explanation:
      "Environment variables are set when the container starts and never change while it runs. A new Pod reads the current value. The delayed sync applies to volume mounts only.",
  },
  {
    id: "config-volume-update",
    topic: "Updates",
    difficulty: "intermediate",
    question: "A ConfigMap is mounted as a volume (without subPath). You change one of its keys. What happens to the file in the running container?",
    options: [
      { id: "a", text: "It is updated in place after a delay, and the app must re-read it" },
      { id: "b", text: "It never changes until the Pod restarts" },
      { id: "c", text: "The container restarts automatically with the new file" },
      { id: "d", text: "The file is deleted until the Pod restarts" },
    ],
    correctOptionId: "a",
    explanation:
      "The kubelet refreshes ConfigMap volumes on its periodic sync, so the file changes without a restart. Kubernetes does not signal or restart the app, so it has to notice the change itself.",
  },
  {
    id: "config-subpath",
    topic: "Updates",
    difficulty: "advanced",
    question: "nginx.conf is mounted from a ConfigMap with subPath: nginx.conf. You update the ConfigMap. What does the container see?",
    options: [
      { id: "a", text: "The new file after the kubelet's next sync" },
      { id: "b", text: "An empty file" },
      { id: "c", text: "The new file immediately" },
      { id: "d", text: "The old file until the container is recreated" },
    ],
    correctOptionId: "d",
    explanation:
      "subPath mounts are set up once at container start and do not receive ConfigMap updates. Only whole-directory ConfigMap volumes are refreshed.",
  },
  {
    id: "config-immutable",
    topic: "ConfigMaps",
    difficulty: "intermediate",
    question: "A ConfigMap has immutable: true. You need to change one value. What do you do?",
    options: [
      { id: "a", text: "Set immutable: false, change the value, then set it back" },
      { id: "b", text: "Create a new ConfigMap (or delete and recreate it) and roll the Pods onto it" },
      { id: "c", text: "Use kubectl edit, which bypasses the immutable flag" },
      { id: "d", text: "Change it under stringData instead of data" },
    ],
    correctOptionId: "b",
    explanation:
      "Once immutable is true, the data cannot change and the flag cannot be reverted. The usual pattern is a new name such as api-config-v2, referenced from the Deployment, which triggers a rollout.",
  },
  {
    id: "config-base64",
    topic: "Secrets",
    difficulty: "beginner",
    question: "A Secret's data shows DB_PASSWORD: czNjcjN0. How well is the password protected by this?",
    options: [
      { id: "a", text: "Not at all: base64 is an encoding that anyone can decode" },
      { id: "b", text: "Fully: the value is encrypted with the cluster key" },
      { id: "c", text: "Partly: only cluster admins can decode base64" },
      { id: "d", text: "Fully: only the Pod can decode it" },
    ],
    correctOptionId: "a",
    explanation:
      "Base64 lets binary data fit in YAML. echo czNjcjN0 | base64 -d prints s3cr3t. Protection comes from RBAC and encryption at rest, not from the encoding.",
  },
  {
    id: "config-encryption",
    topic: "Secrets",
    difficulty: "advanced",
    question: "With a default cluster setup, how are Secret values stored in etcd?",
    options: [
      { id: "a", text: "Encrypted with AES by the kubelet" },
      { id: "b", text: "Hashed, so they cannot be recovered" },
      { id: "c", text: "Unencrypted, unless the API server is configured with an EncryptionConfiguration or KMS provider" },
      { id: "d", text: "Not stored at all, only kept in memory on nodes" },
    ],
    correctOptionId: "c",
    explanation:
      "Encryption at rest is opt-in. Without it, anyone with access to etcd or its backups can read every Secret. Kubelets keep Secret volumes in memory, but the API server's copy lives in etcd.",
  },
  {
    id: "config-rbac",
    topic: "Secrets",
    difficulty: "advanced",
    question: "A user cannot get Secrets in namespace shop but can create Pods there. Can they read a Secret's value?",
    options: [
      { id: "a", text: "No, the get restriction blocks all access" },
      { id: "b", text: "Only if the Secret has type Opaque" },
      { id: "c", text: "Only with kubectl describe secret" },
      { id: "d", text: "Yes, by creating a Pod that mounts it or reads it into an env var" },
    ],
    correctOptionId: "d",
    explanation:
      "Pods can reference any Secret in their namespace, so permission to create Pods there effectively includes reading its Secrets. describe secret shows only key names and sizes.",
  },
  {
    id: "config-tls-type",
    topic: "Secrets",
    difficulty: "intermediate",
    question: "Which keys must a Secret of type kubernetes.io/tls contain?",
    options: [
      { id: "a", text: "username and password" },
      { id: "b", text: "tls.crt and tls.key" },
      { id: "c", text: ".dockerconfigjson" },
      { id: "d", text: "token and ca.crt" },
    ],
    correctOptionId: "b",
    explanation:
      "kubernetes.io/tls requires tls.crt and tls.key, which kubectl create secret tls fills from --cert and --key. .dockerconfigjson belongs to registry Secrets.",
  },
  {
    id: "config-dockerconfig",
    topic: "Secrets",
    difficulty: "intermediate",
    question: "What is a kubernetes.io/dockerconfigjson Secret for?",
    options: [
      { id: "a", text: "Configuring the Docker daemon on nodes" },
      { id: "b", text: "Storing a Dockerfile in the cluster" },
      { id: "c", text: "Credentials the kubelet uses to pull images from a private registry, referenced from imagePullSecrets" },
      { id: "d", text: "Passing environment variables to docker run" },
    ],
    correctOptionId: "c",
    explanation:
      "kubectl create secret docker-registry creates this type. A Pod or its ServiceAccount lists it under imagePullSecrets so the kubelet can authenticate to the registry.",
  },
  {
    id: "config-sa-token",
    topic: "Secrets",
    difficulty: "advanced",
    question: "In current Kubernetes versions, how does a Pod normally get its ServiceAccount token?",
    options: [
      { id: "a", text: "Through a short-lived token in a projected volume, not an auto-created Secret" },
      { id: "b", text: "From a kubernetes.io/service-account-token Secret created for every ServiceAccount" },
      { id: "c", text: "From an environment variable set by the scheduler" },
      { id: "d", text: "It must be created by hand for every Pod" },
    ],
    correctOptionId: "a",
    explanation:
      "Since Kubernetes 1.24, token Secrets are no longer created automatically. The kubelet requests a time-limited token and projects it into the Pod. You create a token Secret only when you need a long-lived token.",
  },
  {
    id: "config-size",
    topic: "ConfigMaps",
    difficulty: "beginner",
    question: "What is the size limit for the data in a single ConfigMap or Secret?",
    options: [
      { id: "a", text: "64 KiB" },
      { id: "b", text: "10 MiB" },
      { id: "c", text: "No limit" },
      { id: "d", text: "1 MiB" },
    ],
    correctOptionId: "d",
    explanation:
      "Both are capped at 1 MiB because they are stored in etcd and sent to every kubelet that uses them. Larger data belongs in a volume or an external store.",
  },
  {
    id: "config-ccce",
    topic: "Troubleshooting",
    difficulty: "intermediate",
    question: "A Pod shows status CreateContainerConfigError. What is the most likely cause?",
    options: [
      { id: "a", text: "The image tag does not exist" },
      { id: "b", text: "The container exits with a non-zero code" },
      { id: "c", text: "No node has enough CPU" },
      { id: "d", text: "env or envFrom refers to a ConfigMap, Secret, or key that does not exist" },
    ],
    correctOptionId: "d",
    explanation:
      "The kubelet cannot build the container's configuration, so it never starts it. A bad image gives ImagePullBackOff, a crashing app CrashLoopBackOff, and lack of resources leaves the Pod Pending.",
  },
  {
    id: "config-yaml-keyref",
    topic: "Pod YAML",
    difficulty: "beginner",
    question: "Which field, next to name: DB_PASSWORD in an env entry, sets it from the DB_PASSWORD key of Secret api-db?",
    options: [
      { id: "a", text: "value: api-db/DB_PASSWORD" },
      { id: "b", text: "valueFrom: { secretKeyRef: { name: api-db, key: DB_PASSWORD } }" },
      { id: "c", text: "secretRef: { name: api-db }" },
      { id: "d", text: "valueFrom: { configMapKeyRef: { name: api-db, key: DB_PASSWORD } }" },
    ],
    correctOptionId: "b",
    explanation:
      "valueFrom.secretKeyRef names the Secret and the key. value sets a literal string, secretRef belongs under envFrom, and configMapKeyRef would look for a ConfigMap named api-db.",
  },
  {
    id: "config-yaml-envfrom",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question:
      "A container has envFrom: [{ configMapRef: { name: api-config } }] and api-config holds LOG_LEVEL and APP_MODE. Which variables does the container get from it?",
    options: [
      { id: "a", text: "A single variable named api-config" },
      { id: "b", text: "None until each key is also listed under env" },
      { id: "c", text: "LOG_LEVEL and APP_MODE" },
      { id: "d", text: "API_CONFIG_LOG_LEVEL and API_CONFIG_APP_MODE" },
    ],
    correctOptionId: "c",
    explanation:
      "envFrom turns each key into a variable with the same name. Names are only changed if you set prefix on the envFrom entry.",
  },
  {
    id: "config-yaml-prefix",
    topic: "Pod YAML",
    difficulty: "intermediate",
    question: "An envFrom entry has secretRef: { name: db } and prefix: DB_. The Secret has the key PASSWORD. What is the variable called?",
    options: [
      { id: "a", text: "DB_PASSWORD" },
      { id: "b", text: "PASSWORD" },
      { id: "c", text: "db.PASSWORD" },
      { id: "d", text: "PASSWORD_DB" },
    ],
    correctOptionId: "a",
    explanation: "prefix is prepended to every variable name from that source, so PASSWORD becomes DB_PASSWORD.",
  },
  {
    id: "config-yaml-stringdata",
    topic: "Secret YAML",
    difficulty: "intermediate",
    question: "You apply a Secret with stringData: { DB_PASSWORD: s3cr3t }. What does kubectl get secret -o yaml show afterwards?",
    options: [
      { id: "a", text: "stringData with DB_PASSWORD: s3cr3t" },
      { id: "b", text: "Both stringData and data" },
      { id: "c", text: "Nothing, Secret values are never shown" },
      { id: "d", text: "data with DB_PASSWORD: czNjcjN0" },
    ],
    correctOptionId: "d",
    explanation:
      "stringData is write-only. The API server encodes the values into data, so reading the Secret back shows base64 under data and no stringData field.",
  },
  {
    id: "config-yaml-data-plain",
    topic: "Secret YAML",
    difficulty: "advanced",
    question: "A Secret manifest has data: { DB_PASSWORD: s3cr3t! } with the plain password under data. What happens on apply?",
    options: [
      { id: "a", text: "It is stored as the password s3cr3t!" },
      { id: "b", text: "The API server rejects it because the value is not valid base64" },
      { id: "c", text: "It is moved to stringData automatically" },
      { id: "d", text: "It is encrypted before storage" },
    ],
    correctOptionId: "b",
    explanation:
      "Values under data must be base64. The ! character is not part of the base64 alphabet, so the request fails. Use stringData for plain values.",
  },
  {
    id: "config-yaml-optional",
    topic: "Pod YAML",
    difficulty: "advanced",
    question: "A configMapKeyRef has optional: true and the key does not exist. What happens?",
    options: [
      { id: "a", text: "The Pod gets CreateContainerConfigError" },
      { id: "b", text: "The variable is set to an empty string" },
      { id: "c", text: "The container starts and the variable is not set" },
      { id: "d", text: "The Pod is rejected by the API server" },
    ],
    correctOptionId: "c",
    explanation:
      "optional: true tells the kubelet to skip the variable when the ConfigMap or key is missing, instead of refusing to start the container.",
  },
  {
    id: "config-yaml-configmap-data",
    topic: "ConfigMap YAML",
    difficulty: "beginner",
    question: "In a ConfigMap manifest, under which field do the key-value settings go?",
    options: [
      { id: "a", text: "data" },
      { id: "b", text: "spec" },
      { id: "c", text: "stringData" },
      { id: "d", text: "metadata.labels" },
    ],
    correctOptionId: "a",
    explanation:
      "A ConfigMap has no spec. Its settings are string values under data. stringData is a Secret field, and labels are for selecting objects, not configuration.",
  },
];
