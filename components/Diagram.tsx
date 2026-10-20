import { diagrams } from "@/content/chapters";
import { DiagramView } from "./DiagramView";

// Server component: only this diagram is sent to the browser.
export function Diagram({ id }: { id: string }) {
  const def = diagrams[id];
  if (!def) throw new Error(`Unknown diagram "${id}"`);
  return <DiagramView def={def} />;
}
