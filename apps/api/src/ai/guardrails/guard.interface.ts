import {
  InputGuardContext,
  OutputGuardContext,
  GuardResult,
} from "./guard.types";

export interface InputGuard {
  check(context: InputGuardContext): Promise<GuardResult>;
}

export interface OutputGuard {
  check(context: OutputGuardContext): Promise<GuardResult>;
}

export const AI_INPUT_GUARD = Symbol("AI_INPUT_GUARD");
export const AI_OUTPUT_GUARD = Symbol("AI_OUTPUT_GUARD");
