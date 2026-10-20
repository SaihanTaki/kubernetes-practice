import { fail, type Parsed } from "./cli";
import { containerEnv, isFinished, list } from "./cluster";
import { nslookup, podCurl, wget } from "./http";
import { listDir, readFile, writeFile } from "./files";
import { parseImage } from "./images";
import { podByRef } from "./observe";
import { echo, type Outcome, parseScript, runStatements, ScriptError, shellScript } from "./shell";
import type { Cluster, Pod } from "./types";

export type ExecContext = { c: Cluster; pod: Pod };
export type ExecCommand = (ctx: ExecContext, args: string[]) => Outcome;

/** busybox prints its own error wording; other images use GNU coreutils'. */
const busybox = (p: Pod) => parseImage(p.image).repo === "busybox";

function cat({ c, pod }: ExecContext, args: string[]): Outcome {
  if (!args.length) return { out: "cat: reading from stdin is not supported in this simulator\n", code: 1 };
  let out = "";
  let code = 0;
  for (const path of args) {
    const text = readFile(c, pod, path);
    if (text !== null) {
      out += text;
      continue;
    }
    code = 1;
    if (listDir(c, pod, path)) out += busybox(pod) ? "cat: read error: Is a directory\n" : `cat: ${path}: Is a directory\n`;
    else out += busybox(pod) ? `cat: can't open '${path}': No such file or directory\n` : `cat: ${path}: No such file or directory\n`;
  }
  return { out, code };
}

// shortcut: ls ignores its options (-l, -a, ...) and prints names one per line, as it does without a terminal.
function ls({ c, pod }: ExecContext, args: string[]): Outcome {
  const paths = args.filter((a) => !a.startsWith("-"));
  let out = "";
  let code = 0;
  for (const path of paths.length ? paths : ["/"]) {
    const names = listDir(c, pod, path);
    if (readFile(c, pod, path) !== null) out += `${path}\n`;
    else if (names) out += names.map((n) => `${n}\n`).join("");
    else {
      code = busybox(pod) ? 1 : 2;
      out += busybox(pod) ? `ls: ${path}: No such file or directory\n` : `ls: cannot access '${path}': No such file or directory\n`;
    }
  }
  return { out, code };
}

/** The process environment: image defaults, the container's env, then Service variables as the kubelet injects them. */
export function processEnv(c: Cluster, pod: Pod): [string, string][] {
  const services = list(c, "Service", pod.metadata.namespace).filter(
    (s) => s.clusterIP !== "None" && Number(s.metadata.uid) < Number(pod.metadata.uid),
  );
  const serviceVars = ([["kubernetes", "10.96.0.1", 443, "https"]] as [string, string, number, string | undefined][])
    .concat(services.map((s) => [s.metadata.name, s.clusterIP, s.ports[0].port, s.ports[0].name]))
    .flatMap(([name, ip, port, portName]): [string, string][] => {
      const prefix = name.toUpperCase().replace(/-/g, "_");
      const tcp = `${prefix}_PORT_${port}_TCP`;
      return [
        [`${prefix}_SERVICE_HOST`, ip],
        [`${prefix}_SERVICE_PORT`, String(port)],
        ...(portName ? [[`${prefix}_SERVICE_PORT_${portName.toUpperCase().replace(/-/g, "_")}`, String(port)] as [string, string]] : []),
        [`${prefix}_PORT`, `tcp://${ip}:${port}`],
        [tcp, `tcp://${ip}:${port}`],
        [`${tcp}_PROTO`, "tcp"],
        [`${tcp}_PORT`, String(port)],
        [`${tcp}_ADDR`, ip],
      ];
    });
  return [
    ["PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
    ["HOSTNAME", pod.metadata.name],
    ...Object.entries(containerEnv(c, pod)),
    ...serviceVars,
    ["HOME", "/root"],
  ];
}

function printenv({ c, pod }: ExecContext, args: string[]): Outcome {
  const env = processEnv(c, pod);
  if (!args.length) return { out: env.map(([k, v]) => `${k}=${v}\n`).join(""), code: 0 };
  const values = args.map((name) => env.findLast(([k]) => k === name)?.[1]);
  return { out: values.filter((v) => v !== undefined).map((v) => `${v}\n`).join(""), code: values.includes(undefined) ? 1 : 0 };
}

/** Commands `kubectl exec` runs, directly or inside `sh -c '...'`. Add an entry to support another command. */
export const EXEC_COMMANDS: Record<string, ExecCommand> = {
  cat,
  ls,
  echo: (_, args) => echo(args),
  env: (ctx, args) => (args.length ? { out: "env: running a command through env is not supported in this simulator\n", code: 125 } : printenv(ctx, [])),
  printenv,
  wget: ({ c, pod }, args) => wget(c, pod, args, (path, text) => writeFile(c, pod, path, text, false)),
  curl: ({ c, pod }, args) => podCurl(c, pod, args),
  nslookup: ({ c, pod }, args) => nslookup(c, pod, args),
  hostname: ({ pod }) => ({ out: `${pod.metadata.name}\n`, code: 0 }),
};

function unsupported(): never {
  const names = Object.keys(EXEC_COMMANDS);
  fail(`error: the simulator only supports ${names.slice(0, -1).join(", ")} and ${names.at(-1)} in exec, directly or inside sh -c '...'`);
}

export function exec(c: Cluster, p: Parsed): string {
  const [ref, extra] = p.args;
  if (!ref) fail("error: expected 'exec POD_NAME -- COMMAND', e.g. kubectl exec web -- cat /etc/hostname");
  if (extra) fail(`error: unexpected argument "${extra}", put the command after --`);
  const argv = p.command?.length ? p.command : fail("error: you must specify at least one command for the container, after --, e.g. kubectl exec web -- ls /");
  const { pod } = podByRef(c, p.namespace, ref, "exec into");
  const ctr = pod.container.name;
  if (p.container !== undefined && p.container !== ctr) fail(`Error from server (BadRequest): container ${p.container} is not valid for pod ${pod.metadata.name}`);
  if (isFinished(pod)) fail(`error: cannot exec into a container in a completed pod; current phase is ${pod.status === "Completed" ? "Succeeded" : "Failed"}`);
  if (pod.status !== "Running") fail(`error: unable to upgrade connection: container not found ("${ctr}")`);

  const ctx = { c, pod };
  const run = ([cmd, ...args]: string[]) => (Object.hasOwn(EXEC_COMMANDS, cmd) ? EXEC_COMMANDS[cmd](ctx, args) : unsupported());
  const script = shellScript(argv);
  let result: Outcome;
  if (script === null) result = run(argv);
  else {
    try {
      result = runStatements(parseScript(script), run, (path, text, append) => writeFile(c, pod, path, text, append));
    } catch (e) {
      if (!(e instanceof ScriptError)) throw e;
      result = { out: `${e.message}\n`, code: 2 };
    }
  }
  const out = result.out.replace(/\n$/, "");
  if (result.code) fail(`${out ? `${out}\n` : ""}command terminated with exit code ${result.code}`);
  return out;
}
