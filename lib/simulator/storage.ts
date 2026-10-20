import { age, eventsSection, labelText, pad } from "./cli";
import { find, hash, isFinished, list, meta, removeResource } from "./cluster";
import { eventsOf, recordEvent } from "./events";
import { parseMemory } from "./quantity";
import type { AccessMode, Cluster, Node, PersistentVolume, PersistentVolumeClaim, Pod, StorageClass } from "./types";

export const DEFAULT_CLASS_ANNOTATION = "storageclass.kubernetes.io/is-default-class";
const LOCAL_PATH = "rancher.io/local-path";
const PV_CONTROLLER = "persistentvolume-controller";

/** The class every cluster starts with, like kind's. */
export function defaultStorageClass(c: Cluster): StorageClass {
  return {
    kind: "StorageClass",
    // Not from meta(): its uid must not use c.seq, which names generated Pods.
    metadata: { uid: "sc/standard", name: "standard", namespace: "", labels: {}, annotations: { [DEFAULT_CLASS_ANNOTATION]: "true" }, createdAt: c.clock },
    provisioner: LOCAL_PATH,
    reclaimPolicy: "Delete",
    volumeBindingMode: "WaitForFirstConsumer",
    allowVolumeExpansion: false,
  };
}

export const isDefaultClass = (sc: StorageClass) => sc.metadata.annotations[DEFAULT_CLASS_ANNOTATION] === "true";

/** The newest default class, as the DefaultStorageClass admission plugin picks it. */
export function defaultClassName(c: Cluster): string | undefined {
  return list(c, "StorageClass").filter(isDefaultClass).sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)[0]?.metadata.name;
}

export const claimNames = (p: Pod) => (p.spec?.volumes ?? []).flatMap((v) => (v.persistentVolumeClaim ? [v.persistentVolumeClaim.claimName] : []));

const claimsOf = (c: Cluster, p: Pod) => claimNames(p).map((n) => find(c, "PersistentVolumeClaim", p.metadata.namespace, n));

/** Pods that keep a claim from being deleted (kubernetes.io/pvc-protection). */
export const claimUsers = (c: Cluster, pvc: PersistentVolumeClaim) =>
  list(c, "Pod", pvc.metadata.namespace).filter((p) => !isFinished(p) && claimNames(p).includes(pvc.metadata.name));

/** Why the scheduler cannot place the Pod at all because of its claims, or null. */
export function claimProblem(c: Cluster, p: Pod): string | null {
  for (const name of claimNames(p)) {
    const pvc = find(c, "PersistentVolumeClaim", p.metadata.namespace, name);
    if (!pvc) return `persistentvolumeclaim "${name}" not found`;
    if (pvc.terminating) return `persistentvolumeclaim "${name}" is being deleted`;
    if (pvc.phase === "Bound") continue;
    const sc = pvc.storageClassName ? find(c, "StorageClass", "", pvc.storageClassName) : undefined;
    if (pvc.storageClassName && !sc) return `storageclass.storage.k8s.io "${pvc.storageClassName}" not found`;
    if (sc?.volumeBindingMode !== "WaitForFirstConsumer") return "pod has unbound immediate PersistentVolumeClaims";
  }
  return null;
}

/** Whether a bound local volume of the Pod lives on another node. */
export function volumeNodeConflict(c: Cluster, p: Pod, n: Node): boolean {
  return claimsOf(c, p).some((pvc) => {
    const pv = pvc?.volumeName ? find(c, "PersistentVolume", "", pvc.volumeName) : undefined;
    return !!pv?.node && pv.node !== n.metadata.name;
  });
}

const storageOf = (q: string) => parseMemory(q) ?? 0;

function bind(pv: PersistentVolume, pvc: PersistentVolumeClaim) {
  pv.claimRef = { namespace: pvc.metadata.namespace, name: pvc.metadata.name, uid: pvc.metadata.uid };
  pv.phase = "Bound";
  pvc.volumeName = pv.metadata.name;
  pvc.phase = "Bound";
}

