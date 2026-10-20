import { age, aligned, annotationText, labelText } from "./cli";
import { endpointsOf, find, list, resolvePort } from "./cluster";
import { connectPod, curlOutput, finish, type HttpResult, type HttpStatus, isIP, nginxPage, parseCurl, parseUrl, statusMatches, type ClientOutcome } from "./http";
import { INGRESS_NGINX } from "./netpol";
import type { Cluster, Ingress, IngressBackend, IngressClass, IngressPath } from "./types";

/** The external address of the ingress-nginx controller's LoadBalancer Service. */
export const INGRESS_IP = "192.0.2.10";
export const NGINX_CONTROLLER = "k8s.io/ingress-nginx";
const DEFAULT_CLASS_ANNOTATION = "ingressclass.kubernetes.io/is-default-class";

/** The class the ingress-nginx install creates. */
export function defaultIngressClass(c: Cluster): IngressClass {
  return {
    kind: "IngressClass",
    // Not from meta(): its uid must not use c.seq, which names generated Pods.
    metadata: {
      uid: "ingressclass/nginx",
      name: "nginx",
      namespace: "",
      labels: { "app.kubernetes.io/component": "controller", "app.kubernetes.io/instance": "ingress-nginx", "app.kubernetes.io/name": "ingress-nginx" },
      annotations: { [DEFAULT_CLASS_ANNOTATION]: "true" },
      createdAt: c.clock,
    },
    controller: NGINX_CONTROLLER,
  };
}

const defaultClass = (c: Cluster) => list(c, "IngressClass").find((x) => x.metadata.annotations[DEFAULT_CLASS_ANNOTATION] === "true");

/** Whether ingress-nginx handles this Ingress: its class (or the default class) is one of the controller's. */
export function served(c: Cluster, ing: Ingress): boolean {
  const cls = ing.ingressClassName === undefined ? defaultClass(c) : find(c, "IngressClass", "", ing.ingressClassName);
  return cls?.controller === NGINX_CONTROLLER;
}

const hostMatches = (ruleHost: string | undefined, host: string) =>
  ruleHost === undefined ||
  ruleHost === host ||
  (ruleHost.startsWith("*.") && host.endsWith(ruleHost.slice(1)) && host.split(".").length === ruleHost.split(".").length);

/** How well a path rule matches: -1 for no match, Exact above every Prefix, else the longest prefix wins. */
function pathScore(p: IngressPath, path: string): number {
  if (p.pathType === "Exact") return p.path === path ? Infinity : -1;
  if (p.pathType === "ImplementationSpecific") return path.startsWith(p.path) ? p.path.length : -1;
  const prefix = p.path.replace(/\/$/, "");
  return path === prefix || path.startsWith(`${prefix}/`) || p.path === "/" ? p.path.length : -1;
}

export type Route = { ingress: Ingress; backend: IngressBackend };

/** The backend nginx picks for host and path. Rules naming the host win over host-less rules, as nginx server blocks do. */
export function route(ingresses: Ingress[], host: string, path: string): Route | undefined {
  const sorted = [...ingresses].sort((a, b) => (`${a.metadata.namespace}/${a.metadata.name}` < `${b.metadata.namespace}/${b.metadata.name}` ? -1 : 1));
  const rules = (exact: boolean) => sorted.flatMap((ingress) => ingress.rules.filter((r) => (exact ? r.host !== undefined && hostMatches(r.host, host) : r.host === undefined)).map((rule) => ({ ingress, rule })));
  const named = rules(true);
  const candidates = named.length ? named : rules(false);
  let best: { score: number; route: Route } | undefined;
  for (const { ingress, rule } of candidates) {
    for (const p of rule.paths) {
      const score = pathScore(p, path);
      if (score >= 0 && (!best || score > best.score)) best = { score, route: { ingress, backend: p.backend } };
    }
  }
  if (best) return best.route;
  const owners = named.length ? named.map((x) => x.ingress) : sorted;
  const fallback = owners.find((i) => i.defaultBackend);
  return fallback && { ingress: fallback, backend: fallback.defaultBackend! };
}

