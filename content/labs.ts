import type { LabDefinition } from "@/lib/labs";

export const labs: LabDefinition[] = [
  {
    id: "deployments-scale",
    title: "Scale the web Deployment",
    difficulty: "beginner",
    scenario: "The web Deployment runs a single nginx Pod. Traffic is going up and you need three.",
    instructions: [
      "Look at the current Deployment, its ReplicaSet, and its Pods.",
      "Scale the web Deployment to three replicas.",
      "Keep checking until all three Pods are ready.",
    ],
    fixture: {
      deployments: [{ name: "web", replicas: 1, image: "nginx:1.27", labels: { app: "web" } }],
    },
    objectives: [
      {
        id: "desired",
        description: "The web Deployment asks for 3 replicas.",
        validator: { kind: "replica-count", resourceType: "Deployment", resourceName: "web", expectedValue: 3 },
      },
      {
        id: "ready",
        description: "3 Pods owned by web are ready.",
        validator: { kind: "ready-pod-count", ownerType: "Deployment", ownerName: "web", expectedValue: 3 },
      },
    ],
    hints: [
      "Start with kubectl get deployments, then kubectl get replicasets and kubectl get pods.",
      "kubectl scale takes the resource type, its name, and --replicas=<n>.",
      "New Pods start as ContainerCreating. Run kubectl get pods again to see them become ready.",
      "Scaling the ReplicaSet directly does not stick: the Deployment sets it back. Scale the Deployment.",
    ],
    solution: ["kubectl scale deployment web --replicas=3", "kubectl get pods"],
  },
];
