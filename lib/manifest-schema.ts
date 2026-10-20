import { z } from "zod";

const name = z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);

/** Label and annotation keys: an optional DNS subdomain prefix, then a name of up to 63 characters. */
export const LABEL_KEY_RE = /^([a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?\/)?[A-Za-z0-9]([-A-Za-z0-9_.]{0,61}[A-Za-z0-9])?$/;
export const LABEL_VALUE_RE = /^([A-Za-z0-9]([-A-Za-z0-9_.]{0,61}[A-Za-z0-9])?)?$/;
export const CONFIG_KEY_RE = /^[-._a-zA-Z0-9]{1,253}$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const labelKey = z.string().regex(LABEL_KEY_RE, "invalid label key");
const labels = z.record(labelKey, z.string().regex(LABEL_VALUE_RE, "invalid label value"));
const annotations = z.record(labelKey, z.string());
const metadata = z.object({ name, namespace: name.optional(), labels: labels.optional(), annotations: annotations.optional() });

const port = z.number().int().min(1).max(65535);
// An IANA service name: lowercase letters, digits and dashes, at least one letter, at most 15 characters.
const portName = z.string().regex(/^(?=.*[a-z])[a-z0-9]([-a-z0-9]{0,13}[a-z0-9])?$/, "invalid port name");
const portRef = z.union([port, portName]);
const configKey = z.string().regex(CONFIG_KEY_RE, "invalid key");

const exactlyOne = (o: object) => Object.values(o).filter((v) => v !== undefined).length === 1;

const probe = z
  .object({
    httpGet: z.object({ path: z.string().startsWith("/").optional(), port: portRef }).optional(),
    tcpSocket: z.object({ port: portRef }).optional(),
    exec: z.object({ command: z.array(z.string()).min(1) }).optional(),
    initialDelaySeconds: z.number().int().min(0).optional(),
    periodSeconds: z.number().int().min(1).optional(),
    timeoutSeconds: z.number().int().min(1).optional(),
    successThreshold: z.number().int().min(1).optional(),
    failureThreshold: z.number().int().min(1).optional(),
  })
  .refine((p) => exactlyOne({ a: p.httpGet, b: p.tcpSocket, c: p.exec }), "must specify exactly one of httpGet, tcpSocket or exec");

const keyRef = z.object({ name, key: configKey });

const container = z.object({
  name,
  image: z.string().min(1),
  ports: z
    .array(z.object({ containerPort: port, name: portName.optional(), protocol: z.enum(["TCP", "UDP", "SCTP"]).optional() }))
    .optional(),
  env: z
    .array(
      z
        .object({
          name: z.string().regex(/^[-._a-zA-Z][-._a-zA-Z0-9]*$/, "invalid env var name"),
          value: z.string().optional(),
          valueFrom: z
            .object({ configMapKeyRef: keyRef.optional(), secretKeyRef: keyRef.optional() })
            .refine((v) => exactlyOne(v), "must specify exactly one of configMapKeyRef or secretKeyRef")
            .optional(),
        })
        .refine((e) => !(e.value !== undefined && e.valueFrom), "may not have both value and valueFrom"),
    )
    .optional(),
  envFrom: z
    .array(
      z
        .object({ configMapRef: z.object({ name }).optional(), secretRef: z.object({ name }).optional(), prefix: z.string().optional() })
        .refine((e) => exactlyOne({ a: e.configMapRef, b: e.secretRef }), "must specify exactly one of configMapRef or secretRef"),
    )
    .optional(),
  readinessProbe: probe.optional(),
  livenessProbe: probe.optional(),
  startupProbe: probe.optional(),
  resources: z
    .object({ requests: z.record(z.string(), z.string()).optional(), limits: z.record(z.string(), z.string()).optional() })
    .optional(),
});

const podSpec = z.object({
  containers: z.array(container).min(1),
  restartPolicy: z.enum(["Always", "OnFailure", "Never"]).optional(),
});

const intOrPercent = z.union([z.number().int().min(0), z.string().regex(/^\d+%$/)]);

const workloadSpec = z.object({
  replicas: z.number().int().min(0),
  selector: z.object({ matchLabels: labels }),
  template: z.object({ metadata: z.object({ labels, annotations: annotations.optional() }), spec: podSpec }),
});

const selectorMatchesTemplate = (s: z.infer<typeof workloadSpec>) =>
  Object.entries(s.selector.matchLabels).every(([k, v]) => s.template.metadata.labels[k] === v);
const selectorError = { message: "selector does not match template labels", path: ["selector"] };

const isZero = (v?: number | string) => v === 0 || v === "0%";

const strategy = z
  .object({
    type: z.enum(["RollingUpdate", "Recreate"]),
    rollingUpdate: z.object({ maxSurge: intOrPercent, maxUnavailable: intOrPercent }).partial().optional(),
  })
  .refine((s) => !(s.type === "Recreate" && s.rollingUpdate), {
    message: "may not be specified when strategy type is 'Recreate'",
    path: ["rollingUpdate"],
  })
  .refine((s) => !(isZero(s.rollingUpdate?.maxSurge) && isZero(s.rollingUpdate?.maxUnavailable)), {
    message: "maxUnavailable may not be 0 when maxSurge is 0",
    path: ["rollingUpdate"],
  });

const serviceSpec = z
  .object({
    type: z.enum(["ClusterIP", "NodePort", "LoadBalancer"]).optional(),
    clusterIP: z.string().regex(/^10\.96\.\d{1,3}\.\d{1,3}$/, "must be an IP in 10.96.0.0/16").optional(),
    selector: labels.optional(),
    ports: z
      .array(
        z.object({
          name: portName.optional(),
          protocol: z.enum(["TCP", "UDP", "SCTP"]).optional(),
          port,
          targetPort: portRef.optional(),
          nodePort: z.number().int().min(30000).max(32767).optional(),
        }),
      )
      .min(1),
  })
  .refine((s) => (s.type ?? "ClusterIP") !== "ClusterIP" || s.ports.every((p) => p.nodePort === undefined), {
    message: "nodePort may not be used when type is 'ClusterIP'",
    path: ["ports"],
  })
  .refine((s) => s.ports.length === 1 || s.ports.every((p) => p.name), {
    message: "ports need a name when there is more than one",
    path: ["ports"],
  });

/** A deliberately small subset of the real Kubernetes schemas, covering what the chapters teach. */
export const manifestSchema = z.discriminatedUnion("kind", [
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Namespace"), metadata: z.object({ name }) }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Pod"), metadata, spec: podSpec }),
  z.object({
    apiVersion: z.literal("apps/v1"),
    kind: z.literal("ReplicaSet"),
    metadata,
    spec: workloadSpec.refine(selectorMatchesTemplate, selectorError),
  }),
  z.object({
    apiVersion: z.literal("apps/v1"),
    kind: z.literal("Deployment"),
    metadata,
    spec: workloadSpec.extend({ strategy: strategy.optional() }).refine(selectorMatchesTemplate, selectorError),
  }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Service"), metadata, spec: serviceSpec }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("ConfigMap"), metadata, data: z.record(configKey, z.string()).optional() }),
  z.object({
    apiVersion: z.literal("v1"),
    kind: z.literal("Secret"),
    metadata,
    type: z.string().regex(/^[a-zA-Z0-9./-]+$/).optional(),
    data: z.record(configKey, z.string().regex(BASE64_RE, "must be base64-encoded")).optional(),
    stringData: z.record(configKey, z.string()).optional(),
  }),
]);
