import { Injectable } from "@nestjs/common";
import { InputGuard, OutputGuard } from "./guard.interface";
import {
  GuardResult,
  InputGuardContext,
  OutputGuardContext,
} from "./guard.types";

@Injectable()
export class NoopGuardAdapter implements InputGuard, OutputGuard {
  async check(
    _context: InputGuardContext | OutputGuardContext,
  ): Promise<GuardResult> {
    return { decision: "ALLOW", reasonCode: "NOOP_GUARD" };
  }
}
