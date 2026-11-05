import { useCallback, useRef, useState } from "react";
import type {
  AiProposalResponse,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { coachApi } from "../services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { useCoachResource } from "./useCoachResource";

type Draft =
  | { kind: "TRAINING"; proposal: AiProposalResponse }
  | { kind: "NUTRITION"; proposal: NutritionProposalResponse };

export function useCoachSuggestion(
  token: string | undefined,
  id: string,
  kind: string,
) {
  const [checked, setChecked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affectedDates, setAffectedDates] = useState<string[]>([]);
  const pending = useRef(false);
  const load = useCallback(async (): Promise<Draft> => {
    setChecked(false);
    setConfirm(false);
    if (!token) throw new Error("请先登录");
    if (!id || !["TRAINING", "NUTRITION"].includes(kind))
      throw new Error("建议链接无效，请返回建议列表");
    return kind === "TRAINING"
      ? { kind, proposal: await coachApi.proposal(token, id) }
      : { kind: "NUTRITION", proposal: await nutritionApi.proposal(token, id) };
  }, [token, id, kind]);
  const resource = useCoachResource(load);
  const { data, setData } = resource;
  const run = async (apply: boolean) => {
    if (!token || !data || pending.current || (apply && (!checked || !confirm)))
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (apply) {
        const result =
          data.kind === "TRAINING"
            ? await coachApi.apply(
                token,
                id,
                data.proposal.basePlanVersion,
                `coach-apply-${id}-${data.proposal.proposalVersion}`,
                data.proposal.proposalVersion,
              )
            : await nutritionApi.apply(
                token,
                id,
                data.proposal.baseNutritionVersion,
                data.proposal.proposalVersion,
              );
        setData({
          ...data,
          proposal: { ...data.proposal, status: "APPLIED" },
        } as Draft);
        setAffectedDates(result.affectedDates);
        setConfirm(false);
      } else {
        const result: Draft =
          data.kind === "TRAINING"
            ? { kind: "TRAINING", proposal: await coachApi.validate(token, id) }
            : {
                kind: "NUTRITION",
                proposal: await nutritionApi.validate(token, id),
              };
        setData(result);
        setChecked(result.proposal.status === "READY");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建议处理失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return {
    ...resource,
    checked,
    confirm,
    setConfirm,
    busy,
    actionError: error,
    affectedDates,
    validate: () => run(false),
    apply: () => run(true),
  };
}
