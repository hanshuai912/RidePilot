import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { GenerationCancelButton } from "../components/GenerationCancelButton";
import { useGenerationCancellation } from "../hooks/useGenerationCancellation";
import { coachApi } from "../services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { waitForCoachProposal } from "../services/generation-task";
import { waitForNutritionProposal } from "../../nutrition/services/generation-task";
import { waitForGeneration } from "../../goals/services/wait-for-generation";
import { GenerationCancelledError } from "../../../lib/generation-cancelled";

jest.mock("../services/coach.api", () => ({
  coachApi: {
    cancelGeneration: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
  },
}));
jest.mock("../../nutrition/services/nutrition.api", () => ({
  nutritionApi: {
    cancelGeneration: jest.fn(),
    generation: jest.fn(),
    proposal: jest.fn(),
  },
}));
const coach = jest.mocked(coachApi);
const food = jest.mocked(nutritionApi);
const job = {
  generationId: "00000000-0000-4000-8000-000000000001",
  status: "CANCELLED" as const,
  proposalId: null,
  errorCode: null,
  requestId: null,
};
beforeEach(() => jest.resetAllMocks());

it.each([false, true])(
  "sends one cancellation to the correct API and disables repeat taps (nutrition=%p)",
  async (nutrition) => {
    const { result } = await renderHook(() =>
      useGenerationCancellation("token", nutrition),
    );
    const api = nutrition ? food : coach;
    let finish!: (value: typeof job) => void;
    api.cancelGeneration.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await act(() => result.current.track(job));
    let pending!: Promise<void>;
    await act(() => {
      pending = result.current.cancel();
      void result.current.cancel();
    });
    expect(result.current.cancelling).toBe(true);
    expect(api.cancelGeneration).toHaveBeenCalledTimes(1);
    expect(api.cancelGeneration).toHaveBeenCalledWith(
      "token",
      job.generationId,
    );
    await act(async () => {
      finish(job);
      await pending;
    });
    expect(result.current.cancelled).toBe(true);
    await act(() => result.current.cancel());
    expect(api.cancelGeneration).toHaveBeenCalledTimes(1);
  },
);

it("shows cancellation failures and allows retry from the button", async () => {
  const { result } = await renderHook(() => useGenerationCancellation("token"));
  await act(() => result.current.track(job));
  coach.cancelGeneration
    .mockRejectedValueOnce(new Error("网络不可用，请重试"))
    .mockResolvedValueOnce(job);
  const view = await render(
    <GenerationCancelButton cancellation={result.current} />,
  );
  await fireEvent.press(screen.getByText("取消生成"));
  await waitFor(() => expect(coach.cancelGeneration).toHaveBeenCalledTimes(1));
  await view.rerender(<GenerationCancelButton cancellation={result.current} />);
  expect(screen.getByText("网络不可用，请重试")).toBeTruthy();
  await fireEvent.press(screen.getByText("取消生成"));
  await waitFor(() => expect(result.current.cancelled).toBe(true));
  await view.rerender(<GenerationCancelButton cancellation={result.current} />);
  expect(screen.getByText("已取消生成")).toBeTruthy();
});

it("stops every polling flow on cancellation without fetching or applying a draft", async () => {
  await expect(
    waitForCoachProposal("token", job, jest.fn(), () => true),
  ).rejects.toBeInstanceOf(GenerationCancelledError);
  await expect(
    waitForNutritionProposal("token", job, jest.fn(), () => true),
  ).rejects.toBeInstanceOf(GenerationCancelledError);
  await expect(
    waitForGeneration("token", job, () => true),
  ).rejects.toBeInstanceOf(GenerationCancelledError);
  expect(coach.generation).not.toHaveBeenCalled();
  expect(food.generation).not.toHaveBeenCalled();
  expect(coach.proposal).not.toHaveBeenCalled();
  expect(food.proposal).not.toHaveBeenCalled();
});
