import { admit } from "./admission";
import { age, annotationText, labelText, pad } from "./cli";
import { find, isReady, list, meta, podsOfOwner, removeResource, spawnPod, suffix, templateHash } from "./cluster";
import { recordEvent } from "./events";
import { podTemplateLines } from "./podtext";
import { nodeMismatch } from "./scheduler";
import { claimClass } from "./storage";
import type { Cluster, DaemonSet, Node, PersistentVolumeClaim, Pod, PodTemplate, StatefulSet, Toleration } from "./types";

const HOSTNAME = "kubernetes.io/hostname";
export const REVISION_LABEL = "controller-revision-hash";
const DS_CONTROLLER = "daemonset-controller";
const STS_CONTROLLER = "statefulset-controller";

/** Tolerations the DaemonSet controller adds to every Pod, so daemons survive node conditions and cordons. */
const DAEMON_TOLERATIONS: Toleration[] = [
  { key: "node.kubernetes.io/not-ready", operator: "Exists", effect: "NoExecute" },
  { key: "node.kubernetes.io/unreachable", operator: "Exists", effect: "NoExecute" },
  { key: "node.kubernetes.io/disk-pressure", operator: "Exists", effect: "NoSchedule" },
  { key: "node.kubernetes.io/memory-pressure", operator: "Exists", effect: "NoSchedule" },
  { key: "node.kubernetes.io/pid-pressure", operator: "Exists", effect: "NoSchedule" },
  { key: "node.kubernetes.io/unschedulable", operator: "Exists", effect: "NoSchedule" },
];

const withDaemonTolerations = (t: PodTemplate) => ({ ...t.spec, tolerations: [...(t.spec?.tolerations ?? []), ...DAEMON_TOLERATIONS] });

/** Nodes that should run one of the DaemonSet's Pods: nodeSelector, required affinity and taints allow it. */
export const eligibleNodes = (c: Cluster, ds: DaemonSet): Node[] => list(c, "Node").filter((n) => nodeMismatch(withDaemonTolerations(ds.template), n) === null);

/** The node a DaemonSet Pod is pinned to through its node affinity. */
const targetNode = (p: Pod) =>
  p.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms[0]?.matchExpressions?.find((e) => e.key === HOSTNAME)?.values?.[0];

function daemonTemplate(ds: DaemonSet, node: string, revision: string): PodTemplate {
  const t = structuredClone(ds.template);
  t.labels = { ...t.labels, [REVISION_LABEL]: revision };
  const spec = (t.spec = withDaemonTolerations(t));
  const nodeAffinity = ((spec.affinity ??= {}).nodeAffinity ??= {});
  const terms = nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms ?? [{}];
  const pin = { key: HOSTNAME, operator: "In" as const, values: [node] };
  nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution = { nodeSelectorTerms: terms.map((term) => ({ matchExpressions: [pin, ...(term.matchExpressions ?? [])] })) };
  return t;
}

const scaledUp = (value: number | string, total: number) => (typeof value === "number" ? value : Math.ceil((total * parseInt(value, 10)) / 100));

const sortByUid = (pods: Pod[]) => [...pods].sort((a, b) => Number(a.metadata.uid) - Number(b.metadata.uid));

export function reconcileDaemonSet(c: Cluster, ds: DaemonSet) {
  const { name, namespace } = ds.metadata;
  const revision = templateHash(ds.template);
  const nodes = eligibleNodes(c, ds).map((n) => n.metadata.name);
  const remove = (p: Pod) => {
    removeResource(c, p);
    recordEvent(c, ds, "Normal", "SuccessfulDelete", `Deleted pod: ${p.metadata.name}`, DS_CONTROLLER);
  };
  const byNode = new Map<string, Pod>();
  for (const p of sortByUid(podsOfOwner(c, "DaemonSet", namespace, name) ?? [])) {
    const node = targetNode(p);
    if (!node || !nodes.includes(node) || byNode.has(node)) remove(p);
    else byNode.set(node, p);
  }
  if (ds.updateStrategy.type === "RollingUpdate") {
    const max = Math.max(1, scaledUp(ds.updateStrategy.maxUnavailable, nodes.length));
    const ready = (node: string) => !!byNode.get(node) && isReady(byNode.get(node)!);
    let unavailable = nodes.filter((n) => !ready(n)).length;
    for (const node of nodes) {
      const p = byNode.get(node);
      if (!p || p.metadata.labels[REVISION_LABEL] === revision) continue;
      // Replacing a Pod that is not ready does not make anything less available.
      if (isReady(p) && unavailable >= max) continue;
      if (isReady(p)) unavailable++;
      remove(p);
      byNode.delete(node);
    }
  }
  for (const node of nodes) {
    if (!byNode.has(node)) spawnPod(c, ds, `${name}-${suffix(c.seq, 5)}`, daemonTemplate(ds, node, revision), DS_CONTROLLER);
  }
}

