import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "volumes-ephemeral",
    topic: "Volumes",
    difficulty: "beginner",
    question: "A container writes /var/data/report.csv to its own filesystem, with no volume mounted there, and then crashes. What does the restarted container see?",
    options: [
      { id: "a", text: "The file, because the kubelet keeps the writable layer across restarts" },
      { id: "b", text: "No file, because the new container starts from a fresh copy of the image" },
      { id: "c", text: "The file, but only if the Pod has restartPolicy: Always" },
      { id: "d", text: "No file, and the Pod is moved to another node" },
    ],
    correctOptionId: "b",
    explanation:
      "Each container's writable layer is thrown away when the container is replaced. restartPolicy decides whether it restarts, not what it keeps, and a restart does not move the Pod.",
  },
  {
    id: "volumes-mount-link",
    topic: "Volumes YAML",
    difficulty: "beginner",
    question: "In a Pod spec, what connects an entry under spec.volumes to an entry under a container's volumeMounts?",
    options: [
      { id: "a", text: "The mountPath must equal the volume's path" },
      { id: "b", text: "They are matched by their order in the two lists" },
      { id: "c", text: "The name field must be the same in both" },
      { id: "d", text: "A label on the container that matches the volume" },
    ],
    correctOptionId: "c",
    explanation:
      "volumeMounts[].name refers to volumes[].name. mountPath is only where the volume appears in that container, and order or labels play no part.",
  },
  {
    id: "volumes-unknown-mount",
    topic: "Volumes YAML",
    difficulty: "intermediate",
    question: "A container has volumeMounts: [{name: cache, mountPath: /cache}] but the Pod's volumes list only has an entry named data. What happens on apply?",
    options: [
      { id: "a", text: "The Pod is rejected because the mount names a volume that does not exist" },
      { id: "b", text: "Kubernetes creates an emptyDir named cache automatically" },
      { id: "c", text: "The container starts and /cache is an ordinary directory in its own layer" },
      { id: "d", text: "The data volume is mounted at /cache instead" },
    ],
    correctOptionId: "a",
    explanation:
      "Every mount must name a volume declared in spec.volumes, so validation fails. Nothing is created or substituted automatically.",
  },
  {
    id: "volumes-emptydir-life",
    topic: "emptyDir",
    difficulty: "beginner",
    question: "How long does the data in an emptyDir volume last?",
    options: [
      { id: "a", text: "Until the container that wrote it restarts" },
      { id: "b", text: "Until the node is rebooted, across any number of Pods" },
      { id: "c", text: "Until the Deployment that owns the Pod is deleted" },
      { id: "d", text: "As long as the Pod exists on its node; it survives container restarts and is deleted with the Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "An emptyDir belongs to the Pod. Container restarts keep it, and removing the Pod deletes it. A Deployment's replacement Pod gets a new, empty one.",
  },
  {
    id: "volumes-emptydir-share",
    topic: "emptyDir",
    difficulty: "intermediate",
    question: "Container web mounts emptyDir shared at /usr/share/nginx/html and container content mounts it at /work, in the same Pod. content writes /work/index.html. What does web see?",
    options: [
      { id: "a", text: "Nothing, each container gets its own copy of an emptyDir" },
      { id: "b", text: "/work/index.html, because the path is the same in every container" },
      { id: "c", text: "/usr/share/nginx/html/index.html with the same contents" },
      { id: "d", text: "The file only after the Pod restarts" },
    ],
    correctOptionId: "c",
    explanation:
      "Both mounts point at the same directory, so the file appears at once under each container's own mountPath. Sharing files between containers is the main use of emptyDir.",
  },
  {
    id: "volumes-emptydir-yaml",
    topic: "Volumes YAML",
    difficulty: "beginner",
    question: "Which volumes entry declares a scratch directory that lives as long as the Pod?",
    options: [
      { id: "a", text: "volumes: [{name: scratch, emptyDir: {}}]" },
      { id: "b", text: "volumes: [{name: scratch, persistentVolumeClaim: {}}]" },
      { id: "c", text: "volumes: [{name: scratch, hostPath: {}}]" },
      { id: "d", text: "volumes: [{name: scratch, mountPath: /tmp}]" },
    ],
    correctOptionId: "a",
    explanation:
      "emptyDir: {} is a valid empty-directory volume. persistentVolumeClaim needs a claimName, hostPath needs a path, and mountPath belongs in volumeMounts, not volumes.",
  },
  {
    id: "volumes-hostpath",
    topic: "hostPath",
    difficulty: "intermediate",
    question: "Why should application Pods avoid hostPath volumes?",
    options: [
      { id: "a", text: "hostPath volumes are always read-only" },
      { id: "b", text: "hostPath is deleted together with the Pod, like emptyDir" },
      { id: "c", text: "hostPath only works on the control plane node" },
      { id: "d", text: "The data stays on one node, and the Pod can read or change the node's own files" },
    ],
    correctOptionId: "d",
    explanation:
      "A rescheduled Pod sees a different node's directory, and access to the node filesystem is a security risk, which is why Pod Security baseline forbids it. hostPath data is not deleted with the Pod and can be writable.",
  },
  {
    id: "volumes-roles",
    topic: "PV and PVC",
    difficulty: "beginner",
    question: "Which object does a developer normally create to get persistent storage for an app?",
    options: [
      { id: "a", text: "A StorageClass" },
      { id: "b", text: "A PersistentVolumeClaim" },
      { id: "c", text: "A PersistentVolume" },
      { id: "d", text: "A CSI driver" },
    ],
    correctOptionId: "b",
    explanation:
      "Developers request storage with a namespaced claim. Admins define StorageClasses and install CSI drivers, and PVs are created by admins or by provisioners.",
  },
  {
    id: "volumes-scope",
    topic: "PV and PVC",
    difficulty: "intermediate",
    question: "Which of these objects is namespaced?",
    options: [
      { id: "a", text: "PersistentVolumeClaim" },
      { id: "b", text: "PersistentVolume" },
      { id: "c", text: "StorageClass" },
      { id: "d", text: "None of them; storage is always cluster-scoped" },
    ],
    correctOptionId: "a",
    explanation:
      "Claims live in a namespace and are used by Pods in that namespace. PVs and StorageClasses are cluster-scoped, so -n does not apply to them.",
  },
  {
    id: "volumes-dynamic",
    topic: "Provisioning",
    difficulty: "intermediate",
    question: "In dynamic provisioning, who creates the PersistentVolume object?",
    options: [
      { id: "a", text: "The developer, right after creating the claim" },
      { id: "b", text: "The kubelet, when the Pod starts" },
      { id: "c", text: "The StorageClass's provisioner, for that specific claim" },
      { id: "d", text: "The scheduler, as part of placing the Pod" },
    ],
    correctOptionId: "c",
    explanation:
      "The provisioner named in the class creates the storage and a PV sized to the claim. In static provisioning an admin writes PVs ahead of time instead.",
  },
  {
    id: "volumes-default-class",
    topic: "StorageClass",
    difficulty: "intermediate",
    question: "A PVC has no storageClassName field and the cluster has a default StorageClass named standard. Which class does the claim use?",
    options: [
      { id: "a", text: "None; it only binds to static PVs without a class" },
      { id: "b", text: "standard, the default class" },
      { id: "c", text: "Whichever class has the most free capacity" },
      { id: "d", text: "The claim is rejected until a class is named" },
    ],
    correctOptionId: "b",
    explanation:
      "Leaving the field out means the default class is filled in. Explicitly setting storageClassName: \"\" is what restricts a claim to static PVs with no class.",
  },
  {
    id: "volumes-empty-class",
    topic: "PVC YAML",
    difficulty: "advanced",
    question: "A claim sets storageClassName: \"\". What can it bind to?",
    options: [
      { id: "a", text: "A PV dynamically created by the default class" },
      { id: "b", text: "Any Available PV regardless of its class" },
      { id: "c", text: "Nothing; an empty class name is invalid" },
      { id: "d", text: "Only an existing PV that also has no class" },
    ],
    correctOptionId: "d",
    explanation:
      "The empty string disables dynamic provisioning and default class assignment. The claim binds only to a static PV whose storageClassName is also empty.",
  },
  {
    id: "volumes-missing-class",
    topic: "Troubleshooting",
    difficulty: "intermediate",
    question: "kubectl describe pvc data shows storageclass.storage.k8s.io \"fast\" not found, and the Pod using it is Pending. What is the fix?",
    options: [
      { id: "a", text: "Delete the Pod and the claim, recreate the claim with an existing class, then recreate the Pod" },
      { id: "b", text: "Restart the kubelet on every node" },
      { id: "c", text: "Edit the claim's storageClassName in place with kubectl edit" },
      { id: "d", text: "Increase the claim's storage request" },
    ],
    correctOptionId: "a",
    explanation:
      "A claim's class cannot be changed after creation, so it must be recreated, and the Pod must go first or the claim waits in Terminating. Size and kubelet restarts have nothing to do with a missing class.",
  },
  {
    id: "volumes-binding-size",
    topic: "Binding",
    difficulty: "intermediate",
    question: "A 2Gi RWO claim of class manual is created. Available PVs of class manual with RWO: 1Gi, 5Gi, 10Gi. What happens?",
    options: [
      { id: "a", text: "It binds to the 1Gi PV and grows it to 2Gi" },
      { id: "b", text: "It binds to the 10Gi PV, the largest" },
      { id: "c", text: "It binds to the 5Gi PV and gets all 5Gi" },
      { id: "d", text: "It stays Pending because no PV is exactly 2Gi" },
    ],
    correctOptionId: "c",
    explanation:
      "The smallest PV with at least the requested capacity wins, and binding is one to one, so the claim gets the whole 5Gi. Nothing is resized during binding.",
  },
  {
    id: "volumes-binding-modes",
    topic: "Binding",
    difficulty: "advanced",
    question: "A claim requests ReadWriteMany. The only matching-class PV offers ReadWriteOnce and has plenty of space, and the class cannot provision. What happens?",
    options: [
      { id: "a", text: "It binds and Kubernetes enforces one node at a time" },
      { id: "b", text: "It stays Pending, because the PV does not offer every requested mode" },
      { id: "c", text: "It binds as ReadOnlyMany instead" },
      { id: "d", text: "The PV's access modes are changed to ReadWriteMany" },
    ],
    correctOptionId: "b",
    explanation:
      "A PV must list every access mode the claim asks for. No downgrade or change to the PV happens, so the claim waits.",
  },
  {
    id: "volumes-rwo",
    topic: "Access modes",
    difficulty: "advanced",
    question: "Two Pods use the same ReadWriteOnce claim and are scheduled to the same node. What happens?",
    options: [
      { id: "a", text: "The second Pod stays Pending until the first is deleted" },
      { id: "b", text: "The second Pod gets the volume mounted read-only" },
      { id: "c", text: "Each Pod gets its own copy of the data" },
      { id: "d", text: "Both mount it read-write, because RWO limits the volume to one node, not one Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "ReadWriteOnce means one node at a time. Pods on that node share it. ReadWriteOncePod is the mode that limits a volume to a single Pod.",
  },
  {
    id: "volumes-rwop",
    topic: "Access modes",
    difficulty: "intermediate",
    question: "Which access mode guarantees that only one Pod in the whole cluster can use the volume?",
    options: [
      { id: "a", text: "ReadWriteOncePod" },
      { id: "b", text: "ReadWriteOnce" },
      { id: "c", text: "ReadOnlyMany" },
      { id: "d", text: "ReadWriteMany" },
    ],
    correctOptionId: "a",
    explanation:
      "RWOP restricts the volume to a single Pod; a second Pod using the claim cannot start. RWO allows several Pods on one node, and the Many modes allow many nodes.",
  },
  {
    id: "volumes-retain",
    topic: "Reclaim policy",
    difficulty: "intermediate",
    question: "A PV with persistentVolumeReclaimPolicy: Retain is bound to a claim, and the claim is deleted. What is the PV's state?",
    options: [
      { id: "a", text: "Available, ready for the next claim" },
      { id: "b", text: "Released, with the data still on the storage" },
      { id: "c", text: "Deleted along with the disk" },
      { id: "d", text: "Bound to the same claim name forever" },
    ],
    correctOptionId: "b",
    explanation:
      "Retain keeps the PV and the data. The PV is Released and still references the old claim, so it is not reused until an admin cleans it up. Delete is the policy that removes it.",
  },
  {
    id: "volumes-reclaim-yaml",
    topic: "PV YAML",
    difficulty: "intermediate",
    question: "Which StorageClass field makes dynamically provisioned volumes keep their data after the claim is deleted?",
    options: [
      { id: "a", text: "volumeBindingMode: WaitForFirstConsumer" },
      { id: "b", text: "allowVolumeExpansion: true" },
      { id: "c", text: "reclaimPolicy: Retain" },
      { id: "d", text: "provisioner: retain.csi.k8s.io" },
    ],
    correctOptionId: "c",
    explanation:
      "Provisioned PVs inherit the class's reclaimPolicy, which defaults to Delete. Binding mode and expansion do not affect what happens on deletion, and the provisioner only names the driver.",
  },
  {
    id: "volumes-wffc",
    topic: "StorageClass",
    difficulty: "advanced",
    question: "Why do multi-zone clusters usually use volumeBindingMode: WaitForFirstConsumer?",
    options: [
      { id: "a", text: "It lets a single volume be mounted in several zones" },
      { id: "b", text: "It makes provisioning faster" },
      { id: "c", text: "It deletes unused claims automatically" },
      { id: "d", text: "The disk is created after the Pod is scheduled, in a zone where that Pod can run" },
    ],
    correctOptionId: "d",
    explanation:
      "With Immediate binding the disk may be created in a zone where the Pod cannot be scheduled. Waiting for the Pod lets the scheduler pick a node first. It is not faster and does not make volumes multi-zone.",
  },
  {
    id: "volumes-protection",
    topic: "PVC protection",
    difficulty: "intermediate",
    question: "You run kubectl delete pvc data while a running Pod still mounts it. What happens?",
    options: [
      { id: "a", text: "The claim shows Terminating and is removed after the Pod using it is gone" },
      { id: "b", text: "The claim is deleted at once and the Pod crashes" },
      { id: "c", text: "kubectl refuses the command with an error" },
      { id: "d", text: "The Pod is deleted first, then the claim" },
    ],
    correctOptionId: "a",
    explanation:
      "The kubernetes.io/pvc-protection finalizer delays removal until no Pod uses the claim. The delete is accepted, but nothing is pulled from under the Pod and the Pod is not deleted for you.",
  },
  {
    id: "volumes-pvc-yaml",
    topic: "PVC YAML",
    difficulty: "beginner",
    question: "Where does a PersistentVolumeClaim say how much storage it needs?",
    options: [
      { id: "a", text: "spec.capacity.storage" },
      { id: "b", text: "spec.resources.requests.storage" },
      { id: "c", text: "spec.storage.size" },
      { id: "d", text: "metadata.annotations.storage" },
    ],
    correctOptionId: "b",
    explanation:
      "A claim requests storage under spec.resources.requests.storage, for example 1Gi. spec.capacity.storage is the field on a PersistentVolume, which describes how big it actually is.",
  },
  {
    id: "volumes-pod-claim-yaml",
    topic: "Volumes YAML",
    difficulty: "beginner",
    question: "Which volumes entry mounts the claim named data into a Pod?",
    options: [
      { id: "a", text: "volumes: [{name: data, persistentVolume: {name: data}}]" },
      { id: "b", text: "volumes: [{name: data, storageClassName: data}]" },
      { id: "c", text: "volumes: [{name: data, persistentVolumeClaim: {claimName: data}}]" },
      { id: "d", text: "volumes: [{name: data, emptyDir: {claim: data}}]" },
    ],
    correctOptionId: "c",
    explanation:
      "Pods reference a claim with persistentVolumeClaim.claimName. They never name a PV directly, and a class or an emptyDir cannot point at a claim.",
  },
  {
    id: "volumes-expand",
    topic: "Expansion",
    difficulty: "advanced",
    question: "A Bound claim of 5Gi needs to become 20Gi. What is required?",
    options: [
      { id: "a", text: "Delete the claim and create a 20Gi one; data carries over" },
      { id: "b", text: "Edit the PV's capacity; the claim follows" },
      { id: "c", text: "Nothing; claims grow automatically when full" },
      { id: "d", text: "A class with allowVolumeExpansion: true, then raise the claim's storage request to 20Gi" },
    ],
    correctOptionId: "d",
    explanation:
      "Expansion is done by raising spec.resources.requests.storage on the claim, and only if its class allows it. Deleting the claim may delete the data, and claims never grow on their own.",
  },
  {
    id: "volumes-csi",
    topic: "CSI",
    difficulty: "intermediate",
    question: "What is a CSI driver?",
    options: [
      { id: "a", text: "A built-in Kubernetes controller that formats every disk" },
      { id: "b", text: "A vendor's storage plugin, running in the cluster, that creates, attaches, and mounts volumes" },
      { id: "c", text: "A command-line tool for copying files between Pods" },
      { id: "d", text: "A kind of PersistentVolume that stores data in etcd" },
    ],
    correctOptionId: "b",
    explanation:
      "The Container Storage Interface lets storage vendors ship drivers as Pods, usually a controller plus a node DaemonSet. A StorageClass's provisioner field names the driver.",
  },
  {
    id: "volumes-readonly-mount",
    topic: "Volumes YAML",
    difficulty: "intermediate",
    question: "Two containers in a Pod mount the same volume. One of them must only read it. How do you do that?",
    options: [
      { id: "a", text: "Set readOnly: true on that container's volumeMounts entry" },
      { id: "b", text: "Set accessModes: [ReadOnlyMany] on the claim" },
      { id: "c", text: "Mount it under a path that starts with /readonly" },
      { id: "d", text: "Add a second volumes entry with emptyDir for that container" },
    ],
    correctOptionId: "a",
    explanation:
      "readOnly on a volumeMount makes that one container's mount read-only. Access modes are not a permission system inside containers: they say how many nodes may mount the volume and how. An emptyDir would be a different, empty volume.",
  },
  {
    id: "volumes-emptydir-memory",
    topic: "emptyDir",
    difficulty: "advanced",
    question: "What is the trade-off of emptyDir: {medium: Memory}?",
    options: [
      { id: "a", text: "The data survives Pod deletion, but it is slower" },
      { id: "b", text: "Every Pod on the node shares the same directory" },
      { id: "c", text: "It is a fast tmpfs, but the files count toward the container's memory limit" },
      { id: "d", text: "Files are written to the node's disk and only cached in memory" },
    ],
    correctOptionId: "c",
    explanation:
      "medium: Memory backs the emptyDir with tmpfs instead of the node's disk. It is faster, but what you store uses memory and counts toward the memory limit. Like any emptyDir it belongs to one Pod and is deleted with it.",
  },
  {
    id: "volumes-configmap-files",
    topic: "Volumes",
    difficulty: "beginner",
    question:
      "A ConfigMap nginx-conf has the keys default.conf and gzip.conf. It is mounted as a volume at /etc/nginx/conf.d. What does the container see there?",
    options: [
      { id: "a", text: "One file named nginx-conf holding both keys" },
      { id: "b", text: "Nothing; ConfigMaps can only be environment variables" },
      { id: "c", text: "An empty directory that fills after the Pod restarts" },
      { id: "d", text: "Two files, default.conf and gzip.conf, each holding its key's value" },
    ],
    correctOptionId: "d",
    explanation:
      "In a configMap or secret volume, each key becomes a file under the mount path. That is how whole config files and certificates are delivered. The volume is read-only.",
  },
  {
    id: "volumes-multi-attach",
    topic: "Access modes",
    difficulty: "advanced",
    question:
      "A Deployment with 2 replicas shares one ReadWriteOnce claim on a cloud disk. The replica on a second node is stuck in ContainerCreating with a Multi-Attach error. Each replica should have its own data. What is the fix?",
    options: [
      { id: "a", text: "Run it as a StatefulSet with volumeClaimTemplates, so each Pod gets its own claim" },
      { id: "b", text: "Restart the kubelet on the second node" },
      { id: "c", text: "Change the claim's access mode to ReadWriteMany in place" },
      { id: "d", text: "Raise the claim's storage request" },
    ],
    correctOptionId: "a",
    explanation:
      "A cloud block disk attaches to one node at a time, so a second node cannot mount it. volumeClaimTemplates give one claim per replica. Access modes cannot be changed on an existing claim, and the disk could not offer RWX anyway.",
  },
  {
    id: "volumes-wffc-pending",
    topic: "Binding",
    difficulty: "intermediate",
    question:
      "A new claim of a WaitForFirstConsumer class shows Pending, and kubectl describe pvc says waiting for first consumer to be created before binding. No Pod uses it yet. What does that mean?",
    options: [
      { id: "a", text: "The StorageClass does not exist" },
      { id: "b", text: "The cluster is out of disk space" },
      { id: "c", text: "It is normal; the claim binds once a Pod that uses it is scheduled" },
      { id: "d", text: "The claim must be recreated with a class that uses Immediate" },
    ],
    correctOptionId: "c",
    explanation:
      "With WaitForFirstConsumer, binding and provisioning wait until a Pod using the claim is scheduled, so the disk lands in that node's zone. A missing class shows a not found message instead.",
  },
  {
    id: "volumes-delete-policy",
    topic: "Reclaim policy",
    difficulty: "intermediate",
    question:
      "A claim was dynamically provisioned from a class that does not set reclaimPolicy. No Pod uses it, and you delete the claim. What happens to the data?",
    options: [
      { id: "a", text: "The PV becomes Released and the data stays" },
      { id: "b", text: "The PV becomes Available for the next claim, with the old files" },
      { id: "c", text: "The data is kept until the namespace is deleted" },
      { id: "d", text: "The PV and the underlying disk are deleted, and the data with them" },
    ],
    correctOptionId: "d",
    explanation:
      "A class's reclaimPolicy defaults to Delete, and dynamically provisioned PVs take it. Deleting the claim deletes the PV and the disk. Released with the data kept is what Retain does.",
  },
];
