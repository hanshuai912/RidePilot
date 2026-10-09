import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../common/public.decorator";
import { AuthService } from "./auth.service";
import { AuthPrincipal } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthPrincipal;
    }>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? "",
    );
    const principal = match
      ? await this.auth.authenticateAccess(match[1])
      : null;

    if (!principal) {
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "需要登录",
      });
    }

    request.user = principal;
    return true;
  }
}
