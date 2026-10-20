import { endpointsOf, find, hasIP, isReady, list, podIP, resolvePort } from "./cluster";
import { imageInfo, parseImage, servesPath } from "./images";
import { allowed, dnsAllowed, type Endpoint, podEndpoint } from "./netpol";
import { runProgram } from "./shell";
import type { Cluster, Pod, Service } from "./types";

export const DNS_SERVICE_IP = "10.96.0.10";
const DOMAIN = "cluster.local";

/** What a client got: no name, no answer, a refusal, a TCP peer that does not speak HTTP, a bad certificate, or a response. */
export type HttpResult =
  | { kind: "dns" }
  | { kind: "timeout" }
  | { kind: "refused"; ip: string }
  | { kind: "empty" }
  | { kind: "tls" }
  | { kind: "http"; status: number; reason: string; body: string; server: string };

export type Url = { scheme: "http" | "https"; host: string; port: number; path: string };

export function parseUrl(raw: string): Url | null {
  const m = raw.match(/^(?:(https?):\/\/)?([A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s#?]*)?(?:\?[^\s#]*)?$/);
  if (!m) return null;
  const scheme = (m[1] ?? "http") as Url["scheme"];
  const port = m[3] ? Number(m[3]) : scheme === "https" ? 443 : 80;
  if (port < 1 || port > 65535) return null;
  return { scheme, host: m[2].toLowerCase(), port, path: m[4] ?? "/" };
}

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
export const isIP = (host: string) => IP_RE.test(host) && host.split(".").every((x) => Number(x) <= 255);

const headless = (s: Service) => s.clusterIP === "None";

/** IPv4 addresses for one fully qualified name, or null for NXDOMAIN. */
function lookupFqdn(c: Cluster, fqdn: string): string[] | null {
  const labels = fqdn.split(".");
  const kind = labels.at(-3);
  if (labels.slice(-2).join(".") !== DOMAIN || (kind !== "svc" && kind !== "pod")) return null;
  const parts = labels.slice(0, -3);
  if (kind === "pod") {
    const [dashed, ns, ...extra] = parts;
    const ip = dashed?.replace(/-/g, ".");
    return parts.length === 2 && !extra.length && isIP(ip) && c.namespaces.includes(ns) ? [ip] : null;
  }
  if (parts.length === 2) {
    const [name, ns] = parts;
    const svc = find(c, "Service", ns, name);
    if (!svc) return null;
    if (!headless(svc)) return [svc.clusterIP];
    const ips = endpointsOf(c, svc).map((e) => e.ip);
    return ips.length ? ips : null;
  }
  if (parts.length === 3) {
    // <pod>.<headless service>.<ns>: the per-Pod record a StatefulSet gets through its serviceName.
    const [podName, svcName, ns] = parts;
    const svc = find(c, "Service", ns, svcName);
    const pod = find(c, "Pod", ns, podName);
    const sts = pod?.ownerKind === "StatefulSet" ? find(c, "StatefulSet", ns, pod.owner!) : undefined;
    return svc && headless(svc) && pod && sts?.serviceName === svcName && isReady(pod) ? [podIP(pod)] : null;
  }
  return null;
}

/** Resolves a name like a Pod's resolver would, with search domains `<ns>.svc.cluster.local svc.cluster.local cluster.local`. */
export function resolve(c: Cluster, fromNs: string, host: string): { fqdn: string; ips: string[] } | null {
  if (isIP(host)) return { fqdn: host, ips: [host] };
  const name = host.replace(/\.$/, "");
  const candidates = host.endsWith(".") ? [name] : [`${fromNs}.svc.${DOMAIN}`, `svc.${DOMAIN}`, DOMAIN].map((d) => `${name}.${d}`).concat(name);
  for (const fqdn of candidates) {
    const ips = lookupFqdn(c, fqdn);
    if (ips) return { fqdn, ips };
  }
  return null;
}

/** Picks one of `n` backends: rotating per call in a real request, always the first for a validator. */
function pick(c: Cluster, key: string, n: number, rotate: boolean): number {
  if (!rotate) return 0;
  const i = c.connections[key] ?? 0;
  c.connections[key] = i + 1;
  return i % n;
}

type Connection = { kind: "timeout" } | { kind: "refused"; ip: string } | { kind: "open"; pod: Pod; port: number; http: boolean };

/** A TCP connection from `src` to a Pod: NetworkPolicy, then whether the container listens on the port. */
export function connectPod(c: Cluster, src: Endpoint, pod: Pod, port: number): Connection {
  const ip = podIP(pod);
  if (!allowed(c, src, podEndpoint(pod, ip), port)) return { kind: "timeout" };
  const info = imageInfo(pod.image);
  if (pod.status !== "Running" || runProgram(pod.image, pod.container)) return { kind: "refused", ip };
  if (port === info.http) return { kind: "open", pod, port, http: true };
  if (port === info.tcp) return { kind: "open", pod, port, http: false };
  return { kind: "refused", ip };
}

/** A TCP connection to an IP: a ClusterIP goes through kube-proxy to one ready endpoint, a Pod IP goes straight to the Pod. */
function connect(c: Cluster, src: Endpoint, ip: string, port: number, rotate: boolean): Connection {
  const svc = list(c, "Service").find((s) => s.clusterIP === ip);
  if (svc) {
    const sp = svc.ports.find((x) => x.port === port);
    // kube-proxy has no rule for a port the Service does not have, so nothing answers.
    if (!sp) return { kind: "timeout" };
    const eps = endpointsOf(c, svc).filter((e) => resolvePort(e.pod.container, sp.targetPort) !== undefined);
    if (!eps.length) return { kind: "refused", ip };
    const ep = eps[pick(c, `svc/${svc.metadata.namespace}/${svc.metadata.name}`, eps.length, rotate)];
    return connectPod(c, src, ep.pod, resolvePort(ep.pod.container, sp.targetPort)!);
  }
  const pod = list(c, "Pod").find((p) => hasIP(p) && podIP(p) === ip);
  return pod ? connectPod(c, src, pod, port) : { kind: "timeout" };
}

const NGINX_INDEX = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>
</body>
</html>`;

/** The error page nginx (and so the ingress controller) serves for a status. */
export const nginxPage = (status: number, reason: string) =>
  `<html>\n<head><title>${status} ${reason}</title></head>\n<body>\n<center><h1>${status} ${reason}</h1></center>\n<hr><center>nginx</center>\n</body>\n</html>`;

export const nginxVersion = (tag: string) => (/^\d+\.\d+$/.test(tag) ? `${tag}.0` : "1.27.5");

/** The image's answer to GET path. */
export function respond(pod: Pod, path: string): Extract<HttpResult, { kind: "http" }> {
  const info = imageInfo(pod.image);
  const { repo, tag } = parseImage(pod.image);
  const ok = servesPath(info, path.split("?")[0]);
  const [status, reason] = ok ? [200, "OK"] : [404, "Not Found"];
  if (repo === "example/api" || repo === "example/memhog") {
    return { kind: "http", status, reason, server: "", body: ok ? `{"pod":"${pod.metadata.name}","version":"${tag}"}` : "404 page not found" };
  }
  if (repo === "httpd") {
    const body = ok ? "<html><body><h1>It works!</h1></body></html>" : `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL was not found on this server.</p>\n</body></html>`;
    return { kind: "http", status, reason, server: "Apache/2.4.62 (Unix)", body };
  }
  return { kind: "http", status, reason, server: `nginx/${nginxVersion(repo === "nginx" ? tag : "")}`, body: ok ? NGINX_INDEX : nginxPage(404, "Not Found") };
}

export function finish(conn: Connection, path: string): HttpResult {
  if (conn.kind !== "open") return conn;
  return conn.http ? respond(conn.pod, path) : { kind: "empty" };
}

/** GET url from inside a Pod. `rotate` spreads repeated calls over a Service's endpoints. */
export function podRequest(c: Cluster, from: Pod, url: Url, rotate: boolean): HttpResult & { ip?: string } {
  const src = podEndpoint(from, podIP(from));
  if (!isIP(url.host) && !dnsAllowed(c, src)) return { kind: "dns" };
  const ips = resolve(c, from.metadata.namespace, url.host)?.ips;
  if (!ips) return { kind: "dns" };
  const ip = ips[0];
  const result = finish(connect(c, src, ip, url.port, rotate), url.path);
  // shortcut: Pods serve plain HTTP only; https to an open port fails like a TLS client talking to a plain server.
  if (url.scheme === "https" && result.kind === "http") return { kind: "empty", ip };
  return { ...result, ip };
}

/** What the http-get validator expects: a status, a failure, or "connected" for any answer over an open connection. */
export type HttpStatus = number | "timeout" | "refused" | "dns" | "connected";

export function statusMatches(r: HttpResult, expected: HttpStatus): boolean {
  if (expected === "connected") return r.kind === "http" || r.kind === "empty";
  if (typeof expected === "number") return r.kind === "http" && r.status === expected;
  return r.kind === expected;
}

export function podHttpStatus(c: Cluster, from: Pod, url: string, expected: HttpStatus): boolean {
  const parsed = parseUrl(url);
  return !!parsed && statusMatches(podRequest(c, from, parsed, false), expected);
}

// --- Clients ---

export type ClientOutcome = { out: string; code: number };

type CurlOptions = { silent: boolean; showError: boolean; maxTime?: number; insecure: boolean; include: boolean; fail: boolean; headers: string[]; url?: string };

/** Parses curl's options. Returns an error message for anything unsupported. */
export function parseCurl(args: string[]): CurlOptions | string {
  const o: CurlOptions = { silent: false, showError: false, insecure: false, include: false, fail: false, headers: [] };
  const long: Record<string, string> = { "--silent": "s", "--show-error": "S", "--max-time": "m", "--insecure": "k", "--include": "i", "--fail": "f", "--header": "H" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-") || arg === "-") {
      if (o.url !== undefined) return `curl: this simulator supports one URL per call`;
      o.url = arg;
      continue;
    }
    const [flag, inline] = arg.startsWith("--") ? [arg.split("=")[0], arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined] : [arg, undefined];
    const letters = arg.startsWith("--") ? (Object.hasOwn(long, flag) ? long[flag] : null) : arg.slice(1);
    if (letters === null) return `curl: option ${flag}: is unknown\ncurl: try 'curl --help' for more information`;
    for (let j = 0; j < letters.length; j++) {
      const ch = letters[j];
      if (ch === "m" || ch === "H") {
        const value = inline ?? (j + 1 < letters.length ? letters.slice(j + 1) : args[++i]);
        if (value === undefined) return `curl: option -${ch}: requires parameter\ncurl: try 'curl --help' for more information`;
        if (ch === "H") o.headers.push(value);
        else if (!/^\d+(\.\d+)?$/.test(value)) return `curl: option -m: expected a proper numerical parameter`;
        else o.maxTime = Number(value);
        break;
      }
      const flags: Record<string, keyof CurlOptions> = { s: "silent", S: "showError", k: "insecure", i: "include", f: "fail" };
      if (!Object.hasOwn(flags, ch)) return `curl: option -${ch}: is unknown in this simulator (supported: -s -S -m -k -i -f -H)`;
      (o[flags[ch]] as boolean) = true;
    }
  }
  if (o.url === undefined) return "curl: no URL specified\ncurl: try 'curl --help' for more information";
  return o;
}

const CERT_HELP = `More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the web page mentioned above.`;

/** What curl prints for a result, and its exit code. */
export function curlOutput(r: HttpResult, o: CurlOptions, url: Url): ClientOutcome {
  const error = (code: number, message: string) => ({ out: !o.silent || o.showError ? `curl: (${code}) ${message}\n` : "", code });
  switch (r.kind) {
    case "dns":
      return error(6, `Could not resolve host: ${url.host}`);
    case "timeout":
      return error(28, `Connection timed out after ${Math.round((o.maxTime ?? 130) * 1000) + 1} milliseconds`);
    case "refused":
      return error(7, `Failed to connect to ${url.host} port ${url.port} after 0 ms: Couldn't connect to server`);
    case "empty":
      return error(52, "Empty reply from server");
    case "tls":
      return error(60, `SSL certificate problem: self-signed certificate\n${CERT_HELP}`);
    case "http": {
      if (o.fail && r.status >= 400) return error(22, `The requested URL returned error: ${r.status}`);
      const headers = [`HTTP/1.1 ${r.status} ${r.reason}`, ...(r.server ? [`Server: ${r.server}`] : []), `Content-Length: ${r.body.length + 1}`, "", ""].join("\n");
      return { out: `${o.include ? headers : ""}${r.body}\n`, code: 0 };
    }
  }
}

/** busybox wget: `wget [-q] [-O file|-] [-T seconds] URL`. */
export function wget(c: Cluster, from: Pod, args: string[], write: (path: string, text: string) => string | null): ClientOutcome {
  let quiet = false;
  let output: string | undefined;
  let url: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("-") || arg === "-") {
      if (url !== undefined) return { out: "wget: this simulator supports one URL per call\n", code: 1 };
      url = arg;
      continue;
    }
    if (arg.startsWith("--timeout=") || arg === "--quiet") {
      quiet ||= arg === "--quiet";
      continue;
    }
    if (arg.startsWith("--output-document=")) {
      output = arg.slice(18);
      continue;
    }
    const letters = arg.slice(1);
    for (let j = 0; j < letters.length; j++) {
      const ch = letters[j];
      if (ch === "q") quiet = true;
      else if (ch === "O" || ch === "T") {
        const value = j + 1 < letters.length ? letters.slice(j + 1) : args[++i];
        if (value === undefined) return { out: `wget: option requires an argument -- '${ch}'\n`, code: 1 };
        if (ch === "O") output = value;
        else if (!/^\d+$/.test(value)) return { out: `wget: invalid number '${value}'\n`, code: 1 };
        break;
      } else return { out: `wget: unrecognized option '-${ch}' (supported: -q -O -T)\n`, code: 1 };
    }
  }
  if (!url) return { out: "BusyBox v1.36.1 multi-call binary.\n\nUsage: wget [-cqS] [-O FILE] [-T SEC] URL...\n", code: 1 };
  const parsed = parseUrl(url);
  if (!parsed) return { out: `wget: bad address '${url}'\n`, code: 1 };
  const r = podRequest(c, from, parsed, true);
  if (r.kind === "dns") return { out: `wget: bad address '${parsed.host}'\n`, code: 1 };
  const hostPort = url.replace(/^https?:\/\//, "").split("/")[0];
  const connecting = quiet ? "" : `Connecting to ${hostPort} (${r.ip}:${parsed.port})\n`;
  const failed = (message: string) => ({ out: `${connecting}wget: ${message}\n`, code: 1 });
  switch (r.kind) {
    case "timeout":
      return failed("download timed out");
    case "refused":
      return failed(`can't connect to remote host (${r.ip}): Connection refused`);
    case "empty":
    case "tls":
      return failed("error getting response: Connection reset by peer");
    case "http": {
      if (r.status >= 400) return failed(`server returned error: HTTP/1.1 ${r.status} ${r.reason}`);
      const body = `${r.body}\n`;
      const target = output ?? "index.html";
      const progress = (name: string) => `${name.padEnd(20)} 100% |********************************|   ${body.length}  0:00:00 ETA\n`;
      if (target === "-") return { out: quiet ? body : `${connecting}writing to stdout\n${body}${progress("-")}written to stdout\n`, code: 0 };
      const error = write(target.startsWith("/") ? target : `/${target}`, body);
      if (error) return failed(`can't open '${target}': ${error.replace(/^.*: /, "")}`);
      return { out: quiet ? "" : `${connecting}saving to '${target}'\n${progress(target)}'${target}' saved\n`, code: 0 };
    }
  }
}

