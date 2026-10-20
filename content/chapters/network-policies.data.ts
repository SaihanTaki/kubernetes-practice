import type { ChapterData } from "../types";
import { quiz } from "./network-policies.quiz";

const shopApps = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: example/api:1.1
          ports:
            - containerPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db
  namespace: shop
spec:
  replicas: 1
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: redis
          image: redis:7.2
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: shop
spec:
  selector:
    app: api
  ports:
    - port: 8080
      targetPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: db
  namespace: shop
spec:
  selector:
    app: db
  ports:
    - port: 6379
      targetPort: 6379
`;

const defaultDeny = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: shop
spec:
  podSelector: {}
  policyTypes:
    - Ingress
`;

const allowPolicies = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
  namespace: shop
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 6379
`;

const allowStarter = `# Write two NetworkPolicies in namespace shop:
#   allow-frontend-to-api: Pods app=api accept TCP 8080 from Pods app=frontend
#   allow-api-to-db:       Pods app=db accept TCP 6379 from Pods app=api
# Separate them with a line containing only ---
`;

export const data: ChapterData = {
  objectives: [
    "Explain the default allow-all behaviour and why a CNI plugin must enforce policies.",
    "Isolate Pods per direction with default-deny policies and open specific paths with additive allow rules.",
    "Read from and to selectors, including the difference between AND (one element) and OR (two elements).",
    "Allow DNS when restricting egress, and test policies with kubectl exec and wget.",
  ],
  quiz,
  manifests: [
    {
      id: "netpol-default-deny",
      title: "default-deny-ingress.yaml",
      yaml: defaultDeny.trimEnd(),
      notes: [
        { line: 1, text: "NetworkPolicy lives in the networking.k8s.io API group, version v1." },
        { line: 4, text: "Name it after what it does. You will look for it in kubectl get netpol when traffic stops." },
        { line: 5, text: "Policies are namespaced. This one only affects Pods in shop." },
        { line: 7, text: "An empty podSelector selects every Pod in the namespace, including Pods created later." },
        { line: 8, text: "Listing Ingress isolates the selected Pods for incoming traffic. Egress is not listed, so outgoing traffic is untouched." },
        { line: 9, text: "There is no ingress section, so nothing is allowed in. Other policies can add allow rules on top." },
      ],
    },
    {
      id: "netpol-allow-frontend",
      title: "allow-frontend-to-api.yaml",
      yaml: allowPolicies.split("---\n")[0].trimEnd(),
      notes: [
        { line: 4, text: "One policy per allowed path keeps them easy to read and to delete." },
        { line: 7, text: "The Pods this policy protects: the api Pods. Rules below describe what may reach them." },
        { line: 10, text: "Ingress only. The api Pods' egress stays as it was." },
        { line: 12, text: "A list of rules. Traffic is allowed if it matches any one of them." },
        { line: 13, text: "Sources for this rule. Each list item is one alternative." },
        { line: 14, text: "A podSelector on its own means Pods in the policy's own namespace, shop." },
        { line: 16, text: "Only Pods labelled app=frontend. Labels, not names, so new frontend Pods are covered automatically." },
        { line: 17, text: "Ports on the destination Pod. Without a ports list, every port would be open to frontend." },
        { line: 19, text: "The container port, not the Service port. The policy is checked after the Service has picked a Pod." },
      ],
    },
  ],
  labs: [
    {
      id: "netpol-shop",
      title: "Open the right paths in shop",
      difficulty: "intermediate",
      scenario:
        "Namespace shop runs frontend (nginx), api (port 8080) and db (redis, port 6379). Someone applied default-deny-ingress, and now frontend cannot reach api. frontend must reach api, api must reach db, and frontend must still not reach db.",
      instructions: [
        "Run kubectl get pods -n shop until all three Pods are Running, then kubectl get netpol -n shop.",
        "Test from the frontend Pod: kubectl exec <frontend-pod> -n shop -- wget -qO- -T 2 http://api:8080. It times out.",
        "In allow.yaml, write a policy named allow-frontend-to-api that lets Pods labelled app=frontend reach Pods labelled app=api on TCP 8080.",
        "In the same file, after a --- line, write allow-api-to-db: Pods labelled app=api may reach Pods labelled app=db on TCP 6379.",
        "Apply it with kubectl apply -f allow.yaml and repeat the wget tests: frontend to api, api to db, and frontend to db, which must still time out.",
      ],
      fixture: {
        namespaces: ["shop"],
        files: { "shop.yaml": shopApps, "default-deny.yaml": defaultDeny, "allow.yaml": allowStarter },
        apply: ["shop.yaml", "default-deny.yaml"],
      },
      objectives: [
        {
          id: "frontend-api",
          description: "frontend gets HTTP 200 from http://api:8080.",
          validator: { kind: "http-get", fromOwnerType: "Deployment", fromOwnerName: "frontend", url: "http://api:8080", expectedStatus: 200, namespace: "shop" },
        },
        {
          id: "api-db",
          description: "api can reach db on port 6379.",
          validator: { kind: "http-get", fromOwnerType: "Deployment", fromOwnerName: "api", url: "http://db:6379", expectedStatus: "connected", namespace: "shop" },
        },
        {
          id: "frontend-db-blocked",
          description: "frontend still times out on db:6379.",
          validator: { kind: "http-get", fromOwnerType: "Deployment", fromOwnerName: "frontend", url: "http://db:6379", expectedStatus: "timeout", namespace: "shop" },
        },
      ],
      hints: [
        "Every command needs -n shop. kubectl get pods -n shop gives you the Pod names for kubectl exec.",
        "spec.podSelector picks the destination Pods. ingress[].from[].podSelector picks the source Pods.",
        "The default-deny policy stays. Allow rules add to it; you never edit or delete the deny.",
        "Put ports next to from in the same rule: ingress: - from: [...] ports: [{ protocol: TCP, port: 8080 }].",
        "If frontend can reach db, your db policy allows too much. Check that its from selects app: api only.",
      ],
      solutionFiles: { "allow.yaml": allowPolicies },
      solution: [
        "kubectl get pods -n shop",
        "kubectl apply -f allow.yaml",
        "kubectl get netpol -n shop",
        "kubectl get pods -n shop",
      ],
    },
  ],
  diagrams: [
    {
      id: "netpol-tiers",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "stage-0",
            label: "No policies",
            sub: "everything allowed",
            detail: "Without any NetworkPolicy selecting a Pod, the Pod accepts traffic from every Pod in every namespace.",
            children: [
              { id: "s0-fa", label: "frontend → api", sub: "allowed", detail: "Allowed by default." },
              { id: "s0-ad", label: "api → db", sub: "allowed", detail: "Allowed by default." },
              { id: "s0-fd", label: "frontend → db", sub: "allowed", detail: "Also allowed, which is the problem: the frontend never needs to talk to the database." },
            ],
          },
          {
            id: "stage-1",
            label: "+ default-deny-ingress",
            sub: "everything blocked",
            detail: "podSelector: {} with policyTypes: [Ingress] and no rules isolates every Pod in shop for ingress.",
            children: [
              { id: "s1-fa", label: "frontend → api", sub: "blocked", detail: "api is isolated and no rule allows frontend. The connection times out." },
              { id: "s1-ad", label: "api → db", sub: "blocked", detail: "db is isolated too." },
              { id: "s1-fd", label: "frontend → db", sub: "blocked", detail: "Blocked, as intended." },
            ],
          },
          {
            id: "stage-2",
            label: "+ allow-frontend-to-api",
            sub: "one path open",
            detail: "Selects app=api and allows ingress from app=frontend on TCP 8080. It adds to the deny, it does not replace it.",
            children: [
              { id: "s2-fa", label: "frontend → api", sub: "allowed :8080", detail: "Matches the allow rule: source app=frontend, port 8080." },
              { id: "s2-ad", label: "api → db", sub: "blocked", detail: "No policy allows anything into db yet." },
              { id: "s2-fd", label: "frontend → db", sub: "blocked", detail: "Still blocked." },
            ],
          },
          {
            id: "stage-3",
            label: "+ allow-api-to-db",
            sub: "two paths open",
            detail: "Selects app=db and allows ingress from app=api on TCP 6379.",
            children: [
              { id: "s3-fa", label: "frontend → api", sub: "allowed :8080", detail: "Unchanged." },
              { id: "s3-ad", label: "api → db", sub: "allowed :6379", detail: "Matches the new rule: source app=api, port 6379." },
              { id: "s3-fd", label: "frontend → db", sub: "blocked", detail: "The db policy only lists app=api as a source, so frontend stays blocked." },
            ],
          },
        ],
      },
      steps: [
        { title: "Default allow", text: "With no policies, every Pod can reach every other Pod, including frontend to db.", highlight: ["stage-0", "s0-fd"] },
        { title: "Deny all ingress", text: "default-deny-ingress isolates every Pod in shop. Nothing gets in, including traffic you need.", highlight: ["stage-1", "s1-fa", "s1-ad", "s1-fd"] },
        { title: "Allow frontend to api", text: "The first allow policy opens one path. The others stay closed.", highlight: ["stage-2", "s2-fa"] },
        { title: "Allow api to db", text: "The second allow policy opens api to db. frontend to db is still blocked because no rule allows it.", highlight: ["stage-3", "s3-ad", "s3-fd"] },
      ],
    },
    {
      id: "netpol-and-or",
      root: {
        id: "layout",
        label: "",
        children: [
          {
            id: "and",
            label: "One element: AND",
            sub: "- namespaceSelector + podSelector",
            detail: "Both selectors sit in the same list item, so a source must match both.",
            layout: "column",
            children: [
              { id: "and-ns", label: "namespaceSelector", sub: "team=ops", detail: "The source Pod's namespace must carry the label team=ops." },
              { id: "and-pod", label: "podSelector", sub: "app=monitor", detail: "And the source Pod itself must carry app=monitor." },
              { id: "and-result", label: "Allows", sub: "monitor Pods in ops namespaces", detail: "A monitor Pod in a namespace without team=ops is not allowed, and neither is any other Pod in an ops namespace." },
            ],
          },
          {
            id: "or",
            label: "Two elements: OR",
            sub: "- namespaceSelector, - podSelector",
            detail: "Each selector is its own list item, so a source matching either one is allowed.",
            layout: "column",
            children: [
              { id: "or-ns", label: "namespaceSelector", sub: "team=ops", detail: "Every Pod in every namespace labelled team=ops is allowed." },
              { id: "or-pod", label: "podSelector", sub: "app=monitor", detail: "Plus every Pod labelled app=monitor in the policy's own namespace." },
              { id: "or-result", label: "Allows", sub: "all of ops, plus local monitor Pods", detail: "Much wider than the AND form. One extra dash in the YAML is the whole difference." },
            ],
          },
        ],
      },
      steps: [
        { title: "AND", text: "One list item holding both selectors: the source must be a monitor Pod and live in an ops namespace.", highlight: ["and", "and-ns", "and-pod", "and-result"] },
        { title: "OR", text: "Two list items: any Pod in an ops namespace, or any monitor Pod in this namespace.", highlight: ["or", "or-ns", "or-pod", "or-result"] },
      ],
    },
  ],
};
