import { z } from "zod";
import { QUOTA_KEYS, parseHard } from "./simulator/admission";
import { parseCpu, parseMemory, QUANTITY_ERROR } from "./simulator/quantity";

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

// YAML reads `cpu: 1` as a number; the API accepts it as the quantity "1".
const quantity = (parse: (q: string) => number | null) =>
  z.union([z.string(), z.number()]).transform(String).refine((q) => parse(q) !== null, QUANTITY_ERROR);
const resourceList = z.object({ cpu: quantity(parseCpu).optional(), memory: quantity(parseMemory).optional() }).strict();

const resources = z
  .object({ requests: resourceList.optional(), limits: resourceList.optional() })
  .superRefine((r, ctx) => {
    for (const [name, parse] of [["cpu", parseCpu], ["memory", parseMemory]] as const) {
      const req = r.requests?.[name];
      const lim = r.limits?.[name];
      if (req !== undefined && lim !== undefined && parse(req)! > parse(lim)!) {
        ctx.addIssue({ code: "custom", path: ["requests"], message: `Invalid value: "${req}": must be less than or equal to ${name} limit of ${lim}` });
      }
    }
  });

const matchExpression = z
  .object({ key: labelKey, operator: z.enum(["In", "NotIn", "Exists", "DoesNotExist"]), values: z.array(z.string()).optional() })
  .refine((e) => (e.operator === "In" || e.operator === "NotIn" ? !!e.values?.length : !e.values?.length), {
    message: "values must be non-empty for In and NotIn, and empty for Exists and DoesNotExist",
  });
const nodeSelectorTerm = z.object({ matchExpressions: z.array(matchExpression).optional() });
const labelSelector = z.object({ matchLabels: labels.optional(), matchExpressions: z.array(matchExpression).optional() });
const taintEffect = z.enum(["NoSchedule", "PreferNoSchedule", "NoExecute"]);

const toleration = z
  .object({
    key: labelKey.optional(),
    operator: z.enum(["Equal", "Exists"]).optional(),
    value: z.string().regex(LABEL_VALUE_RE, "invalid label value").optional(),
    effect: taintEffect.optional(),
    tolerationSeconds: z.number().int().optional(),
  })
  .refine((t) => !(t.operator === "Exists" && t.value), { message: "value must be empty when operator is 'Exists'", path: ["value"] })
  .refine((t) => t.key !== undefined || t.operator === "Exists", { message: "operator must be Exists when key is empty", path: ["operator"] });

const affinity = z.object({
  nodeAffinity: z
    .object({
      requiredDuringSchedulingIgnoredDuringExecution: z.object({ nodeSelectorTerms: z.array(nodeSelectorTerm).min(1) }).optional(),
      preferredDuringSchedulingIgnoredDuringExecution: z
        .array(z.object({ weight: z.number().int().min(1).max(100), preference: nodeSelectorTerm }))
        .optional(),
    })
    .optional(),
  podAntiAffinity: z
    .object({
      requiredDuringSchedulingIgnoredDuringExecution: z
        .array(z.object({ labelSelector: labelSelector.optional(), topologyKey: labelKey }))
        .optional(),
    })
    .optional(),
});

const volumeMount = z.object({
  name,
  mountPath: z.string().startsWith("/"),
  readOnly: z.boolean().optional(),
  subPath: z.string().regex(/^[^/]/, "must be a relative path").refine((p) => !p.split("/").includes(".."), "must not contain '..'").optional(),
});

const container = z.object({
  name,
  image: z.string().min(1),
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  volumeMounts: z.array(volumeMount).optional(),
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
  resources: resources.optional(),
});

const keyToPath = z.object({ key: configKey, path: z.string().regex(/^[^/]/, "must be a relative path") });

const volumeSources = ["emptyDir", "hostPath", "configMap", "secret", "persistentVolumeClaim"] as const;