export function daemonSetStatus(c: Cluster, ds: DaemonSet) {
  const nodes = eligibleNodes(c, ds).map((n) => n.metadata.name);
  const pods = (podsOfOwner(c, "DaemonSet", ds.metadata.namespace, ds.metadata.name) ?? []).filter((p) => nodes.includes(targetNode(p) ?? ""));
  const revision = templateHash(ds.template);
  const ready = pods.filter(isReady).length;
  return { desired: nodes.length, current: pods.length, ready, updated: pods.filter((p) => p.metadata.labels[REVISION_LABEL] === revision).length, available: ready };
}

// --- StatefulSets ---

export const ordinalOf = (s: StatefulSet, p: Pod) => Number(p.metadata.name.slice(s.metadata.name.length + 1));

const stsRevision = (s: StatefulSet) => `${s.metadata.name}-${templateHash(s.template)}`;

function statefulTemplate(s: StatefulSet, i: number): PodTemplate {
  const t = structuredClone(s.template);
  const podName = `${s.metadata.name}-${i}`;
  t.labels = { ...t.labels, [REVISION_LABEL]: stsRevision(s), "statefulset.kubernetes.io/pod-name": podName, "apps.kubernetes.io/pod-index": String(i) };
  if (s.volumeClaimTemplates.length) {
    const spec = (t.spec ??= {});
    const claims = s.volumeClaimTemplates.map((tpl) => ({ name: tpl.name, persistentVolumeClaim: { claimName: `${tpl.name}-${podName}` } }));
    spec.volumes = [...(spec.volumes ?? []).filter((v) => !claims.some((x) => x.name === v.name)), ...claims];
  }
  return t;
}

/** Creates the Pod's claims from volumeClaimTemplates; they are kept on scale down and on delete. */
function ensureClaims(c: Cluster, s: StatefulSet, i: number): boolean {
  const { name: sts, namespace } = s.metadata;
  const pod = `${sts}-${i}`;
  for (const tpl of s.volumeClaimTemplates) {
    const name = `${tpl.name}-${pod}`;
    if (find(c, "PersistentVolumeClaim", namespace, name)) continue;
    const seq = c.seq;
    const pvc: PersistentVolumeClaim = {
      kind: "PersistentVolumeClaim",
      metadata: meta(c, name, namespace, { ...s.selector, ...tpl.labels }),
      accessModes: [...tpl.accessModes],
      storage: tpl.storage,
      ...claimClass(c, tpl.storageClassName),
      phase: "Pending",
    };
    const denied = admit(c, pvc);
    if (denied) {
      c.seq = seq;
      recordEvent(c, s, "Warning", "FailedCreate", `create Claim ${name} for Pod ${pod} in StatefulSet ${sts} failed error: persistentvolumeclaims "${name}" is forbidden: ${denied}`, STS_CONTROLLER);
      return false;
    }
    c.resources.push(pvc);
    recordEvent(c, s, "Normal", "SuccessfulCreate", `create Claim ${name} Pod ${pod} in StatefulSet ${sts} success`, STS_CONTROLLER);
  }
  return true;
}

