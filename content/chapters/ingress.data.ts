import type { ChapterData } from "../types";
import { quiz } from "./ingress.quiz";

const shopApps = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shop-web
  template:
    metadata:
      labels:
        app: shop-web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: shop-web
spec:
  selector:
    app: shop-web
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shop-api
  template:
    metadata:
      labels:
        app: shop-api
    spec:
      containers:
        - name: api
          image: example/api:1.1
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: shop-api
spec:
  selector:
    app: shop-api
  ports:
    - port: 80
      targetPort: 8080
`;

const shopIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: shopapi
                port:
                  number: 80
`;

const fixedIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: shop-api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop-web
                port:
                  number: 80
`;

export const data: ChapterData = {
  objectives: [
    "Explain why one Ingress in front of many Services scales better than a NodePort or LoadBalancer per Service, and why an Ingress does nothing without a controller.",
    "Write host-based and path-based rules, and predict which backend a request reaches with Prefix, Exact, and ImplementationSpecific paths.",
    "Add TLS to an Ingress with a kubernetes.io/tls Secret, and set ingressClassName and a defaultBackend.",
    "Debug an Ingress that returns 404 or 503 with kubectl describe ingress and curl.",
  ],
  quiz,
  manifests: [
    {
      id: "ingress-shop",
      title: "shop-ingress.yaml",
      yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: default
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - shop.example.com
        - admin.example.com
      secretName: shop-tls
  defaultBackend:
    service:
      name: shop-web
      port:
        number: 80
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: shop-api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shop-web
                port:
                  name: http
    - host: admin.example.com
      http:
        paths:
          - path: /login
            pathType: Exact
            backend:
              service:
                name: admin
                port:
                  number: 8080`,
      notes: [
        { line: 1, text: "Ingress lives in the networking.k8s.io API group. v1 has been stable since Kubernetes 1.19. Older v1beta1 manifests no longer apply." },
        { line: 4, text: "The Ingress name. A cluster can have many Ingresses, and the controller merges their rules." },
        { line: 5, text: "An Ingress only routes to Services in its own namespace, and its TLS Secret must be in this namespace too." },
        { line: 7, text: "Which IngressClass, and so which controller, handles this Ingress. Leave it out and the default IngressClass is used, if the cluster has one." },
        { line: 8, text: "TLS settings. The controller terminates HTTPS on port 443 and sends plain HTTP to the Pods." },
        { line: 9, text: "The hosts this certificate is used for. They should match hosts in rules and the names in the certificate." },
        { line: 12, text: "A Secret of type kubernetes.io/tls with keys tls.crt and tls.key, in the same namespace as the Ingress." },
        { line: 13, text: "Where requests go when no rule matches. Without it, the controller answers with its own default, usually 404." },
        { line: 18, text: "Rules are checked by host first, then by path." },
        { line: 19, text: "Only requests whose Host header is shop.example.com use this rule. A rule without host matches every host." },
        { line: 22, text: "The longest matching path wins, so /api/orders goes here even though / also matches." },
        { line: 23, text: "Prefix matches whole path segments: /api, /api/, and /api/orders, but not /apis." },
        { line: 26, text: "A Service name in the same namespace. A typo here gives 503 from the controller, not an apply error." },
        { line: 28, text: "The Service port, not the containerPort. This Service listens on 80 and forwards to 8080 in the Pods." },
        { line: 35, text: "A port can also be named. The Service shop-web must then have a port called http." },
        { line: 36, text: "A second host on the same Ingress and the same IP address. The controller picks the rule from the Host header." },
        { line: 40, text: "Exact matches /login only. /login/ and /login/reset get no match on this host and fall through to the defaultBackend." },
      ],
    },
  ],
  labs: [
    {
      id: "ingress-fix-routing",
      title: "Fix a broken Ingress",
      difficulty: "intermediate",
      scenario:
        "The shop runs two Deployments with Services: shop-web (the storefront) and shop-api. An Ingress named shop should send http://shop.example.com/ to shop-web and http://shop.example.com/api to shop-api. Right now the storefront returns 404 and the API returns 503.",
      instructions: [
        "Run kubectl get pods and kubectl get services until both Deployments have 2 ready Pods.",
        "Run curl http://shop.example.com/ and curl http://shop.example.com/api to see both errors.",
        "Run kubectl get ingress and kubectl describe ingress shop. Compare the backends with kubectl get services.",
        "Edit ingress.yaml in the Files panel: fix the Service name for /api and add a / path for shop.example.com that goes to shop-web on port 80.",
        "Apply ingress.yaml and repeat both curl commands until each returns the page.",
      ],
      fixture: {
        files: { "shop.yaml": shopApps, "ingress.yaml": shopIngress },
        apply: ["shop.yaml", "ingress.yaml"],
      },
      objectives: [
        {
          id: "api-backend",
          description: "shop.example.com/api routes to the shop-api Service.",
          validator: { kind: "ingress-backend", ingressName: "shop", host: "shop.example.com", path: "/api", expectedService: "shop-api" },
        },
        {
          id: "web-backend",
          description: "shop.example.com/ routes to the shop-web Service.",
          validator: { kind: "ingress-backend", ingressName: "shop", host: "shop.example.com", path: "/", expectedService: "shop-web" },
        },
        {
          id: "web-200",
          description: "curl http://shop.example.com/ returns 200.",
          validator: { kind: "http-get", url: "http://shop.example.com/", expectedStatus: 200 },
        },
        {
          id: "api-200",
          description: "curl http://shop.example.com/api returns 200.",
          validator: { kind: "http-get", url: "http://shop.example.com/api", expectedStatus: 200 },
        },
      ],
      hints: [
        "404 Not Found comes from the controller's default backend: no rule matched the request. 503 means a rule matched but its Service is missing or has no ready endpoints.",
        "kubectl describe ingress shop shows <error: services \"shopapi\" not found> next to /api. The Service is called shop-api.",
        "The only path under shop.example.com is /api, so a request for / matches nothing. Add a second entry under paths with path: /, pathType: Prefix, and backend service shop-web, port number 80.",
        "Order inside paths does not matter. The longest matching path wins, so /api still goes to shop-api after you add /.",
        "kubectl apply -f ingress.yaml updates the existing Ingress in place. You do not need to delete it first.",
      ],
      solutionFiles: { "ingress.yaml": fixedIngress },
      solution: [
        "kubectl get pods",
        "kubectl get pods",
        "kubectl apply -f ingress.yaml",
        "kubectl describe ingress shop",
        "curl http://shop.example.com/",
        "curl http://shop.example.com/api",
      ],
    },
  ],
  diagrams: [
    {
      id: "ingress-request-path",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        flow: true,
        children: [
          {
            id: "browser",
            label: "Browser",
            sub: "GET https://shop.example.com/api/orders",
            detail: "The client outside the cluster. It knows only a host name and a path, never a Service or Pod.",
          },
          {
            id: "dns",
            label: "Public DNS",
            sub: "shop.example.com → 192.0.2.10",
            detail: "You point every host name at the controller's address, usually the external IP of its LoadBalancer Service. Kubernetes does not create these DNS records for you.",
          },
          {
            id: "controller",
            label: "Ingress controller",
            sub: "ingress-nginx Pods on 80 and 443",
            detail: "A reverse proxy running as Pods in the cluster. It terminates TLS with the certificate from shop-tls, then reads the Host header and path.",
          },
          {
            id: "rules",
            label: "Ingress rules",
            sub: "host shop.example.com, Prefix /api",
            detail: "The controller watches Ingress objects and turns their rules into proxy config. /api/orders matches the /api Prefix rule, which names Service shop-api port 80.",
          },
          {
            id: "service",
            label: "Service shop-api",
            sub: "port 80 → targetPort 8080",
            detail: "The controller looks up the Service's endpoints. ingress-nginx then connects to a Pod IP directly instead of going through the ClusterIP.",
          },
          {
            id: "pod",
            label: "Pod shop-api-6d8f9c7b5-k2x4p",
            sub: "10.244.1.7:8080",
            detail: "One of the ready Pods behind the Service. It gets plain HTTP with the original Host header and path.",
          },
        ],
      },
      steps: [
        { title: "The browser sends a request", text: "Only the host name and path matter for routing. The user never sees Services or Pods.", highlight: ["browser"] },
        { title: "DNS points at the controller", text: "shop.example.com resolves to the controller's external address. Every host on the Ingress uses the same IP.", highlight: ["dns"] },
        { title: "The controller terminates TLS", text: "The controller is the only component that receives outside traffic. Without one, nothing listens and the Ingress object has no effect.", highlight: ["controller"] },
        { title: "Rules pick a backend", text: "The Host header selects the rule, and the longest matching path selects the Service.", highlight: ["rules"] },
        { title: "The Service supplies endpoints", text: "If the Service does not exist or has no ready Pods, the controller answers 503 itself.", highlight: ["service"] },
        { title: "A Pod answers", text: "The response goes back through the controller to the browser.", highlight: ["pod"] },
      ],
    },
    {
      id: "ingress-routing-table",
      root: {
        id: "layout",
        label: "",
        layout: "column",
        children: [
          {
            id: "hosts",
            label: "",
            children: [
              {
                id: "host-shop",
                label: "shop.example.com",
                sub: "2 paths",
                detail: "Requests whose Host header is shop.example.com. The longest matching path decides the Service.",
                layout: "column",
                children: [
                  { id: "shop-api", label: "Prefix /api → shop-api:80", sub: "/api, /api/orders", detail: "Matches /api and anything below it by whole segments. /apis does not match and falls to /." },
                  { id: "shop-root", label: "Prefix / → shop-web:80", sub: "everything else", detail: "/ as a Prefix matches every path, so it catches whatever the longer paths do not." },
                ],
              },
              {
                id: "host-admin",
                label: "admin.example.com",
                sub: "1 path",
                detail: "A second host on the same Ingress and IP. Its paths are separate from shop.example.com's.",
                layout: "column",
                children: [
                  { id: "admin-login", label: "Exact /login → admin:8080", sub: "/login only", detail: "Exact needs the path to be identical. /login/ and /login/reset do not match." },
                ],
              },
            ],
          },
          {
            id: "fallback",
            label: "No rule matches",
            sub: "defaultBackend, else 404",
            detail: "Unknown hosts and unmatched paths go to spec.defaultBackend. Without one, ingress-nginx answers 404 from its own default backend.",
          },
        ],
      },
      steps: [
        { title: "shop.example.com/api/orders", text: "Both /api and / match. /api is longer, so shop-api gets the request.", highlight: ["host-shop", "shop-api"] },
        { title: "shop.example.com/cart", text: "Only / matches, so shop-web gets it.", highlight: ["host-shop", "shop-root"] },
        { title: "admin.example.com/login", text: "The Exact path matches, so admin gets it.", highlight: ["host-admin", "admin-login"] },
        { title: "admin.example.com/login/reset", text: "Exact does not match a longer path, and the host has no other rule. The request goes to the defaultBackend, or 404 without one.", highlight: ["host-admin", "fallback"] },
      ],
    },
  ],
};
