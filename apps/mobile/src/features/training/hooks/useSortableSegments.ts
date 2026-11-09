import { useMemo, useState } from "react";
import type { WorkoutSegment } from "@ridepilot/contracts";

export function useSortableSegments(segments: WorkoutSegment[]) {
  const [keyFor] = useState(() => {
    const keys = new WeakMap<WorkoutSegment, string>();
    let sequence = 0;
    return (segment: WorkoutSegment) => {
      let key = keys.get(segment);
      if (!key) {
        key = `segment-${++sequence}`;
        keys.set(segment, key);
      }
      return key;
    };
  });
  return useMemo(() => {
    const occurrences = new Map<string, number>();
    return segments.map((segment) => {
      const key = keyFor(segment);
      const occurrence = occurrences.get(key) ?? 0;
      occurrences.set(key, occurrence + 1);
      // UI keys stay attached to each occurrence; never write IDs into drafts.
      return { key: `${key}-${occurrence}`, segment };
    });
  }, [segments, keyFor]);
}
