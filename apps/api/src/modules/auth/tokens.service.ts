import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env";

const issuer = "ridepilot";
const audience = "ridepilot-api";
export const accessLifetimeSeconds = 15 * 60;
export const refreshLifetimeSeconds = 30 * 24 * 60 * 60;

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  typ: z.enum(["access", "refresh"]),
  jti: z.uuid(),
});

export type TokenClaims = z.infer<typeof claimsSchema>;

@Injectable()
export class TokensService {
  constructor(private readonly jwt: JwtService) {}

  async issue(
    userId: string,
    sessionId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresInSeconds: number;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.sign(userId, sessionId, "access", accessLifetimeSeconds),
      this.sign(userId, sessionId, "refresh", refreshLifetimeSeconds),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresInSeconds: accessLifetimeSeconds,
    };
  }

  async verifyAccess(token: string): Promise<TokenClaims | null> {
    return this.verify(token, "access", env.JWT_ACCESS_SECRET);
  }

  async verifyRefresh(token: string): Promise<TokenClaims | null> {
    return this.verify(token, "refresh", env.JWT_REFRESH_SECRET);
  }

  hashRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private sign(
    userId: string,
    sessionId: string,
    type: "access" | "refresh",
    expiresIn: number,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, typ: type, jti: randomUUID() },
      {
        algorithm: "HS256",
        secret:
          type === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET,
        issuer,
        audience,
        expiresIn,
      },
    );
  }

  private async verify(
    token: string,
    type: "access" | "refresh",
    secret: string,
  ): Promise<TokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        algorithms: ["HS256"],
        secret,
        issuer,
        audience,
      });
      const claims = claimsSchema.safeParse(payload);
      return claims.success && claims.data.typ === type ? claims.data : null;
    } catch {
      return null;
    }
  }
}
