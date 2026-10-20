import { labelText } from "./cli";
import type { Container, PodTemplate, Volume } from "./types";

const list = (title: string, items: string[] | undefined, indent: string) =>
  items?.length ? [`${indent}${title}:`, ...items.map((x) => `${indent}  ${x}`)] : [];

/** Command, Args and Mounts of a container, as describe prints them. */
export function containerLines(ctr: Container, indent = ""): string[] {
  const mounts = (ctr.volumeMounts ?? []).map((m) => `${m.mountPath} from ${m.name}${m.subPath ? ` (${m.readOnly ? "ro" : "rw"},path="${m.subPath}")` : ` (${m.readOnly ? "ro" : "rw"})`}`);
  return [
    ...list("Command", ctr.command, indent),
    ...list("Args", ctr.args, indent),
    ...(mounts.length ? list("Mounts", mounts, indent) : [`${indent}Mounts:          <none>`]),
  ];
}

function volumeType(v: Volume): [string, string][] {
  if (v.emptyDir) return [["Type", "EmptyDir (a temporary directory that shares a pod's lifetime)"], ["Medium", v.emptyDir.medium ?? ""], ["SizeLimit", v.emptyDir.sizeLimit ?? "<unset>"]];
  if (v.hostPath) return [["Type", "HostPath (bare host directory volume)"], ["Path", v.hostPath.path], ["HostPathType", v.hostPath.type ?? ""]];
  if (v.configMap) return [["Type", "ConfigMap (a volume populated by a ConfigMap)"], ["Name", v.configMap.name], ["Optional", "false"]];
  if (v.secret) return [["Type", "Secret (a volume populated by a Secret)"], ["SecretName", v.secret.secretName], ["Optional", "false"]];
  const claim = v.persistentVolumeClaim!;
  return [["Type", "PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)"], ["ClaimName", claim.claimName], ["ReadOnly", String(!!claim.readOnly)]];
}

/** The Volumes section of describe. */
export function volumeLines(volumes: Volume[] | undefined, indent = ""): string[] {
  if (!volumes?.length) return [`${indent}Volumes:          <none>`];
  return [
    `${indent}Volumes:`,
    ...volumes.flatMap((v) => {
      const rows = volumeType(v);
      const width = Math.max(...rows.map(([k]) => k.length)) + 3;
      return [`${indent}  ${v.name}:`, ...rows.map(([k, val]) => `${indent}    ${`${k}:`.padEnd(width)}${val}`.trimEnd())];
    }),
  ];
}

/** The Pod Template block of describe for workloads. */
export function podTemplateLines(t: PodTemplate): string[] {
  const ctr = t.container;
  return [
    `  Labels:  ${labelText(t.labels).replace(/,/g, "\n           ")}`,
    "  Containers:",
    `   ${ctr.name}:`,
    `    Image:           ${t.image}`,
    `    Port:            ${ctr.ports?.map((x) => `${x.containerPort}/${x.protocol ?? "TCP"}`).join(", ") || "<none>"}`,
    ...containerLines(ctr, "    "),
    ...volumeLines(t.spec?.volumes, "  "),
  ];
}
