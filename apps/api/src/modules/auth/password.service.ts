import { Injectable } from "@nestjs/common";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const cost = 1 << 17;
const blockSize = 8;
const parallelization = 1;
const keyLength = 64;
const maxmem = 256 * 1024 * 1024;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const digest = await this.derive(password, salt);
    return `scrypt$v1$${cost}$${blockSize}$${parallelization}$${salt.toString("hex")}$${digest.toString("hex")}`;
  }

  async verify(password: string, storedHash?: string): Promise<boolean> {
    const parts = storedHash?.split("$");
    const valid =
      parts?.length === 7 &&
      parts[0] === "scrypt" &&
      parts[1] === "v1" &&
      parts[2] === String(cost) &&
      parts[3] === String(blockSize) &&
      parts[4] === String(parallelization) &&
      /^[a-f0-9]{32}$/.test(parts[5]) &&
      /^[a-f0-9]{128}$/.test(parts[6]);

    const salt = valid ? Buffer.from(parts[5], "hex") : Buffer.alloc(16);
    const expected = valid
      ? Buffer.from(parts[6], "hex")
      : Buffer.alloc(keyLength);
    const actual = await this.derive(password, salt);
    return valid && timingSafeEqual(actual, expected);
  }

  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scryptCallback(
        password,
        salt,
        keyLength,
        { N: cost, r: blockSize, p: parallelization, maxmem },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        },
      );
    });
  }
}