const page = (status: number, reason: string): HttpResult => ({ kind: "http", status, reason, server: "nginx", body: nginxPage(status, reason) });

/** What ingress-nginx answers for a request it received. `rotate` spreads repeated calls over endpoints. */
export function controllerResponse(c: Cluster, host: string, path: string, rotate: boolean): HttpResult {
  const r = route(list(c, "Ingress").filter((i) => served(c, i)), host, path.split("?")[0]);
  if (!r) return page(404, "Not Found");
  const ns = r.ingress.metadata.namespace;
  const svc = find(c, "Service", ns, r.backend.service.name);
  const { number, name } = r.backend.service.port;
  const sp = svc?.ports.find((x) => (number !== undefined ? x.port === number : x.name === name));
  const eps = svc && sp ? endpointsOf(c, svc).filter((e) => resolvePort(e.pod.container, sp.targetPort) !== undefined) : [];
  if (!sp || !eps.length) return page(503, "Service Temporarily Unavailable");
  const key = `ing/${ns}/${svc!.metadata.name}`;
  const i = rotate ? (c.connections[key] = (c.connections[key] ?? 0) + 1) - 1 : 0;
  const ep = eps[i % eps.length];
  const result = finish(connectPod(c, INGRESS_NGINX, ep.pod, resolvePort(ep.pod.container, sp.targetPort)!), path);
  if (result.kind === "timeout") return page(504, "Gateway Time-out");
  if (result.kind !== "http") return page(502, "Bad Gateway");
  return result;
}

/** The tls entries of served Ingresses. */
const tlsHosts = (c: Cluster) => list(c, "Ingress").filter((i) => served(c, i)).flatMap((i) => i.tls.map((t) => ({ i, t })));

/** A request from the learner's laptop: names in served Ingress rules resolve to the controller, nothing else resolves. */
export function laptopRequest(c: Cluster, rawUrl: string, hostHeader: string | undefined, insecure: boolean, rotate: boolean): HttpResult {
  const url = parseUrl(rawUrl);
  if (!url) return { kind: "dns" };
  const ingresses = list(c, "Ingress").filter((i) => served(c, i));
  if (isIP(url.host)) {
    if (url.host !== INGRESS_IP) return { kind: "timeout" };
  } else if (!ingresses.some((i) => i.rules.some((r) => r.host !== undefined && hostMatches(r.host, url.host)))) return { kind: "dns" };
  if (url.port !== (url.scheme === "https" ? 443 : 80)) return { kind: "refused", ip: INGRESS_IP };
  const host = hostHeader ?? url.host;
  const tls = tlsHosts(c).filter(({ t }) => t.hosts.some((h) => hostMatches(h, host)));
  if (url.scheme === "https") {
    const valid = tls.some(({ i, t }) => t.secretName && t.hosts.some((h) => hostMatches(h, url.host)) && find(c, "Secret", i.metadata.namespace, t.secretName));
    if (!valid && !insecure) return { kind: "tls" };
  } else if (tls.length) return page(308, "Permanent Redirect");
  return controllerResponse(c, host, url.path, rotate);
}

export const laptopHttpStatus = (c: Cluster, url: string, expected: HttpStatus) => statusMatches(laptopRequest(c, url, undefined, true, false), expected);

/** `curl` typed at the prompt, outside the cluster. */
export function laptopCurl(c: Cluster, args: string[]): ClientOutcome {
  const o = parseCurl(args);
  if (typeof o === "string") return { out: `${o}\n`, code: 2 };
  const url = parseUrl(o.url!);
  if (!url) return { out: o.silent && !o.showError ? "" : `curl: (3) URL rejected: Bad hostname\n`, code: 3 };
  const header = o.headers.map((h) => h.match(/^host:\s*(\S+)\s*$/i)?.[1]).find(Boolean)?.toLowerCase();
  return curlOutput(laptopRequest(c, o.url!, header, o.insecure, true), o, url);
}

// --- Display ---

export const INGRESS_HEADERS = {
  Ingress: ["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"],
  IngressClass: ["NAME", "CONTROLLER", "PARAMETERS", "AGE"],
};

