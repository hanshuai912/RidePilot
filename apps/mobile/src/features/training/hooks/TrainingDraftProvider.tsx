import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProposalResponse } from "@ridepilot/contracts";
import {
  emptyDraft,
  type Draft,
  type Workout,
  type TrainingDraftEntry,
} from "../model/training";
type DraftContextValue = {
  entries: Record<string, TrainingDraftEntry>;
  create: (date: string, hasFtp: boolean) => string;
  edit: (workout: Workout, hasFtp: boolean) => string;
  update: (id: string, draft: Draft) => void;
  saved: (id: string, proposal: ProposalResponse) => void;
  restore: (id: string, proposal: ProposalResponse, hasFtp: boolean) => void;
  remove: (id: string) => void;
};
const Context = createContext<DraftContextValue | null>(null);
let nextDraftId = 0;

export function TrainingDraftProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, TrainingDraftEntry>>(
    {},
  );
  const create = useCallback((date: string, hasFtp: boolean) => {
    const id = `local-${Date.now()}-${++nextDraftId}`;
    setEntries((all) => ({
      ...all,
      [id]: { draft: emptyDraft(date), hasFtp, dirty: false },
    }));
    return id;
  }, []);
  const edit = useCallback((workout: Workout, hasFtp: boolean) => {
    const id = `workout-${workout.id}`;
    setEntries((all) =>
      all[id]
        ? all
        : {
            ...all,
            [id]: {
              draft: {
                scheduledDate: workout.scheduledDate,
                title: workout.title,
                purpose: workout.purpose,
                segments: workout.segments,
                dayOrder: workout.dayOrder,
              },
              workoutId: workout.id,
              planVersion: workout.planVersion,
              hasFtp,
              dirty: false,
            },
          },
    );
    return id;
  }, []);
  const update = useCallback((id: string, draft: Draft) => {
    setEntries((all) =>
      all[id] ? { ...all, [id]: { ...all[id], draft, dirty: true } } : all,
    );
  }, []);
  const saved = useCallback((id: string, proposal: ProposalResponse) => {
    setEntries((all) =>
      all[id] ? { ...all, [id]: { ...all[id], proposal, dirty: false } } : all,
    );
  }, []);
  const restore = useCallback(
    (id: string, proposal: ProposalResponse, hasFtp: boolean) => {
      setEntries((all) =>
        all[id]
          ? all
          : {
              ...all,
              [id]: {
                draft: proposal.draftWorkout,
                workoutId: proposal.originalWorkout?.id,
                planVersion: proposal.basePlanVersion,
                proposal,
                hasFtp,
                dirty: false,
              },
            },
      );
    },
    [],
  );
  const remove = useCallback((id: string) => {
    setEntries((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ entries, create, edit, update, saved, restore, remove }),
    [entries, create, edit, update, saved, restore, remove],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTrainingDrafts() {
  const value = useContext(Context);
  if (!value) throw new Error("TrainingDraftProvider is required");
  return value;
}
