export type Labels = Record<string, string>;

export type Meta = {
  uid: string;
  name: string;
  /** "" for cluster-scoped kinds. */
  namespace: string;
  labels: Labels;
  annotations: Labels;
  /** Simulated seconds since the cluster clock started. */
  createdAt: number;
};

export type PodStatus =
  /** Not bound to a node yet. */
  | "Pending"
  | "ContainerCreating"
  | "Running"
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "CreateContainerConfigError"
  | "OOMKilled"
  | "Completed"
  | "Error";

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

/** Quantities as written, e.g. cpu "250m", memory "128Mi". */
export type ResourceList = { cpu?: string; memory?: string };

export type Resources = { requests?: ResourceList; limits?: ResourceList };

export type VolumeMount = { name: string; mountPath: string; readOnly?: boolean; subPath?: string };

type KeyToPath = { key: string; path: string };

/** A Pod volume: exactly one source is set. */
export type Volume = {
  name: string;
  emptyDir?: { medium?: string; sizeLimit?: string };
  hostPath?: { path: string; type?: string };
  configMap?: { name: string; items?: KeyToPath[] };
  secret?: { secretName: string; items?: KeyToPath[] };
  persistentVolumeClaim?: { claimName: string; readOnly?: boolean };
};

/** Everything about the (single modelled) container except its image. */
export type Container = {
  name: string;
  command?: string[];
  args?: string[];
  resources?: Resources;
  ports?: { containerPort: number; name?: string; protocol?: string }[];
  env?: EnvVar[];
  envFrom?: EnvFrom[];
  readinessProbe?: Probe;
  livenessProbe?: Probe;
  startupProbe?: Probe;
  volumeMounts?: VolumeMount[];
};

export type TaintEffect = "NoSchedule" | "PreferNoSchedule" | "NoExecute";

export type Taint = { key: string; value?: string; effect: TaintEffect };

export type Toleration = {
  key?: string;
  operator?: "Equal" | "Exists";
  value?: string;
  /** Empty matches every effect. */
  effect?: TaintEffect;
  tolerationSeconds?: number;
};

export type MatchExpression = { key: string; operator: "In" | "NotIn" | "Exists" | "DoesNotExist"; values?: string[] };

export type LabelSelector = { matchLabels?: Labels; matchExpressions?: MatchExpression[] };

export type NodeSelectorTerm = { matchExpressions?: MatchExpression[] };

export type PodAffinityTerm = { labelSelector?: LabelSelector; topologyKey: string };

export type Affinity = {
  nodeAffinity?: {
    requiredDuringSchedulingIgnoredDuringExecution?: { nodeSelectorTerms: NodeSelectorTerm[] };
    preferredDuringSchedulingIgnoredDuringExecution?: { weight: number; preference: NodeSelectorTerm }[];
  };
  podAntiAffinity?: { requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[] };
};

/** Pod-level spec fields besides the container. Left out when empty, so template hashes and Pod names stay stable. */
export type PodSpec = {
  /** Left out when Always, the default. */
  restartPolicy?: "OnFailure" | "Never";
  volumes?: Volume[];
  serviceAccountName?: string;
  nodeName?: string;
  nodeSelector?: Labels;
  tolerations?: Toleration[];
  affinity?: Affinity;
};

export type PodTemplate = { labels: Labels; annotations?: Labels; image: string; container: Container; spec?: PodSpec };

/** Kinds that own Pods. */
export type PodOwnerKind = "ReplicaSet" | "Job" | "DaemonSet" | "StatefulSet";

