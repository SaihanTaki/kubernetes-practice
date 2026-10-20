import { decodeBase64, find, list } from "./cluster";
import type { Cluster, Pod, Volume, VolumeMount } from "./types";

/**
 * Container files live in `c.volumes`, one store per place data survives:
 *   pod/<uid>           the container's own filesystem, gone with the Pod
 *   pod/<uid>/<volume>  an emptyDir, gone with the Pod
 *   host/<node><path>   a hostPath directory on that node
 *   pv/<name>           a PersistentVolume, kept while the PV exists
 * ConfigMap and Secret volumes are read from the objects themselves and are read-only.
 */
type Location = { key?: string; data?: Record<string, string>; path: string; readOnly: boolean };

/** Directories every image has, so ls and cat on them behave. */
const BASE_DIRS = ["/bin", "/dev", "/etc", "/home", "/proc", "/root", "/sys", "/tmp", "/usr", "/var"];

/** An absolute path with `.`, `..` and repeated slashes resolved. */
export function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

const within = (path: string, dir: string) => dir === "/" || path === dir || path.startsWith(`${dir}/`);
const relative = (path: string, dir: string) => (path === dir ? "" : path.slice(dir === "/" ? 1 : dir.length + 1));

function mountOf(p: Pod, path: string): { mount: VolumeMount; volume?: Volume } | undefined {
  const mounts = (p.container.volumeMounts ?? []).filter((m) => within(path, normalize(m.mountPath)));
  const mount = mounts.sort((a, b) => normalize(b.mountPath).length - normalize(a.mountPath).length)[0];
  return mount && { mount, volume: p.spec?.volumes?.find((v) => v.name === mount.name) };
}

function projected(items: { key: string; path: string }[] | undefined, data: Record<string, string>, decode: (v: string) => string) {
  const pairs = items ? items.filter((i) => Object.hasOwn(data, i.key)).map((i) => [i.path, data[i.key]] as const) : Object.entries(data);
  return Object.fromEntries(pairs.map(([k, v]) => [k, decode(v)]));
}

function locate(c: Cluster, p: Pod, rawPath: string): Location {
  const path = normalize(rawPath);
  const found = mountOf(p, path);
  if (!found?.volume) return { key: `pod/${p.metadata.uid}`, path: relative(path, "/"), readOnly: false };
  const { mount, volume: v } = found;
  const inner = [mount.subPath, relative(path, normalize(mount.mountPath))].filter(Boolean).join("/");
  const readOnly = !!mount.readOnly;
  const ns = p.metadata.namespace;
  if (v.configMap) {
    const cm = find(c, "ConfigMap", ns, v.configMap.name);
    return { data: projected(v.configMap.items, cm?.data ?? {}, (x) => x), path: inner, readOnly: true };
  }
  if (v.secret) {
    const s = find(c, "Secret", ns, v.secret.secretName);
    return { data: projected(v.secret.items, s?.data ?? {}, decodeBase64), path: inner, readOnly: true };
  }
  if (v.hostPath) return { key: `host/${p.node}${normalize(v.hostPath.path)}`, path: inner, readOnly };
  if (v.persistentVolumeClaim) {
    const claim = find(c, "PersistentVolumeClaim", ns, v.persistentVolumeClaim.claimName);
    return { key: claim?.volumeName && `pv/${claim.volumeName}`, path: inner, readOnly: readOnly || !!v.persistentVolumeClaim.readOnly };
  }
  return { key: `pod/${p.metadata.uid}/${v.name}`, path: inner, readOnly };
}

const filesAt = (c: Cluster, loc: Location) => loc.data ?? (loc.key ? (c.volumes[loc.key] ?? {}) : {});

/** The file's text, or null when it does not exist (or is a directory). */
export function readFile(c: Cluster, p: Pod, path: string): string | null {
  const loc = locate(c, p, path);
  const files = filesAt(c, loc);
  return Object.hasOwn(files, loc.path) ? files[loc.path] : null;
}

/** Names in a directory, or null when there is no such directory. */
export function listDir(c: Cluster, p: Pod, rawPath: string): string[] | null {
  const path = normalize(rawPath);
  const loc = locate(c, p, path);
  const prefix = loc.path ? `${loc.path}/` : "";
  const names = new Set(Object.keys(filesAt(c, loc)).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length).split("/")[0]));
  const mountPaths = (p.container.volumeMounts ?? []).map((m) => normalize(m.mountPath));
  for (const dir of [...BASE_DIRS, ...mountPaths]) {
    if (dir !== path && within(dir, path)) names.add(relative(dir, path).split("/")[0]);
  }
  const exists = names.size > 0 || path === "/" || mountPaths.includes(path) || BASE_DIRS.includes(path);
  return exists ? [...names].sort() : null;
}

/** Writes or appends a file; returns sh's error message, or null. */
export function writeFile(c: Cluster, p: Pod, path: string, text: string, append: boolean): string | null {
  const loc = locate(c, p, path);
  const cannot = (why: string) => `sh: can't create ${path}: ${why}`;
  if (loc.readOnly) return cannot("Read-only file system");
  if (!loc.key) return cannot("No such file or directory");
  if (!loc.path || listDir(c, p, path)) return cannot("Is a directory");
  const files = (c.volumes[loc.key] ??= {});
  files[loc.path] = (append ? (files[loc.path] ?? "") : "") + text;
  return null;
}

/** Drops the stores of Pods and PersistentVolumes that no longer exist. */
export function collectFiles(c: Cluster) {
  const pods = new Set(list(c, "Pod").map((p) => p.metadata.uid));
  const pvs = new Set(list(c, "PersistentVolume").map((v) => v.metadata.name));
  for (const key of Object.keys(c.volumes)) {
    const [kind, id] = key.split("/");
    if ((kind === "pod" && !pods.has(id)) || (kind === "pv" && !pvs.has(id))) delete c.volumes[key];
  }
}
