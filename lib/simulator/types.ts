export type Labels = Record<string, string>;

export type Meta = {
  uid: string;
  name: string;
  namespace: string;
  labels: Labels;
  /** Simulated seconds since the cluster clock started. */
  createdAt: number;
};

export type PodStatus = "ContainerCreating" | "Running" | "CrashLoopBackOff" | "ImagePullBackOff";

export type PodTemplate = { labels: Labels; image: string };

export type Pod = {
  kind: "Pod";
  metadata: Meta;
  /** Name of the owning ReplicaSet, if any. */
  owner?: string;
  image: string;
  node: string;
  status: PodStatus;
  restarts: number;
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

export type Deployment = {
  kind: "Deployment";
  metadata: Meta;
  replicas: number;
  selector: Labels;
  template: PodTemplate;
};

export type Resource = Pod | ReplicaSet | Deployment;
export type Kind = Resource["kind"];

export type Cluster = {
  clock: number;
  seq: number;
  nodes: string[];
  namespaces: string[];
  resources: Resource[];
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
};

export type RunResult = { cluster: Cluster; output: string; error: boolean };
