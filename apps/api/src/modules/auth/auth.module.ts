import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { InfraModule } from "../../infra/infra.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { TokensService } from "./tokens.service";

@Module({
  imports: [InfraModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    PasswordService,
    TokensService,
    AuthRateLimitService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
