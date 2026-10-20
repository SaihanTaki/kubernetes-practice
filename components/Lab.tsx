import { labs } from "@/content/chapters";
import { LabView } from "./LabView";

// Server component: looks the lab up here so only this lab is sent to the browser, not every chapter's data.
export function Lab({ id }: { id: string }) {
  const lab = labs.find((l) => l.id === id);
  if (!lab) throw new Error(`Unknown lab "${id}"`);
  return <LabView lab={lab} />;
}
