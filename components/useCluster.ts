"use client";

import { useCallback, useRef, useState } from "react";
import { createCluster, run, type Fixture } from "@/lib/simulator";

/** Temporary in-memory cluster for one exercise. Nothing is persisted. */
export function useCluster(fixture: Fixture) {
  const [cluster, setCluster] = useState(() => createCluster(fixture));
  const [epoch, setEpoch] = useState(0);
  // The terminal needs each result synchronously, before React re-renders.
  const ref = useRef(cluster);

  const execute = useCallback((command: string) => {
    const result = run(ref.current, command);
    ref.current = result.cluster;
    setCluster(result.cluster);
    return result;
  }, []);

  const reset = useCallback(() => {
    ref.current = createCluster(fixture);
    setCluster(ref.current);
    setEpoch((e) => e + 1);
  }, [fixture]);

  return { cluster, execute, reset, epoch };
}