// shortcut: no partitions, maxUnavailable or OnDelete for StatefulSet updates; a template change replaces Pods from the highest ordinal down, one ready Pod at a time.
export function reconcileStatefulSet(c: Cluster, s: StatefulSet) {
  const { name, namespace } = s.metadata;
  const ordered = s.podManagementPolicy === "OrderedReady";
  const pods = podsOfOwner(c, "StatefulSet", namespace, name) ?? [];
  const remove = (p: Pod) => {
    removeResource(c, p);
    recordEvent(c, s, "Normal", "SuccessfulDelete", `delete Pod ${p.metadata.name} in StatefulSet ${name} successful`, STS_CONTROLLER);
  };
  const extra = pods.filter((p) => ordinalOf(s, p) >= s.replicas).sort((a, b) => ordinalOf(s, b) - ordinalOf(s, a));
  for (const p of ordered ? extra.slice(0, 1) : extra) remove(p);
  if (ordered && extra.length) return;

  const byOrdinal = new Map(pods.map((p) => [ordinalOf(s, p), p]));
  let created = false;
  for (let i = 0; i < s.replicas; i++) {
    const p = byOrdinal.get(i);
    if (p) {
      if (ordered && !isReady(p)) return;
      continue;
    }
    if (!ensureClaims(c, s, i) || !spawnPod(c, s, `${name}-${i}`, statefulTemplate(s, i), STS_CONTROLLER, `create Pod ${name}-${i} in StatefulSet ${name} successful`)) return;
    created = true;
    if (ordered) return;
  }
  if (created) return;
  const current = Array.from({ length: s.replicas }, (_, i) => byOrdinal.get(i)!);
  if (!current.every(isReady)) return;
  const outdated = current.filter((p) => p.metadata.labels[REVISION_LABEL] !== stsRevision(s)).pop();
  if (outdated) remove(outdated);
}

export function statefulSetStatus(c: Cluster, s: StatefulSet) {
  const pods = podsOfOwner(c, "StatefulSet", s.metadata.namespace, s.metadata.name) ?? [];
  const revision = stsRevision(s);
  return { total: pods.length, ready: pods.filter(isReady).length, updated: pods.filter((p) => p.metadata.labels[REVISION_LABEL] === revision).length, revision };
}

// --- Output ---

export const DAEMONSET_HEADER = ["NAME", "DESIRED", "CURRENT", "READY", "UP-TO-DATE", "AVAILABLE", "NODE SELECTOR", "AGE"];
export const STATEFULSET_HEADER = ["NAME", "READY", "AGE"];

export function daemonSetRow(c: Cluster, ds: DaemonSet, wide: boolean): string[] {
  const s = daemonSetStatus(c, ds);
  const row = [ds.metadata.name, ...[s.desired, s.current, s.ready, s.updated, s.available].map(String), labelText(ds.template.spec?.nodeSelector ?? {}), age(c, ds.metadata.createdAt)];
  return wide ? [...row, ds.template.container.name, ds.template.image, labelText(ds.selector)] : row;
}

export function statefulSetRow(c: Cluster, s: StatefulSet, wide: boolean): string[] {
  const row = [s.metadata.name, `${statefulSetStatus(c, s).ready}/${s.replicas}`, age(c, s.metadata.createdAt)];
  return wide ? [...row, s.template.container.name, s.template.image] : row;
}

export function daemonSetManifest(c: Cluster, ds: DaemonSet, metadata: Record<string, unknown>, template: object, live: boolean) {
  const s = daemonSetStatus(c, ds);
  const { type, maxUnavailable } = ds.updateStrategy;
  return {
    apiVersion: "apps/v1",
    kind: "DaemonSet",
    metadata,
    spec: { selector: { matchLabels: ds.selector }, template, updateStrategy: type === "OnDelete" ? { type } : { type, rollingUpdate: { maxUnavailable } } },
    ...(live && { status: { desiredNumberScheduled: s.desired, currentNumberScheduled: s.current, numberReady: s.ready, updatedNumberScheduled: s.updated, numberAvailable: s.available } }),
  };
}

export function statefulSetManifest(c: Cluster, s: StatefulSet, metadata: Record<string, unknown>, template: object, live: boolean) {
  const st = statefulSetStatus(c, s);
  return {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata,
    spec: {
      serviceName: s.serviceName || undefined,
      replicas: s.replicas,
      selector: { matchLabels: s.selector },
      podManagementPolicy: s.podManagementPolicy,
      template,
      volumeClaimTemplates: s.volumeClaimTemplates.length
        ? s.volumeClaimTemplates.map((t) => ({
            metadata: { name: t.name, labels: t.labels },
            spec: { accessModes: t.accessModes, resources: { requests: { storage: t.storage } }, storageClassName: t.storageClassName },
          }))
        : undefined,
    },
    ...(live && { status: { replicas: st.total, readyReplicas: st.ready, currentReplicas: st.updated, updatedReplicas: st.updated, currentRevision: st.revision } }),
  };
}

