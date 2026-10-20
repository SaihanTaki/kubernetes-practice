import { describe, expect, it } from "vitest";
import { check } from "@/lib/labs";
import { createCluster, find, list, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

const wait = (c: Cluster, n: number) => exec(c, ...Array(n).fill("kubectl get pods")).c;

const claim = (name: string, opts: { storage?: string; className?: string | null; modes?: string } = {}) => `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${name}
spec:${opts.className === undefined ? "" : `\n  storageClassName: ${opts.className === null ? '""' : opts.className}`}
  accessModes: [${opts.modes ?? "ReadWriteOnce"}]
  resources:
    requests:
      storage: ${opts.storage ?? "1Gi"}
`;

const volume = (name: string, storage: string, opts: { policy?: string; className?: string; modes?: string } = {}) => `apiVersion: v1
kind: PersistentVolume
metadata:
  name: ${name}
spec:
  capacity:
    storage: ${storage}
  accessModes: [${opts.modes ?? "ReadWriteOnce"}]
  persistentVolumeReclaimPolicy: ${opts.policy ?? "Retain"}
  storageClassName: "${opts.className ?? ""}"
  hostPath:
    path: /mnt/${name}
`;

const storageClass = (name: string, mode: string, extra = "") => `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ${name}
provisioner: example.com/disk
volumeBindingMode: ${mode}${extra}
`;

const pod = (name: string, volumes: string, mounts: string, command = `["sleep", "3600"]`) => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ${command}
      volumeMounts:
${mounts}
  volumes:
${volumes}
`;

const claimPod = (name: string, claimName: string) =>
  pod(name, `    - name: data\n      persistentVolumeClaim:\n        claimName: ${claimName}`, "        - name: data\n          mountPath: /data");

const apply = (c: Cluster, ...docs: string[]) => {
  c.files["x.yaml"] = docs.join("---\n");
  return exec(c, "kubectl apply -f x.yaml");
};

const pvc = (c: Cluster, name: string) => find(c, "PersistentVolumeClaim", "default", name)!;

describe("StorageClass", () => {
  it("has a default class standard", () => {
    const c = createCluster();
    expect(exec(c, "kubectl get storageclass").output).toBe(
      [
        "NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE",
        "standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false                  10m",
      ].join("\n"),
    );
    expect(exec(c, "kubectl describe sc standard").output).toMatch(/IsDefaultClass:\s+Yes/);
    expect(exec(c, "kubectl get sc -n other").error).toBe(false);
    expect(check(c, { kind: "resource-exists", resourceType: "StorageClass", resourceName: "standard" })).toBe(true);
  });

  it("keeps provisioner and binding mode immutable", () => {
    const { c } = apply(createCluster(), storageClass("fast", "Immediate"));
    expect(apply(c, storageClass("fast", "WaitForFirstConsumer")).output).toBe('The StorageClass "fast" is invalid: volumeBindingMode: Forbidden: updates to volumeBindingMode are forbidden.');
    expect(apply(c, storageClass("fast", "Immediate", "\nallowVolumeExpansion: true")).output).toBe("storageclass.storage.k8s.io/fast configured");
  });
});

describe("binding", () => {
  it("binds the smallest fitting static PV of the claim's class", () => {
    let { c } = apply(createCluster(), volume("big", "10Gi"), volume("small", "2Gi"), volume("tiny", "500Mi"), volume("rwx", "1Gi", { modes: "ReadWriteMany" }));
    c = apply(c, claim("data", { className: null })).c;
    expect(pvc(c, "data")).toMatchObject({ phase: "Bound", volumeName: "small" });
    expect(exec(c, "kubectl get pvc").output).toMatch(/^NAME\s+STATUS\s+VOLUME\s+CAPACITY\s+ACCESS MODES\s+STORAGECLASS\s+VOLUMEATTRIBUTESCLASS\s+AGE\ndata\s+Bound\s+small\s+2Gi\s+RWO\s+<unset>\s+/);
    expect(exec(c, "kubectl get pv small").output).toMatch(/small\s+2Gi\s+RWO\s+Retain\s+Bound\s+default\/data\s+<unset>/);
    expect(check(c, { kind: "pv-status", pvName: "small", expectedValue: "Bound" })).toBe(true);
    expect(check(c, { kind: "pv-status", pvName: "big", expectedValue: "Available" })).toBe(true);
    expect(check(c, { kind: "pvc-status", claimName: "data", expectedValue: "Bound" })).toBe(true);
  });

  it("stays Pending when nothing fits and no class is set", () => {
    const { c } = apply(createCluster(), claim("data", { className: null, storage: "5Gi" }));
    expect(check(c, { kind: "pvc-status", claimName: "data", expectedValue: "Pending" })).toBe(true);
    expect(exec(c, "kubectl describe pvc data").output).toMatch(/FailedBinding\s+.*no persistent volumes available for this claim and no storage class is set/);
  });

  it("reports a missing class", () => {
    const { c } = apply(createCluster(), claim("data", { className: "fast" }));
    const d = exec(c, "kubectl describe pvc data").output;
    expect(d).toMatch(/StorageClass:\s+fast\nStatus:\s+Pending/);
    expect(d).toMatch(/Warning\s+ProvisioningFailed\s+.*storageclass\.storage\.k8s\.io "fast" not found/);
  });

  it("gives a claim without a class the default class and provisions when a Pod is scheduled", () => {
    let { c } = apply(createCluster(), claim("data"));
    expect(pvc(c, "data")).toMatchObject({ storageClassName: "standard", phase: "Pending" });
    expect(exec(c, "kubectl describe pvc data").output).toMatch(/WaitForFirstConsumer\s+.*waiting for first consumer to be created before binding/);
    c = apply(c, claimPod("app", "data")).c;
    const bound = pvc(c, "data");
    expect(bound.phase).toBe("Bound");
    const pv = find(c, "PersistentVolume", "", bound.volumeName!)!;
    expect(pv).toMatchObject({ capacity: "1Gi", reclaimPolicy: "Delete", storageClassName: "standard", node: find(c, "Pod", "default", "app")!.node });
    expect(pv.metadata.name).toMatch(/^pvc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(exec(c, "kubectl describe pvc data").output).toMatch(/ProvisioningSucceeded\s+.*Successfully provisioned volume pvc-/);
  });

  it("binds Immediate claims right away and keeps Pods off unbound Immediate claims", () => {
    let { c } = apply(createCluster(), storageClass("fast", "Immediate"), claim("data", { className: "fast" }));
    expect(pvc(c, "data").phase).toBe("Bound");
    c = apply(c, volume("pv1", "1Gi"), claim("manual", { className: null, storage: "5Gi" })).c;
    c = apply(c, claimPod("app", "manual")).c;
    expect(exec(c, "kubectl describe pod app").output).toMatch(/0\/3 nodes are available: pod has unbound immediate PersistentVolumeClaims\. preemption: 0\/3 nodes are available: 3 Preemption is not helpful for scheduling\./);
  });

  it("keeps a Pod Pending until its claim exists", () => {
    let { c } = apply(createCluster(), claimPod("app", "data"));
    expect(find(c, "Pod", "default", "app")!.status).toBe("Pending");
    expect(exec(c, "kubectl describe pod app").output).toMatch(/FailedScheduling\s+.*persistentvolumeclaim "data" not found/);
    c = apply(c, claim("data")).c;
    c = wait(c, 1);
    expect(find(c, "Pod", "default", "app")!.status).toBe("Running");
  });
});

describe("deleting claims and volumes", () => {
  it("keeps a claim in use Terminating until its Pod is gone, then deletes a Delete PV", () => {
    let c = wait(apply(createCluster(), claim("data"), claimPod("app", "data")).c, 1);
    const pvName = pvc(c, "data").volumeName!;
    let r = exec(c, "kubectl delete pvc data");
    expect(r.output).toBe('persistentvolumeclaim "data" deleted');
    expect(exec(r.c, "kubectl get pvc").output).toMatch(/data\s+Terminating/);
    expect(check(r.c, { kind: "pvc-status", claimName: "data", expectedValue: "Bound" })).toBe(false);
    r = exec(r.c, "kubectl delete pod app");
    c = r.c;
    expect(find(c, "PersistentVolumeClaim", "default", "data")).toBeUndefined();
    expect(find(c, "PersistentVolume", "", pvName)).toBeUndefined();
  });

  it("releases a Retain PV and keeps a bound PV Terminating", () => {
    let { c } = apply(createCluster(), volume("keep", "1Gi"), claim("data", { className: null }));
    let r = exec(c, "kubectl delete pv keep");
    expect(exec(r.c, "kubectl get pv").output).toMatch(/keep\s+1Gi\s+RWO\s+Retain\s+Terminating/);
    c = exec(c, "kubectl delete pvc data").c;
    expect(check(c, { kind: "pv-status", pvName: "keep", expectedValue: "Released" })).toBe(true);
    c = apply(c, claim("again", { className: null })).c;
    expect(pvc(c, "again").phase).toBe("Pending");
    r = exec(c, "kubectl delete pv keep");
    expect(find(r.c, "PersistentVolume", "", "keep")).toBeUndefined();
  });
});

describe("claim updates", () => {
  it("forbids spec changes but allows growing a bound claim of an expandable class", () => {
    let { c } = apply(createCluster(), claim("data", { className: "fast" }));
    expect(apply(c, claim("data")).output).toBe(
      'The PersistentVolumeClaim "data" is invalid: spec: Forbidden: spec is immutable after creation except resources.requests and volumeAttributesClassName for bound claims',
    );
    expect(apply(c, claim("data", { className: "fast", storage: "2Gi" })).error).toBe(true);

    c = apply(createCluster(), storageClass("grow", "Immediate", "\nallowVolumeExpansion: true"), claim("data", { className: "grow" })).c;
    expect(apply(c, claim("data", { className: "grow", storage: "500Mi" })).output).toBe(
      'The PersistentVolumeClaim "data" is invalid: spec.resources.requests.storage: Forbidden: field can not be less than previous value',
    );
    const grown = apply(c, claim("data", { className: "grow", storage: "5Gi" }));
    expect(grown.output).toBe("persistentvolumeclaim/data configured");
    expect(exec(grown.c, "kubectl get pvc").output).toMatch(/data\s+Bound\s+pvc-\S+\s+5Gi/);

    c = apply(createCluster(), storageClass("fixed", "Immediate"), claim("data", { className: "fixed" })).c;
    expect(apply(c, claim("data", { className: "fixed", storage: "5Gi" })).output).toMatch(/^Error from server \(Forbidden\): persistentvolumeclaims "data" is forbidden: only dynamically provisioned pvc can be resized/);
  });

  it("re-applies a claim that got the default class unchanged", () => {
    const { c } = apply(createCluster(), claim("data"));
    expect(apply(c, claim("data")).output).toBe("persistentvolumeclaim/data unchanged");
  });
});

describe("Pod volumes", () => {
  it("rejects a mount of an unknown volume", () => {
    const text = pod("app", "    - name: data\n      emptyDir: {}", "        - name: other\n          mountPath: /data");
    expect(apply(createCluster(), text).output).toBe('The Pod "app" is invalid: spec.containers[0].volumeMounts[0].name: Not found: "other"');
    const deploy = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: nginx
          volumeMounts:
            - name: nope
              mountPath: /x
`;
    expect(apply(createCluster(), deploy).output).toBe('The Deployment "web" is invalid: spec.template.spec.containers[0].volumeMounts[0].name: Not found: "nope"');
  });

  it("validates volume sources in the schema", () => {
    expect(apply(createCluster(), pod("app", "    - name: data", "        - name: data\n          mountPath: /data")).output).toMatch(/must specify exactly one of emptyDir/);
  });

  it("waits in ContainerCreating with FailedMount until a ConfigMap volume exists", () => {
    const text = pod("app", "    - name: cfg\n      configMap:\n        name: settings", "        - name: cfg\n          mountPath: /etc/app");
    let c = wait(apply(createCluster(), text).c, 2);
    expect(find(c, "Pod", "default", "app")!.status).toBe("ContainerCreating");
    expect(exec(c, "kubectl describe pod app").output).toMatch(/Warning\s+FailedMount\s+.*MountVolume\.SetUp failed for volume "cfg" : configmap "settings" not found/);
    c = wait(exec(c, "kubectl create configmap settings --from-literal=mode=prod").c, 1);
    expect(find(c, "Pod", "default", "app")!.status).toBe("Running");
    expect(exec(c, "kubectl exec app -- cat /etc/app/mode").output).toBe("prod");
  });

  it("projects secret keys decoded and configMap items to their paths", () => {
    const volumes = "    - name: s\n      secret:\n        secretName: creds\n    - name: c\n      configMap:\n        name: settings\n        items:\n          - key: mode\n            path: conf/mode.txt";
    const mounts = "        - name: s\n          mountPath: /secrets\n        - name: c\n          mountPath: /etc/app";
    let c = exec(createCluster(), "kubectl create secret generic creds --from-literal=password=s3cret", "kubectl create configmap settings --from-literal=mode=prod").c;
    c = wait(apply(c, pod("app", volumes, mounts)).c, 1);
    expect(exec(c, "kubectl exec app -- cat /secrets/password").output).toBe("s3cret");
    expect(exec(c, "kubectl exec app -- cat /etc/app/conf/mode.txt").output).toBe("prod");
    expect(exec(c, "kubectl exec app -- ls /etc/app").output).toBe("conf");
  });

  it("keeps PVC data across Pods and loses emptyDir data with the Pod", () => {
    const volumes = "    - name: data\n      persistentVolumeClaim:\n        claimName: data\n    - name: scratch\n      emptyDir: {}";
    const mounts = "        - name: data\n          mountPath: /data\n        - name: scratch\n          mountPath: /scratch";
    let c = wait(apply(createCluster(), claim("data"), pod("app", volumes, mounts)).c, 1);
    c = exec(c, "kubectl exec app -- sh -c 'echo kept > /data/a.txt; echo lost > /scratch/b.txt; echo gone > /tmp/c.txt'").c;
    const v = { kind: "file-content", podName: "app", path: "/data/a.txt", expectedValue: "kept" } as const;
    expect(check(c, v)).toBe(true);
    expect(check(c, { ...v, path: "/scratch/b.txt", expectedValue: "lost" })).toBe(true);
    c = exec(c, "kubectl delete pod app").c;
    expect(check(c, v)).toBe(false);
    c = wait(apply(c, pod("app", volumes, mounts)).c, 1);
    expect(check(c, v)).toBe(true);
    expect(check(c, { ...v, path: "/scratch/b.txt", expectedValue: null })).toBe(true);
    expect(check(c, { ...v, path: "/tmp/c.txt", expectedValue: null })).toBe(true);
    expect(Object.keys(c.volumes).every((k) => !k.startsWith("pod/") || list(c, "Pod").some((p) => k.split("/")[1] === p.metadata.uid))).toBe(true);
  });

  it("writes from a container command into its volumes when it starts", () => {
    const text = pod("app", "    - name: out\n      hostPath:\n        path: /var/out", "        - name: out\n          mountPath: /out", `["sh", "-c", "echo ready > /out/status; sleep 3600"]`);
    const c = wait(apply(createCluster(), text).c, 1);
    expect(exec(c, "kubectl exec app -- cat /out/status").output).toBe("ready");
  });

  it("supports subPath and readOnly mounts", () => {
    const mounts = "        - name: data\n          mountPath: /config\n          subPath: app\n        - name: data\n          mountPath: /ro\n          readOnly: true";
    let c = wait(apply(createCluster(), claim("data"), pod("app", "    - name: data\n      persistentVolumeClaim:\n        claimName: data", mounts)).c, 1);
    c = exec(c, "kubectl exec app -- sh -c 'echo x > /config/a'").c;
    expect(exec(c, "kubectl exec app -- cat /ro/app/a").output).toBe("x");
    expect(exec(c, "kubectl exec app -- sh -c 'echo y > /ro/b'").output).toBe("sh: can't create /ro/b: Read-only file system\ncommand terminated with exit code 1");
  });

  it("shows volumes and mounts in describe pod", () => {
    const c = wait(apply(createCluster(), claim("data"), claimPod("app", "data")).c, 1);
    const d = exec(c, "kubectl describe pod app").output;
    expect(d).toMatch(/Mounts:\n\s+\/data from data \(rw\)/);
    expect(d).toMatch(/Volumes:\n\s+data:\n\s+Type:\s+PersistentVolumeClaim .*\n\s+ClaimName:\s+data/);
    expect(exec(c, "kubectl describe pvc data").output).toMatch(/Used By:\s+app/);
  });
});
