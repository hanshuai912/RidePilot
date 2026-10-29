import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { env } from "../../config/env";

@Injectable()
export class IntegrationCryptoService {
  private readonly key = createHash("sha256")
    .update(env.MCP_TOKEN_ENCRYPTION_KEY ?? randomBytes(32))
    .digest();

  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, ciphertext]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  decrypt(value: string): string {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
      throw new Error("Invalid encrypted integration secret");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
