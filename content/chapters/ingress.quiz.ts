import type { QuizQuestion } from "../types";

export const quiz: QuizQuestion[] = [
  {
    id: "ingress-why",
    topic: "Ingress",
    difficulty: "beginner",
    question: "You expose 12 HTTP apps with one LoadBalancer Service each. What is the main problem Ingress solves here?",
    options: [
      { id: "a", text: "LoadBalancer Services cannot send traffic to more than one Pod" },
      { id: "b", text: "Each Service gets its own cloud load balancer and public IP, with no shared host or path routing" },
      { id: "c", text: "LoadBalancer Services only work inside the cluster" },
      { id: "d", text: "LoadBalancer Services cannot carry HTTP traffic" },
    ],
    correctOptionId: "b",
    explanation:
      "Every LoadBalancer Service provisions its own load balancer and address, which costs money and gives you 12 entry points to manage. An Ingress puts many apps behind one address and routes by host and path.",
  },
  {
    id: "ingress-nodeport",
    topic: "Ingress",
    difficulty: "beginner",
    question: "Why is a NodePort per app a poor way to publish many websites?",
    options: [
      { id: "a", text: "Clients must use node IPs and a different high port per app, and there is no routing by host name" },
      { id: "b", text: "NodePort Services cannot have endpoints" },
      { id: "c", text: "NodePort only works on the control plane node" },
      { id: "d", text: "NodePort Services delete their Pods when a node restarts" },
    ],
    correctOptionId: "a",
    explanation:
      "A NodePort opens a port in the 30000 to 32767 range on every node. Users would need URLs like http://<node-ip>:31234, and the port tells nothing about which app they want.",
  },
  {
    id: "ingress-controller-needed",
    topic: "Ingress controller",
    difficulty: "beginner",
    question: "You apply a valid Ingress to a fresh cluster with no Ingress controller installed. What happens?",
    options: [
      { id: "a", text: "The API server rejects the manifest" },
      { id: "b", text: "Kubernetes starts a built-in proxy for it" },
      { id: "c", text: "The Ingress is stored, but no traffic is routed and it gets no address" },
      { id: "d", text: "The Services it names become LoadBalancer Services" },
    ],
    correctOptionId: "c",
    explanation:
      "The Ingress is only configuration. Kubernetes ships no controller to act on it, so it sits in the API with an empty ADDRESS until you install one.",
  },
  {
    id: "ingress-resource-vs-controller",
    topic: "Ingress controller",
    difficulty: "beginner",
    question: "Which statement about the Ingress resource and the Ingress controller is right?",
    options: [
      { id: "a", text: "They are the same thing under two names" },
      { id: "b", text: "The controller is a field inside the Ingress resource" },
      { id: "c", text: "The resource runs as Pods and the controller is a YAML object" },
      { id: "d", text: "The resource holds routing rules; the controller is a proxy running in Pods that reads those rules and serves traffic" },
    ],
    correctOptionId: "d",
    explanation:
      "You write Ingress objects. A controller such as ingress-nginx, Traefik, or a cloud load balancer controller watches them and configures a real proxy.",
  },
  {
    id: "ingress-class",
    topic: "IngressClass",
    difficulty: "intermediate",
    question: "A cluster runs two controllers, ingress-nginx and Traefik. How does an Ingress say which one should handle it?",
    options: [
      { id: "a", text: "spec.ingressClassName names an IngressClass, and the IngressClass names the controller" },
      { id: "b", text: "Both controllers always handle every Ingress" },
      { id: "c", text: "The metadata.name must start with the controller name" },
      { id: "d", text: "The Ingress must be in the controller's namespace" },
    ],
    correctOptionId: "a",
    explanation:
      "An IngressClass has spec.controller, for example k8s.io/ingress-nginx. Each controller handles only Ingresses whose ingressClassName points at its class.",
  },
  {
    id: "ingress-default-class",
    topic: "IngressClass",
    difficulty: "intermediate",
    question: "An Ingress has no ingressClassName. When does a controller still pick it up?",
    options: [
      { id: "a", text: "Never; ingressClassName is required" },
      { id: "b", text: "When one IngressClass carries the annotation ingressclass.kubernetes.io/is-default-class: \"true\"" },
      { id: "c", text: "When the Ingress is in the default namespace" },
      { id: "d", text: "When the Ingress has exactly one rule" },
    ],
    correctOptionId: "b",
    explanation:
      "An admission controller fills in the default IngressClass for new Ingresses that leave the field out. Without a default class, the Ingress may be ignored by every controller.",
  },
  {
    id: "ingress-host-routing",
    topic: "Routing",
    difficulty: "beginner",
    question: "How does the controller tell shop.example.com and admin.example.com apart when both resolve to the same IP?",
    options: [
      { id: "a", text: "By the client's source IP" },
      { id: "b", text: "By the TCP port the client uses" },
      { id: "c", text: "By the Host header of the HTTP request (or SNI for HTTPS)" },
      { id: "d", text: "It cannot; each host needs its own IP" },
    ],
    correctOptionId: "c",
    explanation:
      "Name-based virtual hosting: the browser sends the host name in the Host header, and in the TLS SNI field for HTTPS. The controller matches that against rules[].host.",
  },
  {
    id: "ingress-longest-path",
    topic: "Routing",
    difficulty: "intermediate",
    question: "One host has Prefix rules / → web and /api → api. Where does GET /api/orders go?",
    options: [
      { id: "a", text: "web, because / is listed first" },
      { id: "b", text: "Both Services receive a copy" },
      { id: "c", text: "Neither; overlapping paths are rejected" },
      { id: "d", text: "api, because the longest matching path wins" },
    ],
    correctOptionId: "d",
    explanation:
      "When several paths match, the longest one is used. Order in the manifest does not decide it. / matches everything, so it only gets what nothing longer matches.",
  },
  {
    id: "ingress-prefix-segments",
    topic: "Path types",
    difficulty: "intermediate",
    question: "A rule has path: /api with pathType: Prefix. Which request path does it NOT match?",
    options: [
      { id: "a", text: "/apis" },
      { id: "b", text: "/api" },
      { id: "c", text: "/api/" },
      { id: "d", text: "/api/v1/users" },
    ],
    correctOptionId: "a",
    explanation:
      "Prefix compares whole path segments split by /. /apis has the segment apis, which is not api, so it does not match. The other three all start with the segment api.",
  },
  {
    id: "ingress-exact",
    topic: "Path types",
    difficulty: "intermediate",
    question: "A rule has path: /login with pathType: Exact. Which request matches it?",
    options: [
      { id: "a", text: "/login/" },
      { id: "b", text: "/login" },
      { id: "c", text: "/login/reset" },
      { id: "d", text: "/Login" },
    ],
    correctOptionId: "b",
    explanation: "Exact needs an identical, case-sensitive path. A trailing slash or a longer path is a different path.",
  },
  {
    id: "ingress-exact-vs-prefix",
    topic: "Path types",
    difficulty: "advanced",
    question: "A host has path /foo as Exact → a and path /foo as Prefix → b. Where does GET /foo go?",
    options: [
      { id: "a", text: "b, because Prefix is checked first" },
      { id: "b", text: "Randomly to a or b" },
      { id: "c", text: "a, because Exact wins over Prefix for paths of the same length" },
      { id: "d", text: "The API server rejects the Ingress" },
    ],
    correctOptionId: "c",
    explanation:
      "Both match and the paths are equally long, so the Exact match takes precedence. GET /foo/bar would go to b, since only the Prefix rule matches it.",
  },
  {
    id: "ingress-implementation-specific",
    topic: "Path types",
    difficulty: "intermediate",
    question: "What does pathType: ImplementationSpecific mean?",
    options: [
      { id: "a", text: "The path is matched exactly" },
      { id: "b", text: "The path is a regular expression in every controller" },
      { id: "c", text: "The path is ignored" },
      { id: "d", text: "Matching is up to the IngressClass's controller" },
    ],
    correctOptionId: "d",
    explanation:
      "Each controller decides. ingress-nginx, for example, treats it like Prefix unless regex matching is turned on. Prefer Prefix or Exact so the Ingress behaves the same on any controller.",
  },
  {
    id: "ingress-404",
    topic: "Troubleshooting",
    difficulty: "intermediate",
    question: "curl http://shop.example.com/cart returns 404 Not Found from nginx, and the Ingress has no defaultBackend. What is the most likely cause?",
    options: [
      { id: "a", text: "No rule matches that host and path" },
      { id: "b", text: "The Service has no ready Pods" },
      { id: "c", text: "The TLS Secret is missing" },
      { id: "d", text: "DNS for shop.example.com is wrong" },
    ],
    correctOptionId: "a",
    explanation:
      "The request reached the controller, which proves DNS works. A 404 from the controller's default backend means nothing in the rules matched. A missing Service or no endpoints gives 503 instead.",
  },
  {
    id: "ingress-503",
    topic: "Troubleshooting",
    difficulty: "intermediate",
    question: "kubectl describe ingress shows <error: services \"shopapi\" not found> for /api. What will a client get for /api?",
    options: [
      { id: "a", text: "200, from any other Service on the host" },
      { id: "b", text: "503 Service Temporarily Unavailable from the controller" },
      { id: "c", text: "A DNS error" },
      { id: "d", text: "Nothing; kubectl apply refused the Ingress" },
    ],
    correctOptionId: "b",
    explanation:
      "The API server does not check that backend Services exist. The rule matches, the controller finds no endpoints to send to, and it answers 503.",
  },
  {
    id: "ingress-tls-secret",
    topic: "TLS",
    difficulty: "intermediate",
    question: "What must the Secret named in spec.tls[].secretName contain?",
    options: [
      { id: "a", text: "A username and password for the controller" },
      { id: "b", text: "Only the CA certificate" },
      { id: "c", text: "Keys tls.crt and tls.key, type kubernetes.io/tls, in the Ingress's namespace" },
      { id: "d", text: "A kubeconfig file" },
    ],
    correctOptionId: "c",
    explanation:
      "kubectl create secret tls <name> --cert=... --key=... builds it. The controller reads the certificate and key from the Secret in the same namespace as the Ingress.",
  },
  {
    id: "ingress-annotations",
    topic: "Annotations",
    difficulty: "intermediate",
    question: "You move an Ingress that uses nginx.ingress.kubernetes.io/rewrite-target from ingress-nginx to Traefik. What happens to the rewrite?",
    options: [
      { id: "a", text: "Traefik translates it automatically" },
      { id: "b", text: "The API server converts it to a spec field" },
      { id: "c", text: "The Ingress is rejected" },
      { id: "d", text: "Traefik ignores the annotation, so paths are no longer rewritten" },
    ],
    correctOptionId: "d",
    explanation:
      "Annotations are free-form text. Each controller reads only its own prefix, so ingress-nginx annotations do nothing under another controller.",
  },
  {
    id: "ingress-gateway-api",
    topic: "Gateway API",
    difficulty: "beginner",
    question: "What is the status of the Ingress API now that Gateway API exists?",
    options: [
      { id: "a", text: "Frozen: stable and supported, but getting no new features" },
      { id: "b", text: "Removed in the latest Kubernetes release" },
      { id: "c", text: "Deprecated, with a removal date announced" },
      { id: "d", text: "Still in beta" },
    ],
    correctOptionId: "a",
    explanation:
      "networking.k8s.io/v1 Ingress is GA and not deprecated. New work goes into Gateway API, which splits the job into GatewayClass, Gateway, and route objects such as HTTPRoute.",
  },
  {
    id: "ingress-yaml-apiversion",
    topic: "Ingress YAML",
    difficulty: "beginner",
    question: "Which apiVersion does a current Ingress manifest use?",
    options: [
      { id: "a", text: "v1" },
      { id: "b", text: "apps/v1" },
      { id: "c", text: "extensions/v1beta1" },
      { id: "d", text: "networking.k8s.io/v1" },
    ],
    correctOptionId: "d",
    explanation:
      "Ingress is in the networking.k8s.io group. extensions/v1beta1 and networking.k8s.io/v1beta1 were removed in Kubernetes 1.22.",
  },
  {
    id: "ingress-yaml-backend",
    topic: "Ingress YAML",
    difficulty: "intermediate",
    question: "Which backend is valid in a networking.k8s.io/v1 Ingress path?",
    options: [
      { id: "a", text: "backend: { serviceName: api, servicePort: 80 }" },
      { id: "b", text: "backend: { service: { name: api, port: { number: 80 } } }" },
      { id: "c", text: "backend: { pod: api, port: 8080 }" },
      { id: "d", text: "backend: { service: api:80 }" },
    ],
    correctOptionId: "b",
    explanation:
      "v1 nests the Service under backend.service with name and port.number or port.name. serviceName and servicePort are the old v1beta1 fields, and an Ingress cannot point at a Pod directly.",
  },
  {
    id: "ingress-yaml-pathtype",
    topic: "Ingress YAML",
    difficulty: "beginner",
    question: "A v1 Ingress path is written as { path: /api, backend: ... } with no pathType. What happens on apply?",
    options: [
      { id: "a", text: "It defaults to Prefix" },
      { id: "b", text: "It defaults to Exact" },
      { id: "c", text: "The API server rejects it, because pathType is required in v1" },
      { id: "d", text: "The path is ignored" },
    ],
    correctOptionId: "c",
    explanation: "In networking.k8s.io/v1 every path needs a pathType: Prefix, Exact, or ImplementationSpecific. There is no default.",
  },
  {
    id: "ingress-yaml-port",
    topic: "Ingress YAML",
    difficulty: "intermediate",
    question: "Service api has port: 80, targetPort: 8080. What goes in the Ingress backend?",
    options: [
      { id: "a", text: "port: { number: 8080 }" },
      { id: "b", text: "port: { number: 80 }" },
      { id: "c", text: "port: { number: 443 }" },
      { id: "d", text: "No port; the Ingress reads it from the Pod" },
    ],
    correctOptionId: "b",
    explanation:
      "The backend names a Service port, the same one a client inside the cluster would use. The Service maps it to targetPort 8080 on the Pods.",
  },
  {
    id: "ingress-yaml-default-backend",
    topic: "Ingress YAML",
    difficulty: "intermediate",
    question: "Which field sends requests that match no rule to the Service fallback?",
    options: [
      { id: "a", text: "spec.rules: [{ host: \"*\" }]" },
      { id: "b", text: "metadata.annotations: { fallback: \"true\" }" },
      { id: "c", text: "spec.tls: [{ secretName: fallback }]" },
      { id: "d", text: "spec.defaultBackend: { service: { name: fallback, port: { number: 80 } } }" },
    ],
    correctOptionId: "d",
    explanation:
      "spec.defaultBackend catches every request that no host and path rule matches. A bare * is not a valid host, and annotations and tls do not route anything.",
  },
  {
    id: "ingress-yaml-tls-hosts",
    topic: "Ingress YAML",
    difficulty: "advanced",
    question: "An Ingress has tls: [{ hosts: [shop.example.com], secretName: shop-tls }] and a rule for admin.example.com. What does https://admin.example.com use?",
    options: [
      { id: "a", text: "The shop-tls certificate, because it is the only one" },
      { id: "b", text: "Plain HTTP on port 443" },
      { id: "c", text: "The controller's default certificate, which browsers do not trust" },
      { id: "d", text: "The request is refused before TLS starts" },
    ],
    correctOptionId: "c",
    explanation:
      "A certificate is only used for the hosts listed with it. admin.example.com is not listed, so ingress-nginx falls back to its self-signed default certificate and curl reports an SSL certificate problem unless you pass -k.",
  },
  {
    id: "ingress-yaml-wildcard",
    topic: "Ingress YAML",
    difficulty: "advanced",
    question: "A rule has host: \"*.example.com\". Which Host header matches it?",
    options: [
      { id: "a", text: "shop.example.com" },
      { id: "b", text: "a.b.example.com" },
      { id: "c", text: "shop.example.org" },
      { id: "d", text: "example.com" },
    ],
    correctOptionId: "a",
    explanation:
      "A wildcard covers exactly one DNS label. shop.example.com matches; example.com has no label in its place, and a.b.example.com has two.",
  },
  {
    id: "ingress-dns",
    topic: "Ingress controller",
    difficulty: "beginner",
    question: "You add a rule for blog.example.com to an Ingress. What must exist outside Kubernetes for browsers to reach it?",
    options: [
      { id: "a", text: "Nothing; the Ingress creates the DNS record when it is applied" },
      { id: "b", text: "A DNS record for each Pod behind the Service" },
      { id: "c", text: "A DNS record for blog.example.com that points at the controller's external address" },
      { id: "d", text: "A separate load balancer for blog.example.com" },
    ],
    correctOptionId: "c",
    explanation:
      "DNS is outside Kubernetes. You point each host name at the controller's address, which all hosts on that controller share. Applying an Ingress does not create DNS records, and clients never address Pods directly.",
  },
  {
    id: "ingress-class-annotation",
    topic: "IngressClass",
    difficulty: "beginner",
    question: "An old guide tells you to add the annotation kubernetes.io/ingress.class: nginx. What should you do in a current cluster?",
    options: [
      { id: "a", text: "Set spec.ingressClassName: nginx instead, because the annotation is deprecated" },
      { id: "b", text: "Use the annotation; it is the only way to pick a controller" },
      { id: "c", text: "Set both, because the API server requires the annotation and the field together" },
      { id: "d", text: "Put the annotation on the Service instead of the Ingress" },
    ],
    correctOptionId: "a",
    explanation:
      "The kubernetes.io/ingress.class annotation is deprecated. spec.ingressClassName is the field that names the IngressClass, and the annotation is not required alongside it.",
  },
  {
    id: "ingress-no-host",
    topic: "Routing",
    difficulty: "beginner",
    question: "A rule in spec.rules has paths but no host field. Which requests can it match?",
    options: [
      { id: "a", text: "None; a rule without host is ignored" },
      { id: "b", text: "Requests with any Host header, as long as the path matches" },
      { id: "c", text: "Only requests sent to the controller's IP with no Host header" },
      { id: "d", text: "Only requests for the cluster's own DNS name" },
    ],
    correctOptionId: "b",
    explanation:
      "host is optional. Leaving it out makes the rule match every host name, so only the path decides. It is not ignored and does not need an empty Host header.",
  },
  {
    id: "ingress-tls-termination",
    topic: "TLS",
    difficulty: "intermediate",
    question: "An Ingress has a spec.tls entry for shop.example.com. What protocol do the shop Pods receive?",
    options: [
      { id: "a", text: "HTTPS, so each Pod also needs the certificate" },
      { id: "b", text: "Raw TCP with the TLS bytes passed through untouched" },
      { id: "c", text: "Nothing until the Service type is changed to LoadBalancer" },
      { id: "d", text: "Plain HTTP, because the controller terminates TLS on port 443" },
    ],
    correctOptionId: "d",
    explanation:
      "The controller decrypts HTTPS with the certificate from the Secret and forwards plain HTTP to the Pods. The Pods do not need the certificate. Passing TLS through untouched is not what spec.tls does.",
  },
  {
    id: "ingress-namespace",
    topic: "Ingress YAML",
    difficulty: "intermediate",
    question: "An Ingress in namespace shop has backend: { service: { name: api, port: { number: 80 } } }. The api Service exists only in namespace backend. What happens?",
    options: [
      { id: "a", text: "The controller finds api in any namespace" },
      { id: "b", text: "The API server rejects the Ingress" },
      { id: "c", text: "The backend is looked up in namespace shop, so the Service is not found and the path fails" },
      { id: "d", text: "Kubernetes copies the Service into namespace shop" },
    ],
    correctOptionId: "c",
    explanation:
      "An Ingress only routes to Services in its own namespace. The API server does not check the backend, so it applies, but the controller cannot find api in shop and that path returns an error such as 503.",
  },
  {
    id: "ingress-named-port",
    topic: "Ingress YAML",
    difficulty: "intermediate",
    question: "An Ingress backend uses port: { name: http }. What must be true for it to work?",
    options: [
      { id: "a", text: "The container must listen on port 80" },
      { id: "b", text: "The Ingress must also set port.number" },
      { id: "c", text: "The IngressClass must be named http" },
      { id: "d", text: "The backend Service must have a port named http" },
    ],
    correctOptionId: "d",
    explanation:
      "port.name refers to a named port on the Service, just as port.number refers to the Service's port number. You set one or the other, not both, and the container port number does not matter here.",
  },
  {
    id: "ingress-rewrite-target",
    topic: "Annotations",
    difficulty: "advanced",
    question: "With ingress-nginx, path /api(/|$)(.*) and annotation nginx.ingress.kubernetes.io/rewrite-target: /$2, what path does the Pod see for GET /api/orders?",
    options: [
      { id: "a", text: "/orders" },
      { id: "b", text: "/api/orders" },
      { id: "c", text: "/$2" },
      { id: "d", text: "/api" },
    ],
    correctOptionId: "a",
    explanation:
      "rewrite-target makes ingress-nginx treat the path as a regular expression. $2 is the second capture group, orders, so /api is stripped and the Pod gets /orders. Without the annotation the Pod would see /api/orders.",
  },
  {
    id: "ingress-gateway-roles",
    topic: "Gateway API",
    difficulty: "intermediate",
    question: "In Gateway API, which object holds host and path matching to Services, usually owned by an app team?",
    options: [
      { id: "a", text: "GatewayClass" },
      { id: "b", text: "HTTPRoute" },
      { id: "c", text: "Gateway" },
      { id: "d", text: "IngressClass" },
    ],
    correctOptionId: "b",
    explanation:
      "HTTPRoute matches hosts and paths (and headers, or weights) to Services. Gateway is the listener with ports and certificates, usually owned by the platform team, and GatewayClass names the controller, like IngressClass does for Ingress.",
  },
];
