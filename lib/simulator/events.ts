import type { Cluster, ClusterEvent, Resource } from "./types";

// Keeps cloning the cluster per command cheap; real clusters also expire events (after 1h).
const MAX_EVENTS = 300;

/** Records an event on `r`, or bumps the count of an identical one, like the API server's event aggregation. */
export function recordEvent(c: Cluster, r: Resource, type: ClusterEvent["type"], reason: string, message: string, source: string) {
  const same = c.events.find((e) => e.uid === r.metadata.uid && e.reason === reason && e.message === message);
  if (same) {
    same.count++;
    same.lastSeen = c.clock;
    return;
  }
  // Node events live in the default namespace, as in a real cluster.
  const namespace = r.metadata.namespace || "default";
  c.events.push({ uid: r.metadata.uid, kind: r.kind, namespace, name: r.metadata.name, type, reason, message, source, count: 1, firstSeen: c.clock, lastSeen: c.clock });
  if (c.events.length > MAX_EVENTS) c.events.splice(0, c.events.length - MAX_EVENTS);
}

export const eventsOf = (c: Cluster, r: Resource) => c.events.filter((e) => e.uid === r.metadata.uid);
