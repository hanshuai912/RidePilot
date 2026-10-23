import { AiOrchestratorService } from "../src/ai/ai-orchestrator.service";
import { AiService } from "../src/ai/ai.service";
import { AiException } from "../src/ai/exceptions/ai.exception";
import { InputGuard, OutputGuard } from "../src/ai/guardrails/guard.interface";
import { AiProvider } from "../src/ai/interfaces/ai-provider.interface";

const request = {
  messages: [{ role: "user" as const, content: "hello" }],
};

function createHarness() {
  const provider: jest.Mocked<AiProvider> = {
    generate: jest.fn(),
  };
  const inputGuard: jest.Mocked<InputGuard> = {
    check: jest.fn(),
  };
  const outputGuard: jest.Mocked<OutputGuard> = {
    check: jest.fn(),
  };
  const orchestrator = new AiOrchestratorService(
    provider,
    inputGuard,
    outputGuard,
  );
  return { provider, inputGuard, outputGuard, orchestrator };
}

describe("AI infrastructure", () => {
  it("exposes AiService through the orchestrator", async () => {
    const harness = createHarness();
    harness.inputGuard.check.mockResolvedValue({ decision: "ALLOW" });
    harness.provider.generate.mockResolvedValue({
      text: "hello back",
      model: "test-model",
    });
    harness.outputGuard.check.mockResolvedValue({ decision: "ALLOW" });
    const service = new AiService(harness.orchestrator);

    await expect(service.generate(request)).resolves.toMatchObject({
      text: "hello back",
      model: "test-model",
    });
    expect(harness.provider.generate).toHaveBeenCalledTimes(1);
  });

  it("does not call the provider when input is rejected", async () => {
    const harness = createHarness();
    harness.inputGuard.check.mockResolvedValue({
      decision: "REJECT",
      reasonCode: "PROMPT_INJECTION",
    });

    await expect(harness.orchestrator.generate(request)).rejects.toMatchObject({
      code: "AI_INPUT_REJECTED",
    });
    expect(harness.provider.generate).not.toHaveBeenCalled();
    expect(harness.outputGuard.check).not.toHaveBeenCalled();
  });

  it("does not return output when output guard is rejected", async () => {
    const harness = createHarness();
    harness.inputGuard.check.mockResolvedValue({ decision: "ALLOW" });
    harness.provider.generate.mockResolvedValue({
      text: "unsafe",
      model: "test-model",
    });
    harness.outputGuard.check.mockResolvedValue({
      decision: "REJECT",
      reasonCode: "SENSITIVE_OUTPUT",
    });

    await expect(harness.orchestrator.generate(request)).rejects.toMatchObject({
      code: "AI_OUTPUT_REJECTED",
    });
  });

  it.each([
    ["input", "AI_GUARD_FAILED"],
    ["output", "AI_GUARD_FAILED"],
  ])("fails closed when %s guard throws", async (stage, code) => {
    const harness = createHarness();
    if (stage === "input") {
      harness.inputGuard.check.mockRejectedValue(new Error("guard down"));
    } else {
      harness.inputGuard.check.mockResolvedValue({ decision: "ALLOW" });
      harness.provider.generate.mockResolvedValue({
        text: "ok",
        model: "test-model",
      });
      harness.outputGuard.check.mockRejectedValue(new Error("guard down"));
    }

    await expect(harness.orchestrator.generate(request)).rejects.toMatchObject({
      code,
    });
    if (stage === "input") {
      expect(harness.provider.generate).not.toHaveBeenCalled();
    }
  });

  it("treats REVIEW as a blocking decision", async () => {
    const harness = createHarness();
    harness.inputGuard.check.mockResolvedValue({ decision: "REVIEW" });

    await expect(harness.orchestrator.generate(request)).rejects.toMatchObject({
      code: "AI_GUARD_REVIEW_REQUIRED",
    });
    expect(harness.provider.generate).not.toHaveBeenCalled();
  });

  it("rejects invalid requests before running guards", async () => {
    const harness = createHarness();

    await expect(
      harness.orchestrator.generate({ messages: [] }),
    ).rejects.toBeInstanceOf(AiException);
    expect(harness.inputGuard.check).not.toHaveBeenCalled();
  });
});
