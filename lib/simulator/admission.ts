import { isFinished, list } from "./cluster";
import { serviceAccountError } from "./rbac";
import { formatQuantity, parseQuantity, type ResourceName } from "./quantity";
import type { Cluster, Container, LimitRangeItem, Pod, Resource, ResourceQuota } from "./types";

const RESOURCES: ResourceName[] = ["cpu", "memory"];

/** Like the API server's defaulting: a request left out but limited defaults to the limit. */
export function withDefaultRequests(ctr: Container): Container {
  const limits = ctr.resources?.limits;
  if (!limits) return ctr;
  const requests = { ...limits, ...ctr.resources!.requests };
  ctr.resources = { ...ctr.resources, requests };
  return ctr;
}

/** Fills LimitRange fields the API server defaults: default from max, defaultRequest from default, then min. */
export function defaultLimitRangeItem(item: LimitRangeItem): LimitRangeItem {
  if (item.type !== "Container") return item;
  const def = { ...item.max, ...item.default };
  const defaultRequest = { ...item.min, ...def, ...item.defaultRequest };
  return { ...item, ...(Object.keys(def).length && { default: def }), ...(Object.keys(defaultRequest).length && { defaultRequest }) };
}

const canonical = (name: ResourceName, q: string) => formatQuantity(name, parseQuantity(name, q)!);

/** Applies LimitRange defaults to the Pod's container and returns the rejection reason, if any. */
function limitRanges(c: Cluster, pod: Pod): string | null {
  const errors: string[] = [];
  for (const lr of list(c, "LimitRange", pod.metadata.namespace)) {
    for (const item of lr.limits) {
      if (item.type !== "Container") continue;
      const res = (pod.container.resources = { ...pod.container.resources });
      res.limits = { ...item.default, ...res.limits };
      res.requests = { ...item.defaultRequest, ...res.requests };
      for (const r of RESOURCES) {
        const req = res.requests[r];
        const lim = res.limits[r];
        const value = (q?: string) => (q === undefined ? undefined : parseQuantity(r, q)!);
        const min = item.min?.[r];
        if (min !== undefined) {
          if (req === undefined) errors.push(`minimum ${r} usage per Container is ${canonical(r, min)}.  No request is specified`);
          else if (value(req)! < value(min)!) errors.push(`minimum ${r} usage per Container is ${canonical(r, min)}, but request is ${canonical(r, req)}`);
        }
        const max = item.max?.[r];
        if (max !== undefined) {
          if (lim === undefined) errors.push(`maximum ${r} usage per Container is ${canonical(r, max)}.  No limit is specified`);
          else if (value(lim)! > value(max)!) errors.push(`maximum ${r} usage per Container is ${canonical(r, max)}, but limit is ${canonical(r, lim)}`);
        }
      }
      if (!Object.keys(res.limits).length) delete res.limits;
      if (!Object.keys(res.requests).length) delete res.requests;
    }
  }
  if (!errors.length) return null;
  return errors.length === 1 ? errors[0] : `[${errors.join(", ")}]`;
}

/** ResourceQuota keys that count objects, by kind. Part B adds persistentvolumeclaims here. */
const COUNTED: Record<string, string> = {
  pods: "Pod",
  services: "Service",
  configmaps: "ConfigMap",
  secrets: "Secret",
  persistentvolumeclaims: "PersistentVolumeClaim",
  "count/deployments.apps": "Deployment",
};
const COMPUTE = ["requests.cpu", "requests.memory", "limits.cpu", "limits.memory"] as const;
type ComputeKey = (typeof COMPUTE)[number];
export const QUOTA_KEYS = [...Object.keys(COUNTED), ...COMPUTE];

const isCompute = (key: string): key is ComputeKey => (COMPUTE as readonly string[]).includes(key);
const resourceOf = (key: ComputeKey) => key.split(".")[1] as ResourceName;

/** Parses one `hard` value, or null when invalid. */
export function parseHard(key: string, value: string): number | null {
  if (isCompute(key)) return parseQuantity(resourceOf(key), value);
  return /^\d+$/.test(value) ? Number(value) : null;
}

export const formatHard = (key: string, n: number) => (isCompute(key) ? formatQuantity(resourceOf(key), n) : String(n));

function podAmount(p: Pod, key: string): number {
  if (key === "pods") return 1;
  if (!isCompute(key)) return 0;
  const [field, name] = key.split(".") as ["requests" | "limits", ResourceName];
  const q = p.container.resources?.[field]?.[name];
  return q === undefined ? 0 : (parseQuantity(name, q) ?? 0);
}

/** How much of `key` a new object would use. */
function amount(r: Resource, key: string): number {
  if (r.kind === "Pod") return podAmount(r, key);
  return COUNTED[key] === r.kind ? 1 : 0;
}

/** Current usage of one quota key in the quota's namespace. */
export function quotaUsed(c: Cluster, q: ResourceQuota, key: string): number {
  const ns = q.metadata.namespace;
  const pods = list(c, "Pod", ns).filter((p) => !isFinished(p));
  if (key === "pods" || isCompute(key)) return pods.reduce((n, p) => n + podAmount(p, key), 0);
  return c.resources.filter((r) => r.kind === COUNTED[key] && r.metadata.namespace === ns).length;
}

function quotas(c: Cluster, r: Resource): string | null {
  for (const q of list(c, "ResourceQuota", r.metadata.namespace)) {
    const keys = Object.keys(q.hard).sort();
    if (r.kind === "Pod") {
      const missing = keys.filter(isCompute).filter((k) => r.container.resources?.[k.startsWith("requests") ? "requests" : "limits"]?.[resourceOf(k)] === undefined);
      if (missing.length) return `failed quota: ${q.metadata.name}: must specify ${missing.map((k) => `${k} for: ${r.container.name}`).join("; ")}`;
    }
    const over = keys.filter((k) => {
      const want = amount(r, k);
      return want > 0 && quotaUsed(c, q, k) + want > parseHard(k, q.hard[k])!;
    });
    if (over.length) {
      const show = (f: (k: string) => number) => over.map((k) => `${k}=${formatHard(k, f(k))}`).join(",");
      return `exceeded quota: ${q.metadata.name}, requested: ${show((k) => amount(r, k))}, used: ${show((k) => quotaUsed(c, q, k))}, limited: ${show((k) => parseHard(k, q.hard[k])!)}`;
    }
  }
  return null;
}

/**
 * Admission for a new object, in the API server's order: LimitRanger (which may fill in a Pod's
 * resources), ServiceAccount, then ResourceQuota. Returns why it is forbidden, or null.
 */
export function admit(c: Cluster, r: Resource): string | null {
  return (r.kind === "Pod" && (limitRanges(c, r) || serviceAccountError(c, r))) || quotas(c, r);
}
