export type Labels = Record<string, string>;

export type Meta = {
  uid: string;
  name: string;
  namespace: string;
  labels: Labels;
  annotations: Labels;
  /** Simulated seconds since the cluster clock started. */
  createdAt: number;
};

export type PodStatus =
  | "ContainerCreating"
  | "Running"
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "CreateContainerConfigError";

/** A container port number or the name of a container port. */
export type PortRef = number | string;

export type Probe = {
  httpGet?: { path?: string; port: PortRef };
  tcpSocket?: { port: PortRef };
  exec?: { command: string[] };
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
};

type KeyRef = { name: string; key: string };

export type EnvVar = {
  name: string;
  value?: string;
  valueFrom?: { configMapKeyRef?: KeyRef; secretKeyRef?: KeyRef };
};

export type EnvFrom = { configMapRef?: { name: string }; secretRef?: { name: string }; prefix?: string };

/** Everything about the (single modelled) container except its image. */
export type Container = {
  name: string;
  ports?: { containerPort: number; name?: string; protocol?: string }[];
  env?: EnvVar[];
  envFrom?: EnvFrom[];
  readinessProbe?: Probe;
  livenessProbe?: Probe;
  startupProbe?: Probe;
};

export type PodTemplate = { labels: Labels; annotations?: Labels; image: string; container: Container };

export type Pod = {
  kind: "Pod";
  metadata: Meta;
  /** Name of the owning ReplicaSet, if any. */
  owner?: string;
  image: string;
  container: Container;
  node: string;
  status: PodStatus;
  /** Readiness, meaningful only while status is Running. */
  ready: boolean;
  restarts: number;
  /** Canonical spec of a Pod created by apply, minus its image, to reject updates the API forbids. */
  specKey?: string;
};

export type ReplicaSet = {
  kind: "ReplicaSet";
  metadata: Meta;
  /** Name of the owning Deployment, if any. */
  owner?: string;
  replicas: number;
  selector: Labels;
  template: PodTemplate;
};

export type Strategy = {
  type: "RollingUpdate" | "Recreate";
  maxSurge: number | string;
  maxUnavailable: number | string;
};

export type Deployment = {
  kind: "Deployment";
  metadata: Meta;
  replicas: number;
  selector: Labels;
  template: PodTemplate;
  strategy: Strategy;
  paused?: boolean;
};

export type ServiceType = "ClusterIP" | "NodePort" | "LoadBalancer";

export type ServicePort = { name?: string; protocol: string; port: number; targetPort: PortRef; nodePort?: number };

export type Service = {
  kind: "Service";
  metadata: Meta;
  type: ServiceType;
  clusterIP: string;
  selector: Labels;
  ports: ServicePort[];
};

export type ConfigMap = { kind: "ConfigMap"; metadata: Meta; data: Record<string, string> };

/** `data` values are base64, as the API stores them. */
export type Secret = { kind: "Secret"; metadata: Meta; type: string; data: Record<string, string> };

export type Resource = Pod | ReplicaSet | Deployment | Service | ConfigMap | Secret;
export type Kind = Resource["kind"];

export type Cluster = {
  clock: number;
  seq: number;
  nodes: string[];
  namespaces: string[];
  resources: Resource[];
  /** Simulated files (name -> text) for ls, cat, redirects and apply -f. */
  files: Record<string, string>;
};

type WorkloadFixture = { name: string; namespace?: string; replicas: number; image: string; labels: Labels };

export type Fixture = {
  namespaces?: string[];
  deployments?: WorkloadFixture[];
  replicaSets?: WorkloadFixture[];
  pods?: {
    name: string;
    namespace?: string;
    image: string;
    labels?: Labels;
    status?: PodStatus;
    restarts?: number;
  }[];
  files?: Record<string, string>;
  /** Names from `files`, applied in order (like kubectl apply -f) when the cluster is created. */
  apply?: string[];
};

export type RunResult = { cluster: Cluster; output: string; error: boolean };