/** A UUID-shaped, deterministic name part, like the API server's PVC uids. */
function uuid(seed: string): string {
  let h = hash(seed);
  let hex = "";
  while (hex.length < 32) {
    hex += h.toString(16).padStart(8, "0");
    h = hash(String(h));
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Binds the claim to the smallest fitting Available PV of its class, or provisions one. `node` is set when
 * a Pod using the claim was just scheduled (WaitForFirstConsumer). Records why the claim waits otherwise.
 */
function tryBind(c: Cluster, pvc: PersistentVolumeClaim, node?: string): boolean {
  const className = pvc.storageClassName ?? "";
  const sc = className ? find(c, "StorageClass", "", className) : undefined;
  if (className && !sc) {
    recordEvent(c, pvc, "Warning", "ProvisioningFailed", `storageclass.storage.k8s.io "${className}" not found`, PV_CONTROLLER);
    return false;
  }
  if (sc?.volumeBindingMode === "WaitForFirstConsumer" && node === undefined) {
    recordEvent(c, pvc, "Normal", "WaitForFirstConsumer", "waiting for first consumer to be created before binding", PV_CONTROLLER);
    return false;
  }
  const want = storageOf(pvc.storage);
  const fits = list(c, "PersistentVolume")
    .filter((pv) => pv.phase === "Available" && !pv.terminating && pv.storageClassName === className && storageOf(pv.capacity) >= want)
    .filter((pv) => pvc.accessModes.every((m) => pv.accessModes.includes(m)))
    .sort((a, b) => storageOf(a.capacity) - storageOf(b.capacity) || (a.metadata.name < b.metadata.name ? -1 : 1));
  if (fits.length) {
    bind(fits[0], pvc);
    return true;
  }
  if (!sc) {
    recordEvent(c, pvc, "Normal", "FailedBinding", "no persistent volumes available for this claim and no storage class is set", PV_CONTROLLER);
    return false;
  }
  const name = `pvc-${uuid(`${pvc.metadata.namespace}/${pvc.metadata.name}/${pvc.metadata.uid}`)}`;
  const local = sc.provisioner === LOCAL_PATH;
  const pv: PersistentVolume = {
    kind: "PersistentVolume",
    metadata: meta(c, name, "", {}, { "pv.kubernetes.io/provisioned-by": sc.provisioner }),
    capacity: pvc.storage,
    accessModes: [...pvc.accessModes],
    reclaimPolicy: sc.reclaimPolicy,
    storageClassName: className,
    ...(local && { hostPath: { path: `/var/local-path-provisioner/${name}_${pvc.metadata.namespace}_${pvc.metadata.name}` }, node }),
    phase: "Available",
  };
  c.resources.push(pv);
  bind(pv, pvc);
  recordEvent(c, pvc, "Normal", "ProvisioningSucceeded", `Successfully provisioned volume ${name}`, sc.provisioner);
  return true;
}

/** Binds the Pod's WaitForFirstConsumer claims once the scheduler picked its node. */
export function bindForPod(c: Cluster, p: Pod, node: string) {
  for (const pvc of claimsOf(c, p)) if (pvc && pvc.phase === "Pending" && !pvc.terminating) tryBind(c, pvc, node);
}

/** Deletes the claim, or marks it Terminating while a Pod still uses it. */
export function deleteClaim(c: Cluster, pvc: PersistentVolumeClaim) {
  if (claimUsers(c, pvc).length) pvc.terminating = true;
  else removeResource(c, pvc);
}

/** Deletes the volume, or marks it Terminating while it is bound (kubernetes.io/pv-protection). */
export function deleteVolume(c: Cluster, pv: PersistentVolume) {
  if (pv.phase === "Bound") pv.terminating = true;
  else removeResource(c, pv);
}

/** The persistent volume controller: finish deletions, reclaim released volumes, bind Immediate claims. */
export function reconcileStorage(c: Cluster) {
  for (const pvc of list(c, "PersistentVolumeClaim")) if (pvc.terminating && !claimUsers(c, pvc).length) removeResource(c, pvc);
  for (const pv of list(c, "PersistentVolume")) {
    const ref = pv.claimRef;
    if (pv.phase === "Bound" && ref && find(c, "PersistentVolumeClaim", ref.namespace, ref.name)?.metadata.uid !== ref.uid) {
      pv.phase = "Released";
      if (pv.reclaimPolicy === "Delete") pv.terminating = true;
    }
    if (pv.terminating && pv.phase !== "Bound") removeResource(c, pv);
  }
  for (const pvc of list(c, "PersistentVolumeClaim")) if (pvc.phase === "Pending" && !pvc.terminating) tryBind(c, pvc);
}

// --- Output ---

const MODE_SHORT: Record<AccessMode, string> = { ReadWriteOnce: "RWO", ReadOnlyMany: "ROX", ReadWriteMany: "RWX", ReadWriteOncePod: "RWOP" };
const modes = (m: AccessMode[]) => m.map((x) => MODE_SHORT[x]).join(",");

export const STORAGE_HEADERS = {
  StorageClass: ["NAME", "PROVISIONER", "RECLAIMPOLICY", "VOLUMEBINDINGMODE", "ALLOWVOLUMEEXPANSION", "AGE"],
  PersistentVolume: ["NAME", "CAPACITY", "ACCESS MODES", "RECLAIM POLICY", "STATUS", "CLAIM", "STORAGECLASS", "VOLUMEATTRIBUTESCLASS", "REASON", "AGE"],
  PersistentVolumeClaim: ["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "VOLUMEATTRIBUTESCLASS", "AGE"],
};

const claimCapacity = (c: Cluster, pvc: PersistentVolumeClaim) =>
  pvc.volumeName ? (find(c, "PersistentVolume", "", pvc.volumeName)?.capacity ?? "") : "";

const pvStatus = (pv: PersistentVolume) => (pv.terminating ? "Terminating" : pv.phase);
const pvcStatus = (pvc: PersistentVolumeClaim) => (pvc.terminating ? "Terminating" : pvc.phase);
const claimText = (pv: PersistentVolume) => (pv.claimRef ? `${pv.claimRef.namespace}/${pv.claimRef.name}` : "");

export function storageRow(c: Cluster, r: StorageClass | PersistentVolume | PersistentVolumeClaim): string[] {
  const created = age(c, r.metadata.createdAt);
  switch (r.kind) {
    case "StorageClass":
      return [`${r.metadata.name}${isDefaultClass(r) ? " (default)" : ""}`, r.provisioner, r.reclaimPolicy, r.volumeBindingMode, String(r.allowVolumeExpansion), created];
    case "PersistentVolume":
      return [r.metadata.name, r.capacity, modes(r.accessModes), r.reclaimPolicy, pvStatus(r), claimText(r), r.storageClassName, "<unset>", "", created];
    case "PersistentVolumeClaim": {
      const bound = r.phase === "Bound";
      return [r.metadata.name, pvcStatus(r), r.volumeName ?? "", claimCapacity(c, r), bound ? modes(r.accessModes) : "", r.storageClassName ?? "", "<unset>", created];
    }
  }
}

export function storageManifest(c: Cluster, r: StorageClass | PersistentVolume | PersistentVolumeClaim, metadata: Record<string, unknown>, live: boolean) {
  switch (r.kind) {
    case "StorageClass":
      return {
        apiVersion: "storage.k8s.io/v1", kind: "StorageClass", metadata,
        provisioner: r.provisioner, reclaimPolicy: r.reclaimPolicy, volumeBindingMode: r.volumeBindingMode, allowVolumeExpansion: r.allowVolumeExpansion,
      };
    case "PersistentVolume":
      return {
        apiVersion: "v1", kind: "PersistentVolume", metadata,
        spec: {
          capacity: { storage: r.capacity },
          accessModes: r.accessModes,
          persistentVolumeReclaimPolicy: r.reclaimPolicy,
          storageClassName: r.storageClassName,
          hostPath: r.hostPath,
          ...(live && r.claimRef && { claimRef: { kind: "PersistentVolumeClaim", ...r.claimRef } }),
          ...(r.node && { nodeAffinity: { required: { nodeSelectorTerms: [{ matchExpressions: [{ key: "kubernetes.io/hostname", operator: "In", values: [r.node] }] }] } } }),
        },
        ...(live && { status: { phase: r.phase } }),
      };
    case "PersistentVolumeClaim":
      return {
        apiVersion: "v1", kind: "PersistentVolumeClaim", metadata,
        spec: {
          accessModes: r.accessModes,
          resources: { requests: { storage: r.storage } },
          storageClassName: r.storageClassName,
          volumeName: live ? r.volumeName : undefined,
        },
        ...(live && { status: { phase: r.phase, ...(r.phase === "Bound" && { accessModes: r.accessModes, capacity: { storage: claimCapacity(c, r) } }) } }),
      };
  }
}

export function describeStorage(c: Cluster, r: StorageClass | PersistentVolume | PersistentVolumeClaim): string {
  const annotations = Object.entries(r.metadata.annotations).map(([k, v]) => `${k}=${v}`).join(",") || "<none>";
  let body: string;
  switch (r.kind) {
    case "StorageClass":
      body = pad([
        ["Name", r.metadata.name],
        ["IsDefaultClass", isDefaultClass(r) ? "Yes" : "No"],
        ["Annotations", annotations],
        ["Provisioner", r.provisioner],
        ["Parameters", "<none>"],
        ["AllowVolumeExpansion", String(r.allowVolumeExpansion)],
        ["MountOptions", "<none>"],
        ["ReclaimPolicy", r.reclaimPolicy],
        ["VolumeBindingMode", r.volumeBindingMode],
      ]);
      break;
    case "PersistentVolume":
      body = [
        pad([
          ["Name", r.metadata.name],
          ["Labels", labelText(r.metadata.labels)],
          ["Annotations", annotations],
          ["Finalizers", "[kubernetes.io/pv-protection]"],
          ["StorageClass", r.storageClassName],
          ["Status", pvStatus(r)],
          ["Claim", claimText(r)],
          ["Reclaim Policy", r.reclaimPolicy],
          ["Access Modes", modes(r.accessModes)],
          ["VolumeMode", "Filesystem"],
          ["Capacity", r.capacity],
          ["Node Affinity", r.node ? "" : "<none>"],
        ]),
        ...(r.node ? ["  Required Terms:", `    Term 0:        kubernetes.io/hostname in [${r.node}]`] : []),
        pad([["Message", ""]]),
        "Source:",
        r.hostPath ? `    Type:          HostPath (bare host directory volume)\n    Path:          ${r.hostPath.path}\n    HostPathType:  ` : "    Type:  <unknown>",
      ].join("\n");
      break;
    case "PersistentVolumeClaim": {
      const bound = r.phase === "Bound";
      body = pad([
        ["Name", r.metadata.name],
        ["Namespace", r.metadata.namespace],
        ["StorageClass", r.storageClassName ?? ""],
        ["Status", pvcStatus(r)],
        ["Volume", r.volumeName ?? ""],
        ["Labels", labelText(r.metadata.labels)],
        ["Annotations", annotations],
        ["Finalizers", "[kubernetes.io/pvc-protection]"],
        ["Capacity", claimCapacity(c, r)],
        ["Access Modes", bound ? modes(r.accessModes) : ""],
        ["VolumeMode", "Filesystem"],
        ["Used By", claimUsers(c, r).map((p) => p.metadata.name).join("\n               ") || "<none>"],
      ]);
      break;
    }
  }
  return `${body}\n${eventsSection(c, eventsOf(c, r))}`;
}

/** storageClassName of a new claim: as written, else the default class (marked as defaulted), else none. */
export function claimClass(c: Cluster, written: string | undefined): Pick<PersistentVolumeClaim, "storageClassName" | "defaultedClass"> {
  if (written !== undefined) return { storageClassName: written };
  const def = defaultClassName(c);
  return def === undefined ? {} : { storageClassName: def, defaultedClass: true };
}
