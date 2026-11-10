import type { PrismaService } from "./prisma.service";

/** Observe persisted cancellation across API/worker processes. */
export function watchGeneration(
  prisma: PrismaService,
  job: { id: string; attempts: number },
) {
  const controller = new AbortController();
  let checking = false;
  const timer = setInterval(() => {
    if (checking || controller.signal.aborted) return;
    checking = true;
    void prisma.aiGeneration
      .findUnique({
        where: { id: job.id },
        select: { status: true, attempts: true },
      })
      .then((current) => {
        if (
          !current ||
          current.status !== "RUNNING" ||
          current.attempts !== job.attempts
        )
          controller.abort();
      })
      .catch(() => {
        // A transient read failure must not turn an active job into a failure.
        // The next tick retries; the provider still has its own timeout.
      })
      .finally(() => {
        checking = false;
      });
  }, 1_000);
  timer.unref();
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}
