export function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="my-6 max-w-[70ch] rounded-lg border border-border bg-surface p-5">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 leading-7 text-muted [&_code]:text-fg">{children}</div>
    </aside>
  );
}