const volume = z
  .object({
    name,
    emptyDir: z.object({ medium: z.enum(["", "Memory"]).optional(), sizeLimit: quantity(parseMemory).optional() }).optional(),
    hostPath: z.object({ path: z.string().startsWith("/"), type: z.string().optional() }).optional(),
    configMap: z.object({ name, items: z.array(keyToPath).optional() }).optional(),
    secret: z.object({ secretName: name, items: z.array(keyToPath).optional() }).optional(),
    persistentVolumeClaim: z.object({ claimName: name, readOnly: z.boolean().optional() }).optional(),
  })
  .refine((v) => volumeSources.filter((k) => v[k] !== undefined).length === 1, `must specify exactly one of ${volumeSources.join(", ")}`);

const uniqueNames = (items?: { name: string }[]) => !items || new Set(items.map((i) => i.name)).size === items.length;

const podSpec = z.object({
  containers: z.array(container).min(1),
  volumes: z.array(volume).refine(uniqueNames, "volume names must be unique").optional(),
  serviceAccountName: name.optional(),
  restartPolicy: z.enum(["Always", "OnFailure", "Never"]).optional(),
  nodeName: name.optional(),
  nodeSelector: labels.optional(),
  tolerations: z.array(toleration).optional(),
  affinity: affinity.optional(),
});

const limitRangeItem = z.object({
  type: z.enum(["Container", "Pod", "PersistentVolumeClaim"]),
  default: resourceList.optional(),
  defaultRequest: resourceList.optional(),
  min: resourceList.optional(),
  max: resourceList.optional(),
});

const quotaHard = z
  .record(z.string(), z.union([z.string(), z.number()]).transform(String))
  .superRefine((hard, ctx) => {
    for (const [key, value] of Object.entries(hard)) {
      if (!QUOTA_KEYS.includes(key)) ctx.addIssue({ code: "custom", path: [key], message: `unsupported quota key, use one of ${QUOTA_KEYS.join(", ")}` });
      else if (parseHard(key, value) === null) ctx.addIssue({ code: "custom", path: [key], message: QUANTITY_ERROR });
    }
  });

const intOrPercent = z.union([z.number().int().min(0), z.string().regex(/^\d+%$/)]);

const selector = z.object({ matchLabels: labels });
const podTemplate = z.object({ metadata: z.object({ labels, annotations: annotations.optional() }), spec: podSpec });

const workloadSpec = z.object({ replicas: z.number().int().min(0), selector, template: podTemplate });

const selectorMatchesTemplate = (s: { selector: { matchLabels: Record<string, string> }; template: { metadata: { labels: Record<string, string> } } }) =>
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
    clusterIP: z.union([z.literal("None"), z.string().regex(/^10\.96\.\d{1,3}\.\d{1,3}$/, "must be an IP in 10.96.0.0/16 or None")]).optional(),
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
  })
  .refine((s) => !(s.clusterIP === "None" && (s.type ?? "ClusterIP") !== "ClusterIP"), {
    message: "Invalid value: \"None\": may not be set to 'None' for NodePort or LoadBalancer services",
    path: ["clusterIP"],
  });

const accessMode = z.enum(["ReadWriteOnce", "ReadOnlyMany", "ReadWriteMany", "ReadWriteOncePod"]);
const storage = quantity(parseMemory);

const claimSpec = z.object({
  accessModes: z.array(accessMode).min(1),
  resources: z.object({ requests: z.object({ storage }) }),
  storageClassName: z.string().optional(),
  volumeName: name.optional(),
});

const jobSpec = z.object({
  completions: z.number().int().min(1).optional(),
  parallelism: z.number().int().min(0).optional(),
  backoffLimit: z.number().int().min(0).optional(),
  activeDeadlineSeconds: z.number().int().min(1).optional(),
  ttlSecondsAfterFinished: z.number().int().min(0).optional(),
  template: z.object({ metadata: z.object({ labels: labels.optional(), annotations: annotations.optional() }).optional(), spec: podSpec }),
});

const clusterMetadata = z.object({ name, labels: labels.optional(), annotations: annotations.optional() });

