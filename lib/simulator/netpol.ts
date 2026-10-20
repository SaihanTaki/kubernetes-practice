import { age, annotationText, labelText } from "./cli";
import { list } from "./cluster";
import { wallTime } from "./images";
import { selectorMatches } from "./scheduler";
import type { Cluster, Container, LabelSelector, Labels, NetworkPolicy, NetworkPolicyPeer, NetworkPolicyPort, NetworkPolicyRule, Pod } from "./types";

export const NAMESPACE_NAME_LABEL = "kubernetes.io/metadata.name";

/** A namespace's labels, with the name label the API server always sets. */
export const namespaceLabels = (c: Cluster, ns: string): Labels => ({ ...c.namespaceLabels[ns], [NAMESPACE_NAME_LABEL]: ns });

/** One end of a connection, as NetworkPolicy sees it: a Pod, or a cluster component modelled without a Pod object. */
export type Endpoint = { ip: string; namespace: string; labels: Labels; container?: Container; pod?: Pod };

export const podEndpoint = (p: Pod, ip: string): Endpoint => ({ ip, namespace: p.metadata.namespace, labels: p.metadata.labels, container: p.container, pod: p });

/** CoreDNS, which every in-cluster name lookup goes to (Service 10.96.0.10). */
export const KUBE_DNS: Endpoint = {
  ip: "10.244.0.252",
  namespace: "kube-system",
  labels: { "k8s-app": "kube-dns" },
  container: {
    name: "coredns",
    ports: [
      { containerPort: 53, name: "dns", protocol: "UDP" },
      { containerPort: 53, name: "dns-tcp", protocol: "TCP" },
      { containerPort: 9153, name: "metrics", protocol: "TCP" },
    ],
  },
};

/** The ingress-nginx controller Pod, the source of all Ingress traffic to backends. */
export const INGRESS_NGINX: Endpoint = {
  ip: "10.244.0.253",
  namespace: "ingress-nginx",
  labels: { "app.kubernetes.io/component": "controller", "app.kubernetes.io/instance": "ingress-nginx", "app.kubernetes.io/name": "ingress-nginx" },
};

const ipNumber = (ip: string) => ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);

export function inCidr(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const size = 2 ** (32 - Number(bits ?? 32));
  return Math.floor(ipNumber(ip) / size) === Math.floor(ipNumber(base) / size);
}

function peerMatches(c: Cluster, peer: NetworkPolicyPeer, policyNs: string, ep: Endpoint): boolean {
  if (peer.ipBlock) return inCidr(ep.ip, peer.ipBlock.cidr) && !(peer.ipBlock.except ?? []).some((x) => inCidr(ep.ip, x));
  const nsOk = peer.namespaceSelector ? selectorMatches(namespaceLabels(c, ep.namespace), peer.namespaceSelector) : ep.namespace === policyNs;
  return nsOk && (!peer.podSelector || selectorMatches(ep.labels, peer.podSelector));
}

function portMatches(ports: NetworkPolicyPort[] | undefined, dst: Endpoint, port: number, protocol: string): boolean {
  if (!ports?.length) return true;
  return ports.some((pp) => {
    if ((pp.protocol ?? "TCP") !== protocol) return false;
    if (pp.port === undefined) return true;
    if (typeof pp.port === "number") return pp.port === port;
    return !!dst.container?.ports?.some((x) => x.name === pp.port && x.containerPort === port && (x.protocol ?? "TCP") === protocol);
  });
}

const selecting = (c: Cluster, ep: Endpoint, type: "Ingress" | "Egress") =>
  list(c, "NetworkPolicy", ep.namespace).filter((np) => np.policyTypes.includes(type) && selectorMatches(ep.labels, np.podSelector));

/** Whether NetworkPolicies let `src` open a connection to `dst` on this port: src egress and dst ingress must both allow it. */
export function allowed(c: Cluster, src: Endpoint, dst: Endpoint, port: number, protocol = "TCP"): boolean {
  const ok = (policies: NetworkPolicy[], rules: (np: NetworkPolicy) => NetworkPolicyRule[], peer: Endpoint) =>
    !policies.length ||
    policies.some((np) => rules(np).some((r) => (!r.peers?.length || r.peers.some((x) => peerMatches(c, x, np.metadata.namespace, peer))) && portMatches(r.ports, dst, port, protocol)));
  return ok(selecting(c, src, "Egress"), (np) => np.egress, dst) && ok(selecting(c, dst, "Ingress"), (np) => np.ingress, src);
}

