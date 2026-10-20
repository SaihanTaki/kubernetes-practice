import { parseImage } from "./images";
import type { Container } from "./types";

/** One simple command of a script, with an optional `>`/`>>` redirect and how it joins the previous one. */
export type Statement = { words: string[]; redirect?: { path: string; append: boolean }; after: ";" | "&&" | "||" };

/** Result of one command: what it printed (stdout and stderr) and its exit code. `sleep` keeps the process running. */
export type Outcome = { out: string; code: number; sleeping?: boolean; exit?: boolean };

export class ScriptError extends Error {}

/** Splits a `sh -c` script into simple commands. Quotes group words; nothing is expanded ($VAR stays literal). */
export function parseScript(script: string): Statement[] {
  const statements: Statement[] = [];
  let words: string[] = [];
  let word = "";
  let inWord = false;
  let quote = "";
  let redirect: Statement["redirect"];
  let pending: boolean | undefined;
  let after: Statement["after"] = ";";
  const endWord = () => {
    if (!inWord) return;
    if (pending !== undefined) redirect = { path: word, append: pending };
    else words.push(word);
    pending = undefined;
    word = "";
    inWord = false;
  };
  const endStatement = (next: Statement["after"]) => {
    endWord();
    if (pending !== undefined) throw new ScriptError("sh: syntax error: unexpected newline");
    if (words.length) statements.push({ words, redirect, after });
    else if (redirect || next !== ";") throw new ScriptError(`sh: syntax error: unexpected "${next}"`);
    words = [];
    redirect = undefined;
    after = next;
  };
  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    if (quote) {
      if (ch === quote) quote = "";
      else word += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === "\\" && i + 1 < script.length) {
      word += script[++i];
      inWord = true;
    } else if (ch === "\n" || ch === ";") endStatement(";");
    else if (/\s/.test(ch)) endWord();
    else if (ch === "&" && script[i + 1] === "&") {
      i++;
      endStatement("&&");
    } else if (ch === "|" && script[i + 1] === "|") {
      i++;
      endStatement("||");
    } else if (ch === "|" || ch === "&" || ch === "<") {
      throw new ScriptError(`sh: "${ch}" (pipes, background jobs and input redirects) is not supported in this simulator`);
    } else if (ch === ">") {
      endWord();
      pending = script[i + 1] === ">";
      if (pending) i++;
    } else {
      word += ch;
      inWord = true;
    }
  }
  if (quote) throw new ScriptError("sh: syntax error: unterminated quoted string");
  endStatement(";");
  return statements;
}

type CommandTable = Record<string, (args: string[]) => Outcome>;

/**
 * Runs statements like sh: `&&` and `||` look at the previous exit code, `exit` and `sleep` stop the script.
 * `write` stores a redirect and returns an error message, or null.
 */
export function runStatements(
  statements: Statement[],
  run: (words: string[]) => Outcome,
  write: (path: string, text: string, append: boolean) => string | null,
): Outcome {
  let out = "";
  let code = 0;
  for (const s of statements) {
    if ((s.after === "&&" && code !== 0) || (s.after === "||" && code === 0)) continue;
    const result = run(s.words);
    code = result.code;
    if (s.redirect) {
      const error = write(s.redirect.path, result.out, s.redirect.append);
      if (error) {
        out += `${error}\n`;
        code = 1;
      }
    } else out += result.out;
    if (result.sleeping || result.exit) return { out, code, sleeping: result.sleeping };
  }
  return { out, code };
}

export const echo = (args: string[]): Outcome => {
  const noNewline = args[0] === "-n";
  return { out: `${(noNewline ? args.slice(1) : args).join(" ")}${noNewline ? "" : "\n"}`, code: 0 };
};

const SHELLS = ["sh", "/bin/sh", "bash", "/bin/bash"];

/** The `-c` script when argv runs a shell, else null. */
export const shellScript = (argv: string[]) => (SHELLS.includes(argv[0]) && argv[1] === "-c" && argv[2] !== undefined ? argv[2] : null);

const quoteWord = (w: string) => (/^[\w./=:@%+-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`);

/** Images whose command, when set, runs once and exits instead of serving. */
const RUN_TO_COMPLETION = ["busybox", "perl"];

const PI = "3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798";

// shortcut: perl only knows the classic `print bpi(<digits>)` example; any other perl script prints nothing and exits 0.
function perl(args: string[]): Outcome {
  const script = args.find((a) => /print/.test(a)) ?? "";
  const digits = Number(script.match(/bpi\((\d+)\)/)?.[1] ?? 0);
  return { out: digits ? `${PI.slice(0, Math.min(digits, PI.length - 2) + 2)}\n` : "", code: 0 };
}

const PROGRAM: CommandTable = {
  echo,
  true: () => ({ out: "", code: 0 }),
  false: () => ({ out: "", code: 1 }),
  sleep: () => ({ out: "", code: 0, sleeping: true }),
  exit: (args) => ({ out: "", code: Number(args[0] ?? 0) || 0, exit: true }),
  perl,
};

export type ProgramRun = {
  logs: string[];
  /** null while the process keeps running. */
  exitCode: number | null;
  writes: { path: string; text: string; append: boolean }[];
};

// shortcut: commands other than echo, sleep, exit, true, false and perl are skipped as if they succeeded.
/**
 * What a run-to-completion container does: busybox or perl with a command or args. Returns null for
 * containers that just serve (any other image, or no command).
 */
export function runProgram(image: string, ctr: Container): ProgramRun | null {
  if (!RUN_TO_COMPLETION.includes(parseImage(image).repo)) return null;
  const argv = [...(ctr.command ?? []), ...(ctr.args ?? [])];
  if (!argv.length) return null;
  const script = shellScript(argv) ?? argv.map(quoteWord).join(" ");
  const writes: ProgramRun["writes"] = [];
  let result: Outcome;
  try {
    result = runStatements(
      parseScript(script),
      ([cmd, ...args]) => (Object.hasOwn(PROGRAM, cmd) ? PROGRAM[cmd](args) : { out: "", code: 0 }),
      (path, text, append) => (writes.push({ path, text, append }), null),
    );
  } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    result = { out: `${e.message}\n`, code: 2 };
  }
  const logs = result.out.replace(/\n$/, "");
  return { logs: logs ? logs.split("\n") : [], exitCode: result.sleeping ? null : result.code, writes };
}