/** A deliberately small subset of the real Kubernetes schemas, covering what the chapters teach. */
export const manifestSchema = z.discriminatedUnion("kind", [
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Namespace"), metadata: z.object({ name }) }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("Pod"), metadata, spec: podSpec }),
  z.object({
    apiVersion: z.literal("v1"),
    kind: z.literal("Node"),
    metadata: z.object({ name, labels: labels.optional(), annotations: annotations.optional() }),
    spec: z
      .object({
        taints: z.array(z.object({ key: labelKey, value: z.string().regex(LABEL_VALUE_RE, "invalid label value").optional(), effect: taintEffect })).optional(),
        unschedulable: z.boolean().optional(),
      })
      .optional(),
  }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("LimitRange"), metadata, spec: z.object({ limits: z.array(limitRangeItem).min(1) }) }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("ResourceQuota"), metadata, spec: z.object({ hard: quotaHard }) }),
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
  z.object({ apiVersion: z.literal("batch/v1"), kind: z.literal("Job"), metadata, spec: jobSpec }),
  z.object({
    apiVersion: z.literal("batch/v1"),
    kind: z.literal("CronJob"),
    metadata,
    spec: z.object({
      schedule: z.string().min(1),
      timeZone: z.string().optional(),
      suspend: z.boolean().optional(),
      concurrencyPolicy: z.enum(["Allow", "Forbid", "Replace"]).optional(),
      successfulJobsHistoryLimit: z.number().int().min(0).optional(),
      failedJobsHistoryLimit: z.number().int().min(0).optional(),
      startingDeadlineSeconds: z.number().int().min(0).optional(),
      jobTemplate: z.object({ metadata: z.object({ labels: labels.optional(), annotations: annotations.optional() }).optional(), spec: jobSpec }),
    }),
  }),
  z.object({
    apiVersion: z.literal("apps/v1"),
    kind: z.literal("DaemonSet"),
    metadata,
    spec: z
      .object({
        selector,
        template: podTemplate,
        updateStrategy: z
          .object({
            type: z.enum(["RollingUpdate", "OnDelete"]),
            rollingUpdate: z.object({ maxUnavailable: intOrPercent.optional(), maxSurge: intOrPercent.optional() }).optional(),
          })
          .optional(),
      })
      .refine(selectorMatchesTemplate, selectorError),
  }),
  z.object({
    apiVersion: z.literal("apps/v1"),
    kind: z.literal("StatefulSet"),
    metadata,
    spec: z
      .object({
        serviceName: z.string().optional(),
        replicas: z.number().int().min(0).optional(),
        selector,
        template: podTemplate,
        podManagementPolicy: z.enum(["OrderedReady", "Parallel"]).optional(),
        updateStrategy: z.object({ type: z.enum(["RollingUpdate", "OnDelete"]) }).optional(),
        volumeClaimTemplates: z.array(z.object({ metadata: z.object({ name, labels: labels.optional() }), spec: claimSpec })).refine((t) => uniqueNames(t.map((x) => x.metadata)), "claim template names must be unique").optional(),
      })
      .refine(selectorMatchesTemplate, selectorError),
  }),
  z.object({
    apiVersion: z.literal("storage.k8s.io/v1"),
    kind: z.literal("StorageClass"),
    metadata: clusterMetadata,
    provisioner: z.string().min(1),
    reclaimPolicy: z.enum(["Delete", "Retain"]).optional(),
    volumeBindingMode: z.enum(["Immediate", "WaitForFirstConsumer"]).optional(),
    allowVolumeExpansion: z.boolean().optional(),
    parameters: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    apiVersion: z.literal("v1"),
    kind: z.literal("PersistentVolume"),
    metadata: clusterMetadata,
    spec: z.object({
      capacity: z.object({ storage }),
      accessModes: z.array(accessMode).min(1),
      persistentVolumeReclaimPolicy: z.enum(["Delete", "Retain"]).optional(),
      storageClassName: z.string().optional(),
      hostPath: z.object({ path: z.string().startsWith("/"), type: z.string().optional() }),
    }),
  }),
  z.object({ apiVersion: z.literal("v1"), kind: z.literal("PersistentVolumeClaim"), metadata, spec: claimSpec }),
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
