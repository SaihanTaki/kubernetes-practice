import type { ChapterData } from "../types";
import { quiz } from "./volumes.quiz";

const claimYaml = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: fast
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`;

const fixedClaimYaml = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`;

const writerYaml = `apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data
`;

export const data: ChapterData = {
  objectives: [
    "Explain why container files are lost and choose between emptyDir, hostPath, configMap, secret, and PVC volumes.",
    "Describe what StorageClasses, PersistentVolumes, and PersistentVolumeClaims are for, and who creates each.",
    "Predict whether a claim binds, using its class, access modes, capacity, and the class's binding mode.",
    "Say what happens to the data when a claim is deleted under Delete and Retain reclaim policies.",
    "Fix a Pending claim and show that data written to it outlives the Pod.",
  ],
  quiz,
  manifests: [
    {
      id: "pvc",
      title: "data-pvc.yaml",
      yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`,
      notes: [
        { line: 2, text: "A claim is a request for storage. It lives in a namespace, and only Pods in that namespace can use it." },
        { line: 4, text: "Pods refer to the claim by this name in persistentVolumeClaim.claimName." },
        { line: 6, text: "The StorageClass to bind or provision from. Leave the field out to get the default class; set it to \"\" to bind only to static PVs without a class." },
        { line: 8, text: "ReadWriteOnce: mountable read-write by one node at a time. The PV must offer every mode listed here." },
        { line: 11, text: "The minimum size. A matching static PV may be bigger; a dynamically provisioned one is exactly this size. Raise it later to expand if the class allows." },
      ],
    },
    {
      id: "pvc-pod",
      title: "writer-pod.yaml",
      yaml: `apiVersion: v1
kind: Pod
metadata:
  name: writer
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data
        - name: scratch
          mountPath: /tmp/scratch
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data
    - name: scratch
      emptyDir: {}`,
      notes: [
        { line: 10, text: "volumeMounts belong to a container. Each entry mounts one volume from the Pod's volumes list." },
        { line: 11, text: "Must match a name under volumes. An unknown name is rejected when the Pod is created." },
        { line: 12, text: "Where the volume appears inside this container. Files written under /data go to the PV, not the container's own layer." },
        { line: 14, text: "A second mount from a different volume. Another container in the same Pod could mount scratch at a different path and see the same files." },
        { line: 15, text: "volumes belong to the Pod and say where each volume's data comes from." },
        { line: 18, text: "The claim in the Pod's namespace. If it is missing or cannot bind, the Pod stays Pending." },
        { line: 20, text: "An empty directory created with the Pod and deleted with it. Fine for scratch files, wrong for data you want to keep." },
      ],
    },
    {
      id: "static-pv",
      title: "pv-reports.yaml",
      yaml: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-reports
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  hostPath:
    path: /mnt/disks/reports`,
      notes: [
        { line: 2, text: "PersistentVolumes are cluster-scoped: no namespace, and usually created by an admin or a provisioner, not by app teams." },
        { line: 7, text: "The real size of the storage. Any claim requesting 5Gi or less can bind, and it gets all 5Gi." },
        { line: 9, text: "What this storage supports. A claim binds only if every mode it requests is listed here." },
        { line: 10, text: "Retain keeps the PV and its data after the claim is deleted; the PV becomes Released until an admin cleans it up." },
        { line: 11, text: "An empty class. Only claims that also set storageClassName: \"\" bind to it, and no provisioner is involved." },
        { line: 12, text: "Where the data lives. hostPath keeps this example self-contained but ties the data to one node; real PVs use a csi or nfs source." },
      ],
    },
  ],
  labs: [
    {
      id: "volumes-pvc-fix",
      title: "Fix a Pending claim and keep the data",
      difficulty: "intermediate",
      scenario:
        "Someone applied data-claim.yaml and writer.yaml. The writer Pod has been Pending ever since. Get it running on a claim from the cluster's default StorageClass, then prove that a file written to the volume survives deleting the Pod.",
      instructions: [
        "Run kubectl get pods and kubectl get pvc, then kubectl describe pvc data to see why the claim does not bind.",
        "Run kubectl get storageclass to see which classes exist and which one is the default.",
        "A claim's class cannot be changed in place. Delete the writer Pod, then delete the claim.",
        "Edit data-claim.yaml so the claim uses the default class, and apply it. Then apply writer.yaml again.",
        "Run kubectl get pvc and kubectl get pods until the claim is Bound and writer is Running.",
        "Write a file: kubectl exec writer -- sh -c 'echo hello > /data/note.txt'",
        "Delete the writer Pod, apply writer.yaml again, wait for it to run, and read the file back with kubectl exec writer -- cat /data/note.txt.",
      ],
      fixture: {
        files: { "data-claim.yaml": claimYaml, "writer.yaml": writerYaml },
        apply: ["data-claim.yaml", "writer.yaml"],
      },
      objectives: [
        {
          id: "bound",
          description: "Claim data is Bound.",
          validator: { kind: "pvc-status", claimName: "data", expectedValue: "Bound" },
        },
        {
          id: "running",
          description: "Pod writer is Running.",
          validator: { kind: "pod-status", podName: "writer", expectedValue: "Running" },
        },
        {
          id: "file",
          description: "/data/note.txt in writer contains hello.",
          validator: { kind: "file-content", podName: "writer", path: "/data/note.txt", expectedValue: "hello" },
        },
      ],
      hints: [
        "kubectl describe pvc data shows storageclass.storage.k8s.io \"fast\" not found: the claim names a class that does not exist.",
        "kubectl get storageclass lists standard (default). Removing the storageClassName line makes the claim use it; storageClassName: standard works too.",
        "Deleting the claim while writer uses it leaves the claim Terminating (pvc-protection). Delete the Pod first: kubectl delete pod writer, then kubectl delete pvc data.",
        "The standard class uses WaitForFirstConsumer, so the new claim stays Pending until writer is applied and scheduled. That is expected.",
        "kubectl apply -f data-claim.yaml, then kubectl apply -f writer.yaml, then kubectl get pods.",
        "After kubectl delete pod writer and kubectl apply -f writer.yaml, the new Pod mounts the same claim, so the file is still there.",
      ],
      solutionFiles: { "data-claim.yaml": fixedClaimYaml },
      solution: [
        "kubectl delete pod writer",
        "kubectl delete pvc data",
        "kubectl apply -f data-claim.yaml",
        "kubectl apply -f writer.yaml",
        "kubectl get pvc",
        "kubectl get pods",
        "kubectl exec writer -- sh -c 'echo hello > /data/note.txt'",
        "kubectl delete pod writer",
        "kubectl apply -f writer.yaml",
        "kubectl get pods",
        "kubectl get pods",
        "kubectl exec writer -- cat /data/note.txt",
      ],
    },
  ],
  diagrams: [
    {
      id: "pvc-provisioning",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "pod",
            label: "Pod writer",
            sub: "volume: claimName data",
            detail: "The Pod names only a claim in its own namespace. It does not know which PV or disk sits behind it.",
          },
          {
            id: "pvc",
            label: "PVC data",
            sub: "1Gi, RWO, class standard",
            detail: "The developer's request. With a WaitForFirstConsumer class it stays Pending until a Pod that uses it is scheduled.",
          },
          {
            id: "class",
            label: "StorageClass standard",
            sub: "provisioner, reclaimPolicy, binding mode",
            detail: "Created by the cluster admin. Its provisioner, a CSI driver, watches for claims of this class and creates storage for them.",
          },
          {
            id: "pv",
            label: "PV pvc-<uid>",
            sub: "1Gi, Bound to default/data",
            detail: "Created by the provisioner with exactly the requested size, then bound one to one to the claim. It inherits the class's reclaim policy.",
          },
          {
            id: "backend",
            label: "Storage backend",
            sub: "cloud disk, NFS, local disk",
            detail: "Where the bytes really live. The kubelet on the Pod's node attaches and mounts it, and the container sees it at its mountPath.",
          },
        ],
      },
      steps: [
        {
          title: "The claim is created",
          text: "A developer applies a PVC. The class uses WaitForFirstConsumer, so nothing is provisioned yet and the claim is Pending.",
          highlight: ["pvc"],
        },
        {
          title: "A Pod uses it",
          text: "A Pod that mounts the claim is scheduled to a node. Now the zone is known.",
          highlight: ["pod", "pvc"],
        },
        {
          title: "The provisioner creates storage",
          text: "The class's provisioner creates a disk in that node's zone, with the size and access modes from the claim.",
          highlight: ["class", "backend"],
        },
        {
          title: "PV created and bound",
          text: "A PV object describing the new disk is created and bound to the claim. The claim turns Bound.",
          highlight: ["pv", "pvc"],
        },
        {
          title: "Mounted into the container",
          text: "The kubelet attaches and mounts the disk, and the container starts with the volume at its mountPath.",
          highlight: ["pod", "backend"],
        },
      ],
    },
    {
      id: "pvc-lifecycle",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "pending",
            label: "Pending",
            sub: "no PV yet",
            detail: "The claim waits for a matching PV, for provisioning, or, with WaitForFirstConsumer, for a Pod to be scheduled.",
            children: [
              { id: "pending-pvc", label: "PVC data", sub: "Pending", detail: "kubectl describe pvc shows why in its events, such as a missing class or waiting for first consumer." },
              { id: "pending-pv", label: "PV", sub: "Available or not yet created", detail: "A static PV that matches would be Available. With dynamic provisioning it does not exist yet." },
            ],
          },
          {
            id: "bound",
            label: "Bound",
            sub: "claim and PV paired",
            detail: "One claim, one PV, until the claim is deleted. Pods using the claim can be deleted and recreated without losing data.",
            children: [
              { id: "bound-pvc", label: "PVC data", sub: "Bound to the PV", detail: "Pods mount the claim. Deleting it while a Pod uses it leaves it Terminating until that Pod is gone." },
              { id: "bound-pv", label: "PV", sub: "Bound, CLAIM default/data", detail: "The PV records which claim holds it and is not offered to any other claim." },
            ],
          },
          {
            id: "released",
            label: "Claim deleted",
            sub: "reclaim policy decides",
            detail: "The PV's persistentVolumeReclaimPolicy decides what happens to the storage once its claim is gone.",
            children: [
              { id: "rel-delete", label: "Delete", sub: "PV and disk removed", detail: "The default for dynamically provisioned volumes. The data is gone." },
              { id: "rel-retain", label: "Retain", sub: "PV Released, data kept", detail: "The PV still names the old claim, so new claims do not bind to it. An admin recovers or cleans the data and deletes the PV or clears its claimRef." },
            ],
          },
        ],
      },
      steps: [
        {
          title: "Pending",
          text: "A new claim has no PV yet. It binds when a matching PV exists or one is provisioned.",
          highlight: ["pending", "pending-pvc", "pending-pv"],
        },
        {
          title: "Bound",
          text: "Claim and PV are paired one to one. This is the normal working state.",
          highlight: ["bound", "bound-pvc", "bound-pv"],
        },
        {
          title: "Delete policy",
          text: "Deleting the claim deletes the PV and the disk behind it.",
          highlight: ["released", "rel-delete"],
        },
        {
          title: "Retain policy",
          text: "Deleting the claim leaves the PV Released with its data intact, waiting for an admin.",
          highlight: ["released", "rel-retain"],
        },
      ],
    },
  ],
};
