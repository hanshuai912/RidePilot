import { IntegrationCryptoService } from "../src/modules/integrations/integration-crypto.service";

describe("IntegrationCryptoService", () => {
  it("encrypts and decrypts provider secrets without exposing plaintext", () => {
    const crypto = new IntegrationCryptoService();
    const plaintext = "coros-access-token";
    const encrypted = crypto.encrypt(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(crypto.decrypt(encrypted)).toBe(plaintext);
    expect(crypto.hash("state")).toHaveLength(64);
  });
});
