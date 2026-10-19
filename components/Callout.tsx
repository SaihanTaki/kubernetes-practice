export function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="my-6 rounded-md border border-border bg-surface p-4">
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </aside>
  );
}
