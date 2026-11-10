import { watchGeneration } from "../src/infra/prisma/watch-generation";
import type { PrismaService } from "../src/infra/prisma/prisma.service";

describe("generation cancellation watcher", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    { status: "CANCELLED", attempts: 1 },
    { status: "RUNNING", attempts: 2 },
    null,
  ])("aborts an obsolete worker: %p", async (current) => {
    const findUnique = jest.fn().mockResolvedValue(current);
    const watch = watchGeneration(
      { aiGeneration: { findUnique } } as unknown as PrismaService,
      { id: "job", attempts: 1 },
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect(watch.signal.aborted).toBe(true);
    watch.stop();
    await jest.advanceTimersByTimeAsync(1000);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("retries transient read errors and preserves the current worker", async () => {
    const findUnique = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ status: "RUNNING", attempts: 1 })
      .mockResolvedValueOnce({ status: "CANCELLED", attempts: 1 });
    const watch = watchGeneration(
      { aiGeneration: { findUnique } } as unknown as PrismaService,
      { id: "job", attempts: 1 },
    );
    await jest.advanceTimersByTimeAsync(2000);
    expect(watch.signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1000);
    expect(watch.signal.aborted).toBe(true);
    watch.stop();
  });
});
