import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  authResponseSchema,
} from "@ridepilot/contracts";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { Prisma } from "../../generated/prisma/client";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthRepository } from "./auth.repository";
import { AuthPrincipal } from "./auth.types";
import { PasswordService } from "./password.service";
import { refreshLifetimeSeconds, TokensService } from "./tokens.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  async register(input: RegisterRequest, ip: string): Promise<AuthResponse> {
    if (!env.AUTH_TEST_CODE_ENABLED) {
      throw new ServiceUnavailableException({
        code: "TEST_REGISTRATION_DISABLED",
        message: "测试验证码注册暂不可用",
      });
    }

    await this.rateLimit.check("register", input.phone, ip);

    const userId = randomUUID();
    const sessionId = randomUUID();
    const [passwordHash, tokens] = await Promise.all([
      this.passwords.hash(input.password),
      this.tokens.issue(userId, sessionId),
    ]);

    try {
      await this.repository.createAccount({
        userId,
        sessionId,
        phone: input.phone,
        passwordHash,
        refreshTokenHash: this.tokens.hashRefresh(tokens.refreshToken),
        sessionExpiresAt: this.refreshExpiry(),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "PHONE_ALREADY_REGISTERED",
          message: "该手机号已注册",
        });
      }
      throw error;
    }

    return authResponseSchema.parse({
      user: { id: userId, phone: input.phone, phoneVerified: false },
      tokens,
    });
  }

  async login(input: LoginRequest, ip: string): Promise<AuthResponse> {
    await this.rateLimit.check("login", input.phone, ip);
    const credential = await this.repository.findByPhone(input.phone);
    const passwordMatches = await this.passwords.verify(
      input.password,
      credential?.passwordHash,
    );

    if (
      !credential ||
      !passwordMatches ||
      credential.user.status !== "ACTIVE"
    ) {
      throw this.invalidCredentials();
    }

    const sessionId = randomUUID();
    const tokens = await this.tokens.issue(credential.userId, sessionId);
    await this.repository.createSession({
      userId: credential.userId,
      sessionId,
      refreshTokenHash: this.tokens.hashRefresh(tokens.refreshToken),
      expiresAt: this.refreshExpiry(),
    });

    return authResponseSchema.parse({
      user: {
        id: credential.userId,
        phone: credential.loginIdentifier,
        phoneVerified: credential.verificationStatus === "VERIFIED",
      },
      tokens,
    });
  }

  async refresh(input: RefreshRequest, ip: string): Promise<AuthResponse> {
    await this.rateLimit.check("refresh", input.refreshToken, ip);
    const claims = await this.tokens.verifyRefresh(input.refreshToken);
    if (!claims) {
      throw this.invalidSession();
    }

    const session = await this.repository.findSession(claims.sid);
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      throw this.invalidSession();
    }

    const credential = await this.repository.findPhoneByUserId(claims.sub);
    if (!credential) {
      throw this.invalidSession();
    }

    const tokens = await this.tokens.issue(claims.sub, claims.sid);
    const rotated = await this.repository.rotateSession({
      userId: claims.sub,
      sessionId: claims.sid,
      oldTokenHash: this.tokens.hashRefresh(input.refreshToken),
      newTokenHash: this.tokens.hashRefresh(tokens.refreshToken),
      expiresAt: this.refreshExpiry(),
    });
    if (!rotated) {
      throw this.invalidSession();
    }

    return authResponseSchema.parse({
      user: {
        id: session.userId,
        phone: credential.loginIdentifier,
        phoneVerified: credential.verificationStatus === "VERIFIED",
      },
      tokens,
    });
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    await this.repository.revokeSession(principal.userId, principal.sessionId);
  }

  async authenticateAccess(token: string): Promise<AuthPrincipal | null> {
    const claims = await this.tokens.verifyAccess(token);
    if (!claims) {
      return null;
    }

    const session = await this.repository.findSession(claims.sid);
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      return null;
    }

    return { userId: claims.sub, sessionId: claims.sid };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + refreshLifetimeSeconds * 1000);
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: "INVALID_CREDENTIALS",
      message: "手机号或密码错误",
    });
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException({
      code: "INVALID_SESSION",
      message: "会话无效或已过期",
    });
  }
}
