import { z } from "zod";

const name = z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
const labels = z.record(z.string(), z.string());
const metadata = z.object({ name, namespace: name.optional(), labels: labels.optional() });

const container = z.object({
  name,
  image: z.string().min(1),
  ports: z.array(z.object({ containerPort: z.number().int().min(1).max(65535) })).optional(),
  env: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  resources: z
    .object({ requests: labels.optional(), limits: labels.optional() })
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
  template: z.object({ metadata: z.object({ labels }), spec: podSpec }),
});

const selectorMatchesTemplate = (s: z.infer<typeof workloadSpec>) =>
  Object.entries(s.selector.matchLabels).every(([k, v]) => s.template.metadata.labels[k] === v);
const selectorError = { message: "selector does not match template labels", path: ["spec", "selector"] };

/** A deliberately small subset of the real Kubernetes schemas, covering what the chapters teach. */
export const manifestSchema = z.discriminatedUnion("kind", [
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
    spec: workloadSpec
      .extend({
        strategy: z
          .object({
            type: z.enum(["RollingUpdate", "Recreate"]),
            rollingUpdate: z.object({ maxSurge: intOrPercent, maxUnavailable: intOrPercent }).partial().optional(),
          })
          .optional(),
      })
      .refine(selectorMatchesTemplate, selectorError),
  }),
]);
