import { createContext, useContext, type ReactNode } from "react";

import { useInitialPlan } from "./useInitialPlan";

export type CoachFlow = ReturnType<typeof useInitialPlan>;

const CoachFlowContext = createContext<CoachFlow | null>(null);

export function CoachFlowProvider({ children }: { children: ReactNode }) {
  const flow = useInitialPlan();
  return (
    <CoachFlowContext.Provider value={flow}>
      {children}
    </CoachFlowContext.Provider>
  );
}

export function useCoachFlow() {
  const flow = useContext(CoachFlowContext);
  if (!flow) {
    throw new Error("useCoachFlow must be used inside CoachFlowProvider");
  }
  return flow;
}
