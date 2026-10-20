import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "daemonsets-statefulsets-ds-use",
    topic: "DaemonSets",
    difficulty: "beginner",
    question: "Which workload fits a DaemonSet best?",
    options: [
      { id: "a", text: "A web frontend that needs 5 replicas" },
      { id: "b", text: "A log collector that reads /var/log on every node" },
      { id: "c", text: "A nightly database backup" },
      { id: "d", text: "A single PostgreSQL primary" },
    ],
    correctOptionId: "b",
    explanation:
      "A DaemonSet runs one Pod per eligible node, which is what a per-node agent needs. A frontend wants a replica count (Deployment), a nightly task wants a CronJob, and a database wants stable storage (StatefulSet or an operator).",
  },
  {
    id: "daemonsets-statefulsets-ds-count",
    topic: "DaemonSets",
    difficulty: "beginner",
    question:
      "A cluster has one control plane node tainted node-role.kubernetes.io/control-plane:NoSchedule and three workers. A DaemonSet has no tolerations and no nodeSelector. How many Pods does it run?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "1" },
      { id: "c", text: "3" },
      { id: "d", text: "0" },
    ],
    correctOptionId: "c",
    explanation:
      "One Pod per node the Pod is allowed on. The control plane taint keeps it off that node, so it runs on the three workers only.",
  },
  {
    id: "daemonsets-statefulsets-ds-replicas",
    topic: "DaemonSet YAML",
    difficulty: "beginner",
    question: "Which Deployment field has no place in a DaemonSet spec?",
    options: [
      { id: "a", text: "replicas" },
      { id: "b", text: "selector" },
      { id: "c", text: "template" },
      { id: "d", text: "template.spec.containers" },
    ],
    correctOptionId: "a",
    explanation:
      "The number of DaemonSet Pods comes from the number of eligible nodes, so there is no replicas field. selector and template work the same way as in a Deployment.",
  },
  {
    id: "daemonsets-statefulsets-ds-toleration",
    topic: "DaemonSet YAML",
    difficulty: "intermediate",
    question:
      "Which Pod template addition lets a DaemonSet also run on a control plane node tainted node-role.kubernetes.io/control-plane:NoSchedule?",
    options: [
      { id: "a", text: "nodeSelector: {kubernetes.io/os: linux}" },
      { id: "b", text: "replicas: 3" },
      { id: "c", text: "restartPolicy: Always" },
      { id: "d", text: "tolerations: [{key: node-role.kubernetes.io/control-plane, operator: Exists, effect: NoSchedule}]" },
    ],
    correctOptionId: "d",
    explanation:
      "A taint repels every Pod that does not tolerate it. The toleration with the same key and effect lets the Pod onto the node. The nodeSelector only narrows the choice of nodes; it cannot override a taint. The other two fields have nothing to do with taints.",
  },
  {
    id: "daemonsets-statefulsets-ds-nodeselector",
    topic: "DaemonSets",
    difficulty: "intermediate",
    question:
      "A DaemonSet has nodeSelector disktype: ssd, and only worker-2 has that label. You run kubectl label node worker-1 disktype=ssd. What happens?",
    options: [
      { id: "a", text: "Nothing until you apply the DaemonSet again" },
      { id: "b", text: "The Pod on worker-2 moves to worker-1" },
      { id: "c", text: "A new Pod starts on worker-1 and worker-2 keeps its Pod" },
      { id: "d", text: "kubectl rejects the label because a DaemonSet uses it" },
    ],
    correctOptionId: "c",
    explanation:
      "The DaemonSet controller watches nodes. worker-1 now matches the selector, so it gets its own Pod. worker-2 still matches, so its Pod stays.",
  },
  {
    id: "daemonsets-statefulsets-ds-new-node",
    topic: "DaemonSets",
    difficulty: "beginner",
    question: "A new worker node joins a cluster that runs a node-exporter DaemonSet with no selector or tolerations. What happens?",
    options: [
      { id: "a", text: "The DaemonSet controller creates a node-exporter Pod on the new node" },
      { id: "b", text: "Nothing until you scale the DaemonSet up by one" },
      { id: "c", text: "One existing node-exporter Pod moves to the new node" },
      { id: "d", text: "The new node is refused until node-exporter is installed by hand" },
    ],
    correctOptionId: "a",
    explanation:
      "Following nodes is the whole point of a DaemonSet. Every eligible node gets one Pod, including nodes added later. There is no replica count to scale.",
  },
  {
    id: "daemonsets-statefulsets-ds-ondelete",
    topic: "DaemonSet YAML",
    difficulty: "intermediate",
    question: "A DaemonSet has updateStrategy type: OnDelete. You change its image and apply. What happens?",
    options: [
      { id: "a", text: "All Pods are replaced at the same time" },
      { id: "b", text: "The apply is rejected" },
      { id: "c", text: "The DaemonSet is deleted and recreated" },
      { id: "d", text: "Old Pods keep running; each node gets the new image only after you delete its Pod" },
    ],
    correctOptionId: "d",
    explanation:
      "OnDelete stores the new template but replaces nothing on its own. You choose when each node is updated by deleting its Pod. The default, RollingUpdate, replaces Pods for you.",
  },
  {
    id: "daemonsets-statefulsets-ds-rolling",
    topic: "DaemonSets",
    difficulty: "intermediate",
    question:
      "A DaemonSet runs on 3 nodes with updateStrategy RollingUpdate and maxUnavailable: 1 (maxSurge left at its default of 0). You change the image. How are the Pods replaced?",
    options: [
      { id: "a", text: "All three old Pods are deleted, then three new ones start" },
      { id: "b", text: "One node at a time: the old Pod is removed, the new one starts and becomes ready, then the next node" },
      { id: "c", text: "Three new Pods start next to the old ones before any old Pod is removed" },
      { id: "d", text: "Nothing changes until a node is rebooted" },
    ],
    correctOptionId: "b",
    explanation:
      "maxUnavailable: 1 allows one node without a ready agent at a time. With maxSurge 0, each old Pod is removed before its replacement starts on that node.",
  },
  {
    id: "daemonsets-statefulsets-ds-drain",
    topic: "DaemonSets",
    difficulty: "advanced",
    question: "kubectl drain worker-1 stops with an error about DaemonSet-managed Pods. What is the usual fix?",
    options: [
      { id: "a", text: "Run it again with --ignore-daemonsets, since a DaemonSet Pod would only be recreated on the same node" },
      { id: "b", text: "Delete the DaemonSet first" },
      { id: "c", text: "Scale the DaemonSet to 0 replicas" },
      { id: "d", text: "Remove the node from the cluster" },
    ],
    correctOptionId: "a",
    explanation:
      "Evicting a DaemonSet Pod is pointless: the controller tolerates the unschedulable taint and puts it straight back. --ignore-daemonsets tells drain to leave them alone. DaemonSets have no replica count to scale.",
  },
  {
    id: "daemonsets-statefulsets-sts-names",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "A StatefulSet named db has replicas: 3. What are its Pod names?",
    options: [
      { id: "a", text: "db-7c5ddbdf54-x8k2p and two more random names" },
      { id: "b", text: "db-1, db-2, db-3" },
      { id: "c", text: "db-a, db-b, db-c" },
      { id: "d", text: "db-0, db-1, db-2" },
    ],
    correctOptionId: "d",
    explanation:
      "StatefulSet Pods are named <statefulset>-<ordinal>, with ordinals starting at 0. Random suffixes are what ReplicaSets use.",
  },
  {
    id: "daemonsets-statefulsets-sts-delete-pod",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "You delete Pod web-1 of a StatefulSet with replicas: 3. What happens?",
    options: [
      { id: "a", text: "A new Pod named web-3 is created" },
      { id: "b", text: "A new Pod named web-1 is created and mounts the same PVC, data-web-1" },
      { id: "c", text: "The StatefulSet drops to 2 replicas" },
      { id: "d", text: "The PVC data-web-1 is deleted with the Pod" },
    ],
    correctOptionId: "b",
    explanation:
      "The StatefulSet recreates the missing ordinal with the same name, and that Pod gets the same claim back, so its data is still there.",
  },
  {
    id: "daemonsets-statefulsets-sts-headless",
    topic: "StatefulSet YAML",
    difficulty: "intermediate",
    question: "Which field makes a Service headless?",
    options: [
      { id: "a", text: "type: Headless" },
      { id: "b", text: "selector: {}" },
      { id: "c", text: "clusterIP: None" },
      { id: "d", text: "ports: []" },
    ],
    correctOptionId: "c",
    explanation:
      "clusterIP: None means no virtual IP. DNS then returns the Pod IPs directly and creates a record per StatefulSet Pod. There is no Service type called Headless, an empty selector does not remove the IP, and leaving out ports only removes SRV records.",
  },
  {
    id: "daemonsets-statefulsets-sts-dns",
    topic: "StatefulSets",
    difficulty: "intermediate",
    question:
      "A StatefulSet web has serviceName: web, and a headless Service web exists, all in namespace shop. What is the full DNS name of Pod web-2?",
    options: [
      { id: "a", text: "web.shop.svc.cluster.local/web-2" },
      { id: "b", text: "web-2.shop.pod.cluster.local" },
      { id: "c", text: "web-2.cluster.local" },
      { id: "d", text: "web-2.web.shop.svc.cluster.local" },
    ],
    correctOptionId: "d",
    explanation:
      "Per-Pod records have the form <pod>.<service>.<namespace>.svc.cluster.local. Inside the same namespace, web-2.web is enough.",
  },
  {
    id: "daemonsets-statefulsets-sts-pvc-name",
    topic: "StatefulSet YAML",
    difficulty: "intermediate",
    question:
      "A StatefulSet named db has a volumeClaimTemplates entry named data. What is the PVC for its second Pod called?",
    options: [
      { id: "a", text: "data-db-1" },
      { id: "b", text: "db-1-data" },
      { id: "c", text: "data-2" },
      { id: "d", text: "db-data" },
    ],
    correctOptionId: "a",
    explanation:
      "The name is <template name>-<statefulset>-<ordinal>. The second Pod is db-1, so its claim is data-db-1.",
  },
  {
    id: "daemonsets-statefulsets-sts-scaledown-pvc",
    topic: "StatefulSets",
    difficulty: "intermediate",
    question: "You scale StatefulSet web from 3 to 1. What happens to the PVCs data-web-1 and data-web-2?",
    options: [
      { id: "a", text: "They are deleted with the Pods" },
      { id: "b", text: "They are attached to web-0" },
      { id: "c", text: "They are kept, and web-1 and web-2 mount them again if you scale back up" },
      { id: "d", text: "They are converted into ConfigMaps" },
    ],
    correctOptionId: "c",
    explanation:
      "By default a StatefulSet never deletes the claims it created, so scaling back up restores each ordinal's data. You can change this with persistentVolumeClaimRetentionPolicy.",
  },
  {
    id: "daemonsets-statefulsets-sts-order",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "A StatefulSet with the default podManagementPolicy is created with replicas: 3. In what order do its Pods start?",
    options: [
      { id: "a", text: "All three at once" },
      { id: "b", text: "web-0 first, web-1 once web-0 is Running and ready, then web-2" },
      { id: "c", text: "web-2 first, then web-1, then web-0" },
      { id: "d", text: "In random order" },
    ],
    correctOptionId: "b",
    explanation:
      "The default policy, OrderedReady, creates Pods in ordinal order and waits for each to be Running and ready before creating the next.",
  },
  {
    id: "daemonsets-statefulsets-sts-scaledown-order",
    topic: "StatefulSets",
    difficulty: "intermediate",
    question: "You scale StatefulSet web from 3 to 1 with the default policy. Which Pods go, and in what order?",
    options: [
      { id: "a", text: "web-2 first, then web-1" },
      { id: "b", text: "web-0 first, then web-1" },
      { id: "c", text: "web-1 and web-2 at the same time" },
      { id: "d", text: "Whichever two Pods are not ready" },
    ],
    correctOptionId: "a",
    explanation:
      "Scale down goes in reverse ordinal order, one Pod at a time. web-0 stays, which matters when ordinal 0 is the primary or the first member of a cluster.",
  },
  {
    id: "daemonsets-statefulsets-sts-parallel",
    topic: "StatefulSet YAML",
    difficulty: "advanced",
    question: "What does podManagementPolicy: Parallel change?",
    options: [
      { id: "a", text: "Pods get random names instead of ordinals" },
      { id: "b", text: "All Pods share one PVC" },
      { id: "c", text: "Rolling updates replace every Pod at once" },
      { id: "d", text: "Pods are created and deleted together without waiting for each other; names and PVCs stay per ordinal" },
    ],
    correctOptionId: "d",
    explanation:
      "Parallel only drops the one-at-a-time wait when scaling. Each Pod still has its ordinal name, DNS record, and own claim. It does not affect how rolling updates proceed.",
  },
  {
    id: "daemonsets-statefulsets-sts-stateless",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "You run a stateless REST API with 4 identical replicas that keep no local data. Which workload fits?",
    options: [
      { id: "a", text: "A StatefulSet, so each replica has a stable name" },
      { id: "b", text: "A DaemonSet, so it runs on every node" },
      { id: "c", text: "A Deployment" },
      { id: "d", text: "Four separate Pods" },
    ],
    correctOptionId: "c",
    explanation:
      "Identical, replaceable replicas are what a Deployment is for. A StatefulSet adds ordered startup and per-Pod storage you do not need, and makes rollouts slower.",
  },
  {
    id: "daemonsets-statefulsets-sts-operator",
    topic: "StatefulSets",
    difficulty: "advanced",
    question: "You need a production PostgreSQL with replication, automatic failover, and backups. What is usually the better choice?",
    options: [
      { id: "a", text: "A plain StatefulSet, which handles failover on its own" },
      { id: "b", text: "A managed database service or a PostgreSQL operator" },
      { id: "c", text: "A DaemonSet with one database Pod per node" },
      { id: "d", text: "A Deployment with replicas: 3 sharing one ReadWriteOnce PVC" },
    ],
    correctOptionId: "b",
    explanation:
      "A StatefulSet gives stable names and storage, nothing more. It does not know which Pod is the primary, promote a replica, or take backups. Operators and managed services do that work.",
  },
  {
    id: "daemonsets-statefulsets-sts-servicename",
    topic: "StatefulSet YAML",
    difficulty: "intermediate",
    question: "What should spec.serviceName in a StatefulSet name?",
    options: [
      { id: "a", text: "A LoadBalancer Service that exposes the Pods outside the cluster" },
      { id: "b", text: "The StatefulSet itself" },
      { id: "c", text: "The ServiceAccount the Pods run as" },
      { id: "d", text: "The headless Service that gives each Pod its DNS record" },
    ],
    correctOptionId: "d",
    explanation:
      "serviceName ties the Pods to a headless Service, and DNS names like web-0.web come from it. You create that Service yourself; the StatefulSet does not.",
  },
  {
    id: "daemonsets-statefulsets-sts-vct",
    topic: "StatefulSet YAML",
    difficulty: "advanced",
    question:
      "Why does a StatefulSet use volumeClaimTemplates instead of a persistentVolumeClaim volume with one claimName in its Pod template?",
    options: [
      { id: "a", text: "claimName is not allowed in Pod templates" },
      { id: "b", text: "volumeClaimTemplates volumes are faster" },
      { id: "c", text: "Each ordinal gets its own claim; one claimName would make every Pod mount the same volume" },
      { id: "d", text: "volumeClaimTemplates store data in etcd" },
    ],
    correctOptionId: "c",
    explanation:
      "The template is stamped out once per ordinal (data-web-0, data-web-1, ...). A fixed claimName points every Pod at the same claim, which a ReadWriteOnce volume on different nodes cannot serve.",
  },
  {
    id: "daemonsets-statefulsets-ds-vs-deploy",
    topic: "DaemonSets",
    difficulty: "intermediate",
    question: "Why not run a node exporter as a Deployment with replicas set to the number of nodes?",
    options: [
      { id: "a", text: "The scheduler may put two replicas on one node and none on another, and new nodes get none" },
      { id: "b", text: "Deployments cannot run more than one replica" },
      { id: "c", text: "Deployment Pods cannot read node metrics" },
      { id: "d", text: "Deployments only run on the control plane" },
    ],
    correctOptionId: "a",
    explanation:
      "A Deployment counts Pods, not nodes. Nothing guarantees one per node, and the count does not follow the cluster as nodes come and go. A DaemonSet does both.",
  },
  {
    id: "daemonsets-statefulsets-sts-delete",
    topic: "StatefulSets",
    difficulty: "advanced",
    question: "You run kubectl delete statefulset web. What happens to the PVCs data-web-0, data-web-1, and data-web-2?",
    options: [
      { id: "a", text: "They are deleted with the StatefulSet" },
      { id: "b", text: "They stay, and you delete them yourself when the data is no longer needed" },
      { id: "c", text: "They are renamed to show they are orphaned" },
      { id: "d", text: "They move to the default namespace" },
    ],
    correctOptionId: "b",
    explanation:
      "Claims outlive the StatefulSet by default so data is not lost by accident. Recreating the StatefulSet with the same names picks them up again. Deleting them is a separate, deliberate step.",
  },
  {
    id: "daemonsets-statefulsets-sts-update-order",
    topic: "StatefulSets",
    difficulty: "intermediate",
    question: "You change the image of StatefulSet web with 3 replicas and the default rolling update. In what order are the Pods replaced?",
    options: [
      { id: "a", text: "web-0 first, then web-1, then web-2" },
      { id: "b", text: "All three at the same time" },
      { id: "c", text: "web-2 first, then web-1, then web-0, one at a time" },
      { id: "d", text: "New Pods web-3 to web-5 start, then the old ones are deleted" },
    ],
    correctOptionId: "c",
    explanation:
      "A StatefulSet rolling update replaces Pods from the highest ordinal down, one at a time. Creation goes up from web-0; updates and scale-down go down. Names stay the same, so no new ordinals appear.",
  },
  {
    id: "daemonsets-statefulsets-sts-headless-dns",
    topic: "StatefulSets",
    difficulty: "intermediate",
    question: "A client looks up the name of a headless Service in DNS. What does it get back?",
    options: [
      { id: "a", text: "The IPs of the Pods behind the Service, because there is no virtual IP" },
      { id: "b", text: "One virtual IP that load-balances across the Pods" },
      { id: "c", text: "The IPs of the nodes the Pods run on" },
      { id: "d", text: "Nothing; only the per-Pod names resolve" },
    ],
    correctOptionId: "a",
    explanation:
      "clusterIP: None means no virtual IP and no load balancing. DNS answers with the Pod IPs directly, and each StatefulSet Pod also gets its own record such as web-0.web.",
  },
  {
    id: "daemonsets-statefulsets-sts-service-owner",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "Who creates the headless Service that a StatefulSet's serviceName refers to?",
    options: [
      { id: "a", text: "The StatefulSet controller, when the StatefulSet is created" },
      { id: "b", text: "You do, before or together with the StatefulSet" },
      { id: "c", text: "kube-proxy, when the first Pod is ready" },
      { id: "d", text: "CoreDNS, when the first DNS query arrives" },
    ],
    correctOptionId: "b",
    explanation:
      "serviceName only names the Service. The StatefulSet does not create it, so you apply it yourself. Without it the Pods get no per-Pod DNS records.",
  },
  {
    id: "daemonsets-statefulsets-sts-no-replicaset",
    topic: "StatefulSets",
    difficulty: "beginner",
    question: "You create StatefulSet web and run kubectl get replicasets. What do you find for web?",
    options: [
      { id: "a", text: "One ReplicaSet per Pod" },
      { id: "b", text: "One ReplicaSet named web-<hash>" },
      { id: "c", text: "One ReplicaSet per PersistentVolumeClaim" },
      { id: "d", text: "No ReplicaSet; the StatefulSet manages its Pods directly" },
    ],
    correctOptionId: "d",
    explanation:
      "A Deployment works through ReplicaSets, but a StatefulSet creates and replaces its Pods itself, so it can give each one a fixed ordinal, name, and claim.",
  },
  {
    id: "daemonsets-statefulsets-sts-retention",
    topic: "StatefulSet YAML",
    difficulty: "advanced",
    question: "Which StatefulSet field lets its claims be deleted automatically when the StatefulSet is deleted or scaled down?",
    options: [
      { id: "a", text: "reclaimPolicy: Delete under volumeClaimTemplates" },
      { id: "b", text: "persistentVolumeClaimRetentionPolicy" },
      { id: "c", text: "podManagementPolicy: Parallel" },
      { id: "d", text: "updateStrategy: {type: OnDelete}" },
    ],
    correctOptionId: "b",
    explanation:
      "Without persistentVolumeClaimRetentionPolicy, StatefulSet claims are kept on scale-down and on delete. A reclaim policy decides what happens to a PV after its claim is deleted; it does not delete the claim. The other two fields are about Pods, not storage.",
  },
  {
    id: "daemonsets-statefulsets-sts-vct-change",
    topic: "StatefulSet YAML",
    difficulty: "advanced",
    question: "You change storage: 1Gi to storage: 5Gi in the volumeClaimTemplates of an existing StatefulSet and apply. What happens?",
    options: [
      { id: "a", text: "The update is rejected; volumeClaimTemplates cannot be changed on an existing StatefulSet" },
      { id: "b", text: "Every existing claim grows to 5Gi" },
      { id: "c", text: "The Pods are recreated with new 5Gi claims and the old data is copied over" },
      { id: "d", text: "Only web-0's claim grows" },
    ],
    correctOptionId: "a",
    explanation:
      "Changing volumeClaimTemplates on an existing StatefulSet is rejected. The template is only used to create claims for new ordinals; it never resizes or replaces existing ones.",
  },
];
