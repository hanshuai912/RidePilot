jest.mock("../src/ai/config/ai.config", () => ({
  getAiConfig: () => ({
    provider: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    apiKey: "test-key",
    model: "deepseek-flash",
    timeoutMs: 1000,
    guardMode: "noop",
  }),
}));

import { OpenAiCompatibleProvider } from "../src/ai/providers/openai-compatible.provider";
import { AiException } from "../src/ai/exceptions/ai.exception";

function response(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  } as unknown as Response;
}

describe("OpenAiCompatibleProvider", () => {
  const fetchMock = jest.fn();
  const provider = new OpenAiCompatibleProvider();

  beforeAll(() => {
    global.fetch = fetchMock as typeof fetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("maps an OpenAI-compatible response and request", async () => {
    fetchMock.mockResolvedValue(
      response({
        model: "deepseek-flash",
        choices: [{ message: { content: "answer" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      }),
    );

    await expect(
      provider.generate({
        requestId: "request-1",
        messages: [{ role: "user", content: "question" }],
        temperature: 0.2,
        maxTokens: 128,
      }),
    ).resolves.toEqual({
      text: "answer",
      model: "deepseek-flash",
      finishReason: "stop",
      usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer test-key" }),
        body: JSON.stringify({
          model: "deepseek-flash",
          messages: [{ role: "user", content: "question" }],
          temperature: 0.2,
          max_tokens: 128,
        }),
      }),
    );
  });

  it("forwards a JSON response format when requested", async () => {
    fetchMock.mockResolvedValue(
      response({
        model: "deepseek-flash",
        choices: [{ message: { content: "{}" } }],
      }),
    );

    await provider.generate({
      messages: [{ role: "user", content: "question" }],
      responseFormat: { type: "json_object" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining('"response_format":{"type":"json_object"}'),
      }),
    );
  });

  it("maps an abort to a retryable timeout error", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    await expect(
      provider.generate({ messages: [{ role: "user", content: "question" }] }),
    ).rejects.toMatchObject<Partial<AiException>>({
      code: "AI_PROVIDER_TIMEOUT",
      retryable: true,
    });
  });

  it("maps a non-JSON upstream failure to a provider error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("upstream unavailable"),
    } as unknown as Response);

    await expect(
      provider.generate({ messages: [{ role: "user", content: "question" }] }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_FAILED",
      retryable: true,
    });
  });

  it("rejects a successful response without text content", async () => {
    fetchMock.mockResolvedValue(response({ choices: [] }));

    await expect(
      provider.generate({ messages: [{ role: "user", content: "question" }] }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_INVALID_RESPONSE",
      retryable: false,
    });
  });

  it("preserves a response-body timeout as a retryable timeout", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    } as unknown as Response);

    await expect(
      provider.generate({ messages: [{ role: "user", content: "question" }] }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_TIMEOUT",
      retryable: true,
    });
  });
});