/** curl from inside a Pod. */
export function podCurl(c: Cluster, from: Pod, args: string[]): ClientOutcome {
  const o = parseCurl(args);
  if (typeof o === "string") return { out: `${o}\n`, code: 2 };
  const url = parseUrl(o.url!);
  if (!url) return { out: `curl: (3) URL rejected: Bad hostname\n`, code: 3 };
  return curlOutput(podRequest(c, from, url, true), o, url);
}

/** busybox nslookup. */
export function nslookup(c: Cluster, from: Pod, args: string[]): ClientOutcome {
  const [name, extra] = args;
  if (!name || extra !== undefined || name.startsWith("-")) return { out: "BusyBox v1.36.1 multi-call binary.\n\nUsage: nslookup HOST\n", code: 1 };
  if (!dnsAllowed(c, podEndpoint(from, podIP(from)))) return { out: ";; connection timed out; no servers could be reached\n\n", code: 1 };
  const server = `Server:\t\t${DNS_SERVICE_IP}\nAddress:\t${DNS_SERVICE_IP}:53\n\n`;
  if (isIP(name)) {
    const svc = list(c, "Service").find((s) => s.clusterIP === name);
    const reverse = `${name.split(".").reverse().join(".")}.in-addr.arpa`;
    if (!svc) return { out: `${server}** server can't find ${reverse}: NXDOMAIN\n\n`, code: 1 };
    return { out: `${server}${reverse}\tname = ${svc.metadata.name}.${svc.metadata.namespace}.svc.${DOMAIN}\n\n`, code: 0 };
  }
  const found = resolve(c, from.metadata.namespace, name);
  if (!found) return { out: `${server}** server can't find ${name}: NXDOMAIN\n\n`, code: 1 };
  return { out: `${server}Name:\t${found.fqdn}\n${found.ips.map((ip) => `Address: ${ip}\n`).join("")}\n`, code: 0 };
}
