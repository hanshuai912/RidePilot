import { Module } from "@nestjs/common";
import { InfraModule } from "../../infra/infra.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationCryptoService } from "./integration-crypto.service";
import { IntegrationsService } from "./integrations.service";

@Module({
  imports: [InfraModule],
  controllers: [IntegrationsController],
  providers: [IntegrationCryptoService, IntegrationsService],
})
export class IntegrationsModule {}
