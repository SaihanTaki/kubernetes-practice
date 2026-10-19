import type { Metadata } from "next";
import { Playground } from "./Playground";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Playground</h1>
      <p className="mt-3 mb-6 max-w-2xl text-muted">
        A small simulated cluster with a Deployment called <code className="font-mono">web</code> and a standalone Pod
        called <code className="font-mono">toolbox</code>. Try deleting each Pod and compare what happens. Reloading the
        page resets everything.
      </p>
      <Playground />
    </>
  );
}
