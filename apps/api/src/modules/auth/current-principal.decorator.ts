import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthPrincipal } from "./auth.types";

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    return context.switchToHttp().getRequest<{ user: AuthPrincipal }>().user;
  },
);