const hostsText = (ing: Ingress) => [...new Set(ing.rules.map((r) => r.host ?? "*"))].join(",") || "*";

export function ingressRow(c: Cluster, r: Ingress | IngressClass): string[] {
  const created = age(c, r.metadata.createdAt);
  if (r.kind === "IngressClass") return [r.metadata.name, r.controller, "<none>", created];
  return [r.metadata.name, r.ingressClassName ?? "<none>", hostsText(r), served(c, r) ? INGRESS_IP : "", r.tls.length ? "80, 443" : "80", created];
}

const backendYaml = (b: IngressBackend) => ({ service: { name: b.service.name, port: b.service.port } });

export function ingressManifest(c: Cluster, r: Ingress | IngressClass, metadata: Record<string, unknown>, live: boolean) {
  if (r.kind === "IngressClass") return { apiVersion: "networking.k8s.io/v1", kind: "IngressClass", metadata, spec: { controller: r.controller } };
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata,
    spec: {
      ingressClassName: r.ingressClassName,
      defaultBackend: r.defaultBackend && backendYaml(r.defaultBackend),
      tls: r.tls.length ? r.tls : undefined,
      rules: r.rules.map((rule) => ({ host: rule.host, http: { paths: rule.paths.map((p) => ({ path: p.path, pathType: p.pathType, backend: backendYaml(p.backend) })) } })),
    },
    ...(live && { status: { loadBalancer: served(c, r) ? { ingress: [{ ip: INGRESS_IP }] } : {} } }),
  };
}

/** `svc:port (ip:port,...)` as describe ingress prints a backend. */
function backendText(c: Cluster, ns: string, b: IngressBackend): string {
  const { name, port } = b.service;
  const ref = `${name}:${port.number ?? port.name}`;
  const svc = find(c, "Service", ns, name);
  if (!svc) return `${ref} (<error: services "${name}" not found>)`;
  if (!Object.keys(svc.selector).length) return `${ref} (<error: endpoints "${name}" not found>)`;
  const sp = svc.ports.find((x) => (port.number !== undefined ? x.port === port.number : x.name === port.name));
  const eps = sp ? endpointsOf(c, svc).flatMap((e) => {
    const target = resolvePort(e.pod.container, sp.targetPort);
    return target === undefined ? [] : [`${e.ip}:${target}`];
  }) : [];
  return `${ref} (${eps.join(",")})`;
}

export function describeIngress(c: Cluster, r: Ingress | IngressClass): string {
  if (r.kind === "IngressClass") {
    return aligned([
      ["Name", r.metadata.name],
      ["Labels", labelText(r.metadata.labels).replace(/,/g, "\n              ")],
      ["Annotations", annotationText(r.metadata.annotations)],
      ["Controller", r.controller],
    ]);
  }
  const ns = r.metadata.namespace;
  const rows = r.rules.flatMap((rule) => [
    [rule.host ?? "*", "", ""],
    ...rule.paths.map((p) => ["", p.path, backendText(c, ns, p.backend)]),
  ]);
  const rules = [["Host", "Path", "Backends"], ["----", "----", "--------"], ...rows].map((row) => `  ${row[0].padEnd(Math.max(4, ...rows.map((x) => x[0].length)) + 2)}${row[1].padEnd(Math.max(4, ...rows.map((x) => x[1].length)) + 2)}${row[2]}`.trimEnd());
  return [
    aligned([
      ["Name", r.metadata.name],
      ["Labels", labelText(r.metadata.labels)],
      ["Namespace", ns],
      ["Address", served(c, r) ? INGRESS_IP : ""],
      ["Ingress Class", r.ingressClassName ?? "<none>"],
      ["Default backend", r.defaultBackend ? backendText(c, ns, r.defaultBackend) : "<default>"],
    ]),
    ...(r.tls.length ? ["TLS:", ...r.tls.map((t) => `  ${t.secretName ?? "SNI routes"} terminates ${t.hosts.join(",")}`)] : []),
    "Rules:",
    ...rules,
    `${"Annotations:".padEnd(18)}${annotationText(r.metadata.annotations)}`,
  ].join("\n");
}
