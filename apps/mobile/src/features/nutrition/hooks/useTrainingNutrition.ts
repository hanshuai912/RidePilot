import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { z } from "zod";
import type {
  NutritionItemDraft,
  NutritionProfileInput,
  NutritionProfileResponse,
  NutritionProposalResponse,
  TrainingNutritionState,
} from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../../profile/services/profile.api";
import { addDays, localDateInTimezone } from "../../coach/model/plan-dates";
import { NutritionApiError, nutritionApi } from "../services/nutrition.api";
import { waitForNutritionProposal } from "../services/generation-task";

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : "读取训练补给失败，请重试";

export function useTrainingNutrition(initialFrom?: string, initialTo?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [state, setState] = useState<TrainingNutritionState | null>(null);
  const [profile, setProfile] = useState<NutritionProfileResponse | null>(null);
  const [proposal, setProposal] = useState<NutritionProposalResponse | null>(
    null,
  );
  const [range, setRange] = useState({
    from: initialFrom ?? "",
    to: initialTo ?? "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);
  const pending = useRef(false);
  const activeRange = useRef<{ from: string; to: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current += 1;
    };
  }, []);

  const read = useCallback(
    async (selected?: { from: string; to: string }) => {
      if (!token) throw new Error("请先登录");
      let requested = selected ?? activeRange.current;
      if (!requested) {
        const account = await getProfile(token);
        const from =
          initialFrom ?? localDateInTimezone(new Date(), account.timezone);
        requested = { from, to: initialTo ?? addDays(from, 6) };
      }
      if (
        !z.iso.date().safeParse(requested.from).success ||
        !z.iso.date().safeParse(requested.to).success
      )
        throw new Error("请输入有效日期（YYYY-MM-DD）");
      const days =
        (Date.parse(requested.to) - Date.parse(requested.from)) / 86400000 + 1;
      if (days < 1 || days > 31) throw new Error("请选择 1–31 天的日期范围");
      const [next, dietary] = await Promise.all([
        nutritionApi.trainingState(token, requested.from, requested.to),
        nutritionApi.getProfile(token).catch((cause: unknown) => {
          if (cause instanceof NutritionApiError && cause.status === 404)
            return null;
          throw cause;
        }),
      ]);
      if (!mounted.current) return null;
      activeRange.current = requested;
      setRange(requested);
      setState(next);
      setProfile(dietary);
      setProposal(next.proposal);
      return next;
    },
    [token, initialFrom, initialTo],
  );

  const run = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      if (mounted.current) setError(message(cause));
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setLoading(false);
        setStatus(null);
      }
    }
  }, []);

  const poll = useCallback(
    async (job: NonNullable<TrainingNutritionState["generation"]>) => {
      if (!token) return;
      const attempt = ++operation.current;
      const result = await waitForNutritionProposal(
        token,
        job,
        setStatus,
        () => mounted.current && operation.current === attempt,
      );
      if (result && mounted.current && operation.current === attempt)
        setProposal(result);
    },
    [token],
  );

  const refresh = useCallback(
    (selected?: { from: string; to: string }) =>
      run(async () => {
        const next = await read(selected);
        if (next?.generation && !next.proposal) await poll(next.generation);
      }),
    [run, read, poll],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        operation.current += 1;
      };
    }, [refresh]),
  );

  const generate = (force = false) =>
    run(async () => {
      if (!token) return;
      const next = await read(range);
      if (!next) return;
      const job = await nutritionApi.generate(token, {
        startDate: next.from,
        endDate: next.to,
        mode: "TRAINING_LINKED",
        expectedNutritionVersion: next.nutritionVersion,
        expectedTrainingPlanVersion: next.trainingPlanVersion,
        forceRegenerate: force,
      });
      setProposal(null);
      await poll(job);
    });

  const saveProfile = (input: NutritionProfileInput) =>
    run(async () => {
      if (!token) return;
      setProfile(await nutritionApi.saveProfile(token, input));
    });
  const edit = (index: number, item: NutritionItemDraft) =>
    run(async () => {
      if (!token || !proposal) return;
      setProposal(
        await nutritionApi.update(token, proposal.proposalId, {
          expectedProposalVersion: proposal.proposalVersion,
          draft: {
            ...proposal.draft,
            items: proposal.draft.items.map((entry, at) =>
              at === index ? item : entry,
            ),
          },
        }),
      );
    });
  const validate = () =>
    run(async () => {
      if (token && proposal)
        setProposal(await nutritionApi.validate(token, proposal.proposalId));
    });
  const apply = () =>
    run(async () => {
      if (!token || !proposal) return;
      await nutritionApi.apply(
        token,
        proposal.proposalId,
        proposal.baseNutritionVersion,
      );
      await read();
    });
  return {
    state,
    profile,
    proposal,
    range,
    setRange,
    loading,
    busy,
    status,
    error,
    refresh,
    generate,
    saveProfile,
    edit,
    validate,
    apply,
  };
}