/** Whether the Pod can reach the cluster DNS, which it needs once its egress is restricted. */
export const dnsAllowed = (c: Cluster, src: Endpoint) => allowed(c, src, KUBE_DNS, 53, "UDP");

/** metav1.FormatLabelSelector: `app=web,tier in (a,b)`, or `<none>` for the empty selector. */
export function selectorText(s: LabelSelector): string {
  const parts = [
    ...Object.entries(s.matchLabels ?? {}).map(([k, v]) => `${k}=${v}`),
    ...(s.matchExpressions ?? []).map((e) =>
      e.operator === "Exists" ? e.key : e.operator === "DoesNotExist" ? `!${e.key}` : `${e.key} ${e.operator === "In" ? "in" : "notin"} (${(e.values ?? []).join(",")})`,
    ),
  ];
  return parts.join(",") || "<none>";
}

export const NETPOL_HEADER = ["NAME", "POD-SELECTOR", "AGE"];

export const netpolRow = (c: Cluster, np: NetworkPolicy) => [np.metadata.name, selectorText(np.podSelector), age(c, np.metadata.createdAt)];

const peerYaml = (peers?: NetworkPolicyPeer[]) => (peers?.length ? peers : undefined);

export function netpolManifest(np: NetworkPolicy, metadata: Record<string, unknown>) {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "NetworkPolicy",
    metadata,
    spec: {
      podSelector: np.podSelector,
      policyTypes: np.policyTypes,
      ingress: np.policyTypes.includes("Ingress") && np.ingress.length ? np.ingress.map((r) => ({ from: peerYaml(r.peers), ports: r.ports })) : undefined,
      egress: np.policyTypes.includes("Egress") && np.egress.length ? np.egress.map((r) => ({ to: peerYaml(r.peers), ports: r.ports })) : undefined,
    },
  };
}

const portText = (p: NetworkPolicyPort) => `${p.port ?? "<any>"}/${p.protocol ?? "TCP"}`;

function peerLines(peers: NetworkPolicyPeer[]): string[] {
  return peers.flatMap((peer) => {
    if (peer.ipBlock) {
      return ["      IPBlock:", `        CIDR: ${peer.ipBlock.cidr}`, `        Except: ${(peer.ipBlock.except ?? []).join(", ")}`];
    }
    return [
      ...(peer.namespaceSelector ? [`      NamespaceSelector: ${selectorText(peer.namespaceSelector)}`] : []),
      ...(peer.podSelector ? [`      PodSelector: ${selectorText(peer.podSelector)}`] : []),
    ];
  });
}

function ruleLines(rules: NetworkPolicyRule[], direction: "ingress" | "egress"): string[] {
  if (!rules.length) return [`    <none> (Selected pods are isolated for ${direction} connectivity)`];
  const [peerWord, portWord] = direction === "ingress" ? ["From", "To Port"] : ["To", "To Port"];
  return rules.flatMap((r, i) => [
    ...(i ? ["    ----------"] : []),
    ...(r.ports?.length ? r.ports.map((p) => `    ${portWord}: ${portText(p)}`) : [`    ${portWord}: <any> (traffic allowed to all ports)`]),
    ...(r.peers?.length
      ? [`    ${peerWord}:`, ...peerLines(r.peers)]
      : [`    ${peerWord}: <any> (traffic not restricted by ${direction === "ingress" ? "source" : "destination"})`]),
  ]);
}

const createdOn = (createdAt: number) => wallTime(createdAt).toISOString().replace("T", " ").replace(/\.\d+Z$/, " +0000 UTC");

export function describeNetpol(np: NetworkPolicy): string {
  const selector = selectorText(np.podSelector);
  return [
    ...([
      ["Name", np.metadata.name],
      ["Namespace", np.metadata.namespace],
      ["Created on", createdOn(np.metadata.createdAt)],
      ["Labels", labelText(np.metadata.labels)],
      ["Annotations", annotationText(np.metadata.annotations).replace(/\n {16}/g, "\n              ")],
    ] as const).map(([k, v]) => `${`${k}:`.padEnd(14)}${v}`),
    "Spec:",
    `  PodSelector:     ${selector === "<none>" ? "<none> (Allowing the specific traffic to all pods in this namespace)" : selector}`,
    ...(np.policyTypes.includes("Ingress") ? ["  Allowing ingress traffic:", ...ruleLines(np.ingress, "ingress")] : ["  Not affecting ingress traffic"]),
    ...(np.policyTypes.includes("Egress") ? ["  Allowing egress traffic:", ...ruleLines(np.egress, "egress")] : ["  Not affecting egress traffic"]),
    `  Policy Types: ${np.policyTypes.join(", ")}`,
  ].join("\n");
}
