import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";
import { RedisService } from "../src/infra/redis/redis.service";

jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn() }));

describe("Redis connection lifecycle", () => {
  let client: EventEmitter & {
    connect: jest.Mock;
    disconnect: jest.Mock;
  };
  let warning: jest.SpyInstance;

  beforeEach(() => {
    client = Object.assign(new EventEmitter(), {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    });
    jest.mocked(Redis).mockImplementation(() => client as unknown as Redis);
    warning = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it("handles connection errors without exposing credentials and stops reconnecting after failed startup", async () => {
    const error = Object.assign(new Error("redis://user:secret@localhost"), {
      code: "ECONNREFUSED",
    });
    client.connect.mockImplementation(async () => {
      client.emit("error", error);
      throw error;
    });
    const service = new RedisService();

    await expect(service.onModuleInit()).rejects.toThrow(
      "docker compose up -d --wait postgres redis",
    );
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("ECONNREFUSED"),
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret");
  });

  it("keeps handling runtime errors and disconnects when the app closes", async () => {
    const service = new RedisService();
    await service.onModuleInit();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(() =>
      client.emit("error", new Error("runtime disconnect")),
    ).not.toThrow();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("CONNECTION_ERROR"),
    );
    await service.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });
});
