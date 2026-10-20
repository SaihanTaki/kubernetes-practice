"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Line = { kind: "input" | "output" | "error"; text: string };

type Props = {
  execute: (command: string) => { output: string; error: boolean };
  label: string;
};

export function Terminal({ execute, label }: Props) {
  const [lines, setLines] = useState<Line[]>([
    { kind: "output", text: 'Simulated cluster. Type "kubectl help" to see what is supported.' },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function submit() {
    const command = input.trim();
    setInput("");
    setCursor(-1);
    if (!command) return;
    setHistory((h) => [...h, command]);
    if (command === "clear") return setLines([]);
    const { output, error } = execute(command);
    setLines((l) => [...l, { kind: "input", text: command }, ...(output ? [{ kind: error ? "error" : "output", text: output } as Line] : [])]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") return submit();
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    if (!history.length) return;
    const next =
      e.key === "ArrowUp"
        ? cursor === -1 ? history.length - 1 : Math.max(0, cursor - 1)
        : cursor === -1 || cursor === history.length - 1 ? -1 : cursor + 1;
    setCursor(next);
    setInput(next === -1 ? "" : history[next]);
  }

  return (
    <div
      className="flex h-72 flex-col rounded-md sm:h-96 bg-[#16181d] font-mono text-sm text-[#e5e7eb]"
      onClick={() => window.getSelection()?.isCollapsed && inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="flex-1 overflow-auto p-3" role="log" aria-live="polite" aria-label={`${label} output`}>
        {lines.map((line, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-words ${line.kind === "error" ? "text-[#fca5a5]" : ""} ${line.kind === "input" ? "mt-2" : ""}`}
          >
            {line.kind === "input" && <span className="text-[#86efac] select-none">$ </span>}
            {line.text}
          </pre>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-b-md border-t border-white/15 px-3 py-2 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-[#8ab4ff]">
        <span className="text-[#86efac] select-none" aria-hidden>
          $
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={`${label} command`}
          placeholder="kubectl get pods"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11 flex-1 bg-transparent text-base placeholder:text-[#9ca3af] focus:outline-none sm:text-sm"
        />
      </div>
    </div>
  );
}
