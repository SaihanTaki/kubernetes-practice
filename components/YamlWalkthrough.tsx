import { manifests } from "@/content/chapters";

export function YamlWalkthrough({ id }: { id: string }) {
  const m = manifests[id];
  if (!m) throw new Error(`Unknown manifest "${id}"`);
  const marker = new Map(m.notes.map((n, i) => [n.line, i + 1]));

  return (
    <figure className="my-6">
      <figcaption className="mb-2 font-mono text-sm text-muted">{m.title}</figcaption>
      <div className="grid gap-4 lg:grid-cols-2">
        <pre className="overflow-x-auto rounded-md border border-border bg-code py-3 font-mono text-sm leading-6">
          {m.yaml.split("\n").map((line, i) => {
            const n = marker.get(i + 1);
            return (
              <div key={i} className={`flex px-3 ${n ? "bg-accent/10" : ""}`}>
                <span className="w-7 shrink-0 text-right text-xs leading-6 text-accent select-none">{n ?? ""}</span>
                <code className="pl-3 whitespace-pre">{line}</code>
              </div>
            );
          })}
        </pre>
        <ol className="space-y-2 text-sm">
          {m.notes.map((note, i) => (
            <li key={note.line} className="flex gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-accent">{i + 1}</span>
              <span>{note.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