export type Pod = {
  kind: "Pod";
  metadata: Meta;
  /** Name of the owning controller, if any. */
  owner?: string;
  /** Kind of the owner; absent means ReplicaSet. */
  ownerKind?: PodOwnerKind;
  image: string;
  container: Container;
  spec?: PodSpec;
  /** "" until the scheduler binds the Pod. */
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

export type Node = {
  kind: "Node";
  metadata: Meta;
  taints: Taint[];
  unschedulable: boolean;
  allocatable: { cpu: string; memory: string; pods: number };
};

export type LimitRangeItem = {
  type: "Container" | "Pod" | "PersistentVolumeClaim";
  default?: ResourceList;
  defaultRequest?: ResourceList;
  min?: ResourceList;
  max?: ResourceList;
};

export type LimitRange = { kind: "LimitRange"; metadata: Meta; limits: LimitRangeItem[] };

/** `hard` maps a quota key such as "pods" or "requests.cpu" to its limit, as written. */
export type ResourceQuota = { kind: "ResourceQuota"; metadata: Meta; hard: Record<string, string> };

export type JobSpec = {
  completions: number;
  parallelism: number;
  backoffLimit: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  template: PodTemplate;
};

export type Job = JobSpec & {
  kind: "Job";
  metadata: Meta;
  /** Name of the CronJob that created it, if any. */
  owner?: string;
  /** Set once the Job is Complete or Failed. */
  finished?: { type: "Complete" | "Failed"; reason?: string; message?: string; at: number; succeeded: number; failed: number };
};

export type CronJob = {
  kind: "CronJob";
  metadata: Meta;
  schedule: string;
  timeZone?: string;
  suspend: boolean;
  concurrencyPolicy: "Allow" | "Forbid" | "Replace";
  successfulJobsHistoryLimit: number;
  failedJobsHistoryLimit: number;
  jobTemplate: JobSpec;
  /** Clock of the last schedule time the controller has looked at. */
  checkedAt: number;
  lastScheduleTime?: number;
};

export type DaemonSet = {
  kind: "DaemonSet";
  metadata: Meta;
  selector: Labels;
  template: PodTemplate;
  updateStrategy: { type: "RollingUpdate" | "OnDelete"; maxUnavailable: number | string };
};

export type AccessMode = "ReadWriteOnce" | "ReadOnlyMany" | "ReadWriteMany" | "ReadWriteOncePod";

export type ClaimTemplate = { name: string; labels?: Labels; accessModes: AccessMode[]; storage: string; storageClassName?: string };

export type StatefulSet = {
  kind: "StatefulSet";
  metadata: Meta;
  serviceName: string;
  replicas: number;
  selector: Labels;
  template: PodTemplate;
  volumeClaimTemplates: ClaimTemplate[];
  podManagementPolicy: "OrderedReady" | "Parallel";
};

export type ReclaimPolicy = "Delete" | "Retain";

export type StorageClass = {
  kind: "StorageClass";
  metadata: Meta;
  provisioner: string;
  reclaimPolicy: ReclaimPolicy;
  volumeBindingMode: "Immediate" | "WaitForFirstConsumer";
  allowVolumeExpansion: boolean;
};

export type PersistentVolume = {
  kind: "PersistentVolume";
  metadata: Meta;
  capacity: string;
  accessModes: AccessMode[];
  reclaimPolicy: ReclaimPolicy;
  /** "" means no class. */
  storageClassName: string;
  hostPath?: { path: string };
  /** Node a local volume lives on; Pods using it must run there. */
  node?: string;
  claimRef?: { namespace: string; name: string; uid: string };
  phase: "Available" | "Bound" | "Released";
  terminating?: boolean;
};

export type PersistentVolumeClaim = {
  kind: "PersistentVolumeClaim";
  metadata: Meta;
  accessModes: AccessMode[];
  storage: string;
  /** undefined: no class and no default class; "": static PVs without a class only. */
  storageClassName?: string;
  /** The class was filled in from the default class, not written by the user. */
  defaultedClass?: boolean;
  volumeName?: string;
  phase: "Pending" | "Bound";
  /** Deleted while a Pod still uses it (kubernetes.io/pvc-protection). */
  terminating?: boolean;
};

export type Resource =
  | Pod
  | ReplicaSet
  | Deployment
  | Service
  | ConfigMap
  | Secret
  | Node
  | LimitRange
  | ResourceQuota
  | Job
  | CronJob
  | DaemonSet
  | StatefulSet
  | StorageClass
  | PersistentVolume
  | PersistentVolumeClaim;
export type Kind = Resource["kind"];

export type ClusterEvent = {
  /** uid of the involved object, so a new object with the same name starts without old events. */
  uid: string;
  kind: Kind;
  namespace: string;
  name: string;
  type: "Normal" | "Warning";
  reason: string;
  message: string;
  source: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
};

export type Cluster = {
  clock: number;
  seq: number;
  /** Kept apart from `resources`; reach both through find() and list(). */
  nodes: Node[];
  namespaces: string[];
  resources: Exclude<Resource, Node>[];
  events: ClusterEvent[];
  /** Simulated files (name -> text) for ls, cat, redirects and apply -f. */
  files: Record<string, string>;
  /** Files inside containers and volumes: store key (see files.ts) -> path in the store -> text. */
  volumes: Record<string, Record<string, string>>;
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
