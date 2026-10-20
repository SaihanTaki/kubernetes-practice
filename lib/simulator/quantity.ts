import type { ResourceList } from "./types";

const CPU_RE = /^(\d+m|\d+(\.\d{1,3})?|\.\d{1,3})$/;
const MEMORY_RE = /^(\d+(\.\d+)?)(Ki|Mi|Gi|Ti|k|M|G|T)?$/;
const UNITS: Record<string, number> = { "": 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12, Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40 };

export const QUANTITY_ERROR = "quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'";

/** Millicores, or null when invalid. */
export function parseCpu(q: string): number | null {
  if (!CPU_RE.test(q)) return null;
  return q.endsWith("m") ? Number(q.slice(0, -1)) : Math.round(Number(q) * 1000);
}

/** Bytes, or null when invalid. */
export function parseMemory(q: string): number | null {
  const m = q.match(MEMORY_RE);
  return m ? Math.round(Number(m[1]) * UNITS[m[3] ?? ""]) : null;
}

export type ResourceName = keyof ResourceList;

export const parseQuantity = (name: ResourceName, q: string) => (name === "cpu" ? parseCpu(q) : parseMemory(q));

export function formatCpu(millis: number): string {
  return millis % 1000 === 0 ? String(millis / 1000) : `${millis}m`;
}

export function formatMemory(bytes: number): string {
  if (bytes === 0) return "0";
  for (const unit of ["Ti", "Gi", "Mi", "Ki", "T", "G", "M", "k"]) {
    if (bytes % UNITS[unit] === 0) return `${bytes / UNITS[unit]}${unit}`;
  }
  return String(bytes);
}

export const formatQuantity = (name: ResourceName, n: number) => (name === "cpu" ? formatCpu(n) : formatMemory(n));

export const MI = 2 ** 20;