const head = (r: DaemonSet | StatefulSet): [string, string][] => [
  ["Name", r.metadata.name],
  ["Namespace", r.metadata.namespace],
  ["Selector", labelText(r.selector)],
  ["Labels", labelText(r.metadata.labels)],
  ["Annotations", annotationText(r.metadata.annotations)],
];

export function describeDaemonSet(c: Cluster, ds: DaemonSet): string {
  const s = daemonSetStatus(c, ds);
  const pods = podsOfOwner(c, "DaemonSet", ds.metadata.namespace, ds.metadata.name) ?? [];
  const running = pods.filter((p) => p.status === "Running").length;
  return [
    pad([
      ...head(ds),
      ["Node-Selector", labelText(ds.template.spec?.nodeSelector ?? {})],
      ["Desired Number of Nodes Scheduled", String(s.desired)],
      ["Current Number of Nodes Scheduled", String(s.current)],
      ["Number of Nodes Scheduled with Up-to-date Pods", String(s.updated)],
      ["Number of Nodes Scheduled with Available Pods", String(s.available)],
      ["Number of Nodes Misscheduled", "0"],
      ["Pods Status", `${running} Running / ${pods.length - running} Waiting / 0 Succeeded / 0 Failed`],
    ]),
    "Pod Template:",
    ...podTemplateLines(ds.template),
  ].join("\n");
}

export function describeStatefulSet(c: Cluster, s: StatefulSet): string {
  const pods = podsOfOwner(c, "StatefulSet", s.metadata.namespace, s.metadata.name) ?? [];
  const running = pods.filter((p) => p.status === "Running").length;
  const claims = s.volumeClaimTemplates.flatMap((t) => [
    `  Name:          ${t.name}`,
    `  StorageClass:  ${t.storageClassName ?? ""}`,
    `  Labels:        ${labelText(t.labels ?? {})}`,
    "  Annotations:   <none>",
    `  Capacity:      ${t.storage}`,
    `  Access Modes:  ${t.accessModes.join(", ")}`,
  ]);
  return [
    pad([
      ...head(s),
      ["Replicas", `${s.replicas} desired | ${pods.length} total`],
      ["Update Strategy", "RollingUpdate"],
      ["  Partition", "0"],
      ["Pods Status", `${running} Running / ${pods.length - running} Waiting / 0 Succeeded / 0 Failed`],
    ]),
    "Pod Template:",
    ...podTemplateLines(s.template),
    ...(claims.length ? ["Volume Claims:", ...claims] : ["Volume Claims:  <none>"]),
  ].join("\n");
}

/** `kubectl rollout status` text for a DaemonSet or StatefulSet, and whether it is still in progress. */
export function setRolloutStatus(c: Cluster, r: DaemonSet | StatefulSet): { message: string; done: boolean } {
  if (r.kind === "DaemonSet") {
    const s = daemonSetStatus(c, r);
    const waiting = `Waiting for daemon set "${r.metadata.name}" rollout to finish: `;
    if (s.updated < s.desired) return { message: `${waiting}${s.updated} out of ${s.desired} new pods have been updated...`, done: false };
    if (s.available < s.desired) return { message: `${waiting}${s.available} of ${s.desired} updated pods are available...`, done: false };
    return { message: `daemon set "${r.metadata.name}" successfully rolled out`, done: true };
  }
  const s = statefulSetStatus(c, r);
  if (s.ready < r.replicas) return { message: `Waiting for ${r.replicas - s.ready} pods to be ready...`, done: false };
  if (s.updated < r.replicas) return { message: `waiting for statefulset rolling update to complete ${s.updated} pods at revision ${s.revision}...`, done: false };
  return { message: `statefulset rolling update complete ${r.replicas} pods at revision ${s.revision}...`, done: true };
}
