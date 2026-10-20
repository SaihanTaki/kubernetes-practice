import { MI, parseMemory } from "./quantity";
import type { Pod } from "./types";

/** Wall time at clock 0. Fixed and mid-morning, so nightly CronJob schedules never fire during a lab. */
export const WALL_CLOCK_START = Date.UTC(2026, 0, 15, 10, 0, 0);

export const wallTime = (clock: number) => new Date(WALL_CLOCK_START + clock * 1000);

/** A clock-derived RFC 3339 time, so output is deterministic. */
export const timestamp = (clock: number) => wallTime(clock).toISOString().replace(/\.\d+Z$/, "Z");

const logTime = (clock: number) => timestamp(clock).replace(/-/g, "/").replace("T", " ").replace("Z", "");

/** What a known image does. Add an entry here to teach the simulator a new image. */
export type ImageInfo = {
  tags: string[];
  http?: number;
  /** Paths served with 200; everything else on the HTTP port is 404. */
  paths?: string[];
  /** Path prefixes (whole segments) served with 200 as well. */
  prefixes?: string[];
  tcp?: number;
  /** Tags whose container exits with an error right after starting. */
  crashes?: string[];
  /** A variable the process exits without (exit code 1). */
  needsEnv?: string;
  /** Memory the process uses once running, in MiB. */
  memoryMi: number;
  /** Fixed CPU use in millicores; idle images use 1m-5m. */
  cpuMilli?: number;
  /** Log lines of the current (or, for crashes, each) container run. */
  logs?: (p: Pod, tag: string, env: Record<string, string>) => string[];
};

const started = (p: Pod) => p.metadata.createdAt + 5;

const nginxLogs = (p: Pod, tag: string) => {
  const t = logTime(started(p));
  const version = /^\d+\.\d+$/.test(tag) ? `${tag}.0` : "1.27.5";
  return [
    "/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration",
    "/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/",
    "/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh",
    "/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh",
    "/docker-entrypoint.sh: Configuration complete; ready for start up",
    `${t} [notice] 1#1: using the "epoll" event method`,
    `${t} [notice] 1#1: nginx/${version}`,
    `${t} [notice] 1#1: start worker processes`,
  ];
};

const MEMHOG_STEP_MI = 100;

export const IMAGES: Record<string, ImageInfo> = {
  nginx: { tags: ["1.25", "1.26", "1.27", "1.28", "latest"], http: 80, paths: ["/"], memoryMi: 20, logs: nginxLogs },
  httpd: {
    tags: ["2.4", "latest"],
    http: 80,
    paths: ["/"],
    memoryMi: 30,
    logs: (p) => [
      `AH00558: httpd: Could not reliably determine the server's fully qualified domain name, using ${p.metadata.name}. Set the 'ServerName' directive globally to suppress this message`,
      `[${wallTime(started(p)).toUTCString()}] [mpm_event:notice] [pid 1:tid 1] AH00489: Apache/2.4.62 (Unix) configured -- resuming normal operations`,
    ],
  },
  redis: {
    tags: ["7", "7.2", "latest"],
    tcp: 6379,
    memoryMi: 60,
    logs: () => ["1:C * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo", "1:M * Server initialized", "1:M * Ready to accept connections tcp"],
  },
  busybox: { tags: ["1.36", "latest"], memoryMi: 2, logs: () => [] },
  perl: { tags: ["5.34", "5.40", "latest"], memoryMi: 10, logs: () => [] },
  "example/api": {
    tags: ["1.0", "1.1", "2.0", "latest"],
    http: 8080,
    paths: ["/", "/healthz", "/ready"],
    prefixes: ["/api"],
    crashes: ["2.0"],
    memoryMi: 100,
    logs: (_, tag) => (tag === "2.0" ? ["fatal: config file /etc/api/config.yaml not found"] : ["listening on :8080"]),
  },
  "example/worker": {
    tags: ["1.0", "1.1"],
    needsEnv: "QUEUE_URL",
    memoryMi: 40,
    logs: (_, __, env) => (Object.hasOwn(env, "QUEUE_URL") ? [`connected to ${env.QUEUE_URL}`] : ["error: QUEUE_URL is not set"]),
  },
  "example/memhog": {
    tags: ["1.0"],
    http: 8080,
    paths: ["/"],
    memoryMi: 600,
    cpuMilli: 50,
    logs: (p) => {
      const limit = parseMemory(p.container.resources?.limits?.memory ?? "") ?? Infinity;
      const lines: string[] = [];
      for (let total = MEMHOG_STEP_MI; total <= 600; total += MEMHOG_STEP_MI) {
        lines.push(`allocated ${MEMHOG_STEP_MI}Mi (total ${total}Mi)`);
        if (total * MI > limit) return lines;
      }
      return [...lines, "holding 600Mi, serving on :8080"];
    },
  },
};

/** Whether the image answers this path with 200 on its HTTP port. */
export const servesPath = (info: Pick<ImageInfo, "paths" | "prefixes">, path: string) =>
  !!info.paths?.includes(path) || !!info.prefixes?.some((x) => path === x || path.startsWith(`${x}/`));

export function parseImage(image: string) {
  const colon = image.lastIndexOf(":");
  return colon > image.lastIndexOf("/") ? { repo: image.slice(0, colon), tag: image.slice(colon + 1) } : { repo: image, tag: "latest" };
}

/** Unknown repositories behave like nginx, so any image name works for simple examples. */
export function imageInfo(image: string) {
  const { repo, tag } = parseImage(image);
  const info = IMAGES[repo];
  if (!info) return { ...IMAGES.nginx, tag, pullable: true, crashes: false };
  return { ...info, tag, pullable: info.tags.includes(tag), crashes: !!info.crashes?.includes(tag) };
}
