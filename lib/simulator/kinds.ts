import type { Kind } from "./types";

export type ResourceType = Kind | "Namespace" | "Endpoints" | "Event";

/** Names kubectl accepts for each type: short, singular, plural. */
export const TYPES: Record<string, ResourceType> = {
  po: "Pod", pod: "Pod", pods: "Pod",
  rs: "ReplicaSet", replicaset: "ReplicaSet", replicasets: "ReplicaSet",
  deploy: "Deployment", deployment: "Deployment", deployments: "Deployment",
  svc: "Service", service: "Service", services: "Service",
  ep: "Endpoints", endpoints: "Endpoints",
  cm: "ConfigMap", configmap: "ConfigMap", configmaps: "ConfigMap",
  secret: "Secret", secrets: "Secret",
  ns: "Namespace", namespace: "Namespace", namespaces: "Namespace",
  no: "Node", node: "Node", nodes: "Node",
  limits: "LimitRange", limitrange: "LimitRange", limitranges: "LimitRange",
  quota: "ResourceQuota", resourcequota: "ResourceQuota", resourcequotas: "ResourceQuota",
  ev: "Event", event: "Event", events: "Event",
  job: "Job", jobs: "Job",
  cj: "CronJob", cronjob: "CronJob", cronjobs: "CronJob",
  ds: "DaemonSet", daemonset: "DaemonSet", daemonsets: "DaemonSet",
  sts: "StatefulSet", statefulset: "StatefulSet", statefulsets: "StatefulSet",
  pv: "PersistentVolume", persistentvolume: "PersistentVolume", persistentvolumes: "PersistentVolume",
  pvc: "PersistentVolumeClaim", persistentvolumeclaim: "PersistentVolumeClaim", persistentvolumeclaims: "PersistentVolumeClaim",
  sc: "StorageClass", storageclass: "StorageClass", storageclasses: "StorageClass",
  ing: "Ingress", ingress: "Ingress", ingresses: "Ingress",
  ingressclass: "IngressClass", ingressclasses: "IngressClass",
  netpol: "NetworkPolicy", networkpolicy: "NetworkPolicy", networkpolicies: "NetworkPolicy",
  sa: "ServiceAccount", serviceaccount: "ServiceAccount", serviceaccounts: "ServiceAccount",
  role: "Role", roles: "Role",
  clusterrole: "ClusterRole", clusterroles: "ClusterRole",
  rolebinding: "RoleBinding", rolebindings: "RoleBinding",
  clusterrolebinding: "ClusterRoleBinding", clusterrolebindings: "ClusterRoleBinding",
};

export const PLURAL: Record<ResourceType, string> = {
  Pod: "pods", ReplicaSet: "replicasets", Deployment: "deployments", Namespace: "namespaces", Node: "nodes",
  Service: "services", Endpoints: "endpoints", ConfigMap: "configmaps", Secret: "secrets",
  LimitRange: "limitranges", ResourceQuota: "resourcequotas", Event: "events",
  Job: "jobs", CronJob: "cronjobs", DaemonSet: "daemonsets", StatefulSet: "statefulsets",
  PersistentVolume: "persistentvolumes", PersistentVolumeClaim: "persistentvolumeclaims", StorageClass: "storageclasses",
  Ingress: "ingresses", IngressClass: "ingressclasses", NetworkPolicy: "networkpolicies", ServiceAccount: "serviceaccounts",
  Role: "roles", ClusterRole: "clusterroles", RoleBinding: "rolebindings", ClusterRoleBinding: "clusterrolebindings",
};

const NETWORKING = "networking.k8s.io";
const RBAC = "rbac.authorization.k8s.io";

/** `<singular>.<api group>` as kubectl prints it in `deployment.apps/web created`. */
export const GROUP: Record<ResourceType, string> = {
  Pod: "pod", ReplicaSet: "replicaset.apps", Deployment: "deployment.apps", Namespace: "namespace", Node: "node",
  Service: "service", Endpoints: "endpoints", ConfigMap: "configmap", Secret: "secret",
  LimitRange: "limitrange", ResourceQuota: "resourcequota", Event: "event",
  Job: "job.batch", CronJob: "cronjob.batch", DaemonSet: "daemonset.apps", StatefulSet: "statefulset.apps",
  PersistentVolume: "persistentvolume", PersistentVolumeClaim: "persistentvolumeclaim", StorageClass: "storageclass.storage.k8s.io",
  Ingress: `ingress.${NETWORKING}`, IngressClass: `ingressclass.${NETWORKING}`, NetworkPolicy: `networkpolicy.${NETWORKING}`,
  ServiceAccount: "serviceaccount", Role: `role.${RBAC}`, ClusterRole: `clusterrole.${RBAC}`,
  RoleBinding: `rolebinding.${RBAC}`, ClusterRoleBinding: `clusterrolebinding.${RBAC}`,
};

/** The API group of a type, "" for the core group. */
export const apiGroup = (type: ResourceType) => {
  const dot = GROUP[type].indexOf(".");
  return dot === -1 ? "" : GROUP[type].slice(dot + 1);
};

/** `deployments.apps`, `jobs.batch`, `pods`: the resource name the API uses in errors. */
export const apiName = (type: ResourceType) => (apiGroup(type) ? `${PLURAL[type]}.${apiGroup(type)}` : PLURAL[type]);
