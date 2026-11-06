import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { planImpactReferenceSchema } from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { waitForGeneration } from "../../goals/services/wait-for-generation";
import { coachApi } from "../../coach/services/coach.api";
import { planImpactApi } from "../services/plan-impact.api";

export function usePlanImpact() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    return planImpactApi.preview(token);
  }, [token]);
  const resource = useTrainingResource(load);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  const mounted = useRef(true);
  const focused = useRef(false);
  const generation = useRef<{
    signature: string;
    key: string;
    jobId?: string;
  } | null>(null);
  const retry = resource.retry;
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      if (focused.current) retry();
      focused.current = true;
      return () => {
        active.current = false;
      };
    }, [retry]),
  );
  useEffect(() => {
    active.current = true;
    mounted.current = true;
    return () => {
      active.current = false;
      mounted.current = false;
    };
  }, []);
  const data = resource.data;
  const startDate = start || data?.localDate || "";
  const endDate =
    end ||
    (data
      ? new Date(Date.parse(data.localDate) + 13 * 86400000)
          .toISOString()
          .slice(0, 10)
      : "");
  const run = async (
    action: "KEEP" | "FTP_RECALCULATE" | "REPLAN",
    resumeId?: string,
  ) => {
    if (!token || !data || pending.current) return;
    pending.current = true;
    setBusy(true);
    setGenerating(action === "REPLAN");
    setError(null);
    setNotice(null);
    try {
      if (resumeId) {
        const job = await coachApi.generation(token, resumeId);
        const id = await waitForGeneration(token, job, () => active.current);
        if (id && active.current)
          router.push({
            pathname: "/goals/course-preview",
            params: { proposalId: id },
          });
        return;
      }
      const reference = planImpactReferenceSchema.safeParse({
        fingerprint: data.fingerprint,
        startDate,
        endDate,
      });
      if (
        !reference.success ||
        startDate < data.localDate ||
        endDate < startDate ||
        Date.parse(endDate) - Date.parse(startDate) > 83 * 86400000
      )
        throw new Error(
          "请选择今天或未来的有效日期，每次最多 84 天（YYYY-MM-DD）",
        );
      if (action === "REPLAN") {
        const signature = JSON.stringify(reference.data);
        if (generation.current?.signature !== signature)
          generation.current = {
            signature,
            key: `input-replan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          };
        const attempt = generation.current;
        const job =
          resumeId || attempt.jobId
            ? await coachApi.generation(token, resumeId || attempt.jobId!)
            : await planImpactApi.generate(token, reference.data, attempt.key);
        attempt.jobId = job.generationId;
        const id = await waitForGeneration(token, job, () => active.current);
        if (id && active.current)
          router.push({
            pathname: "/goals/course-preview",
            params: { proposalId: id },
          });
      } else {
        const result = await planImpactApi.decide(
          token,
          { ...reference.data, action },
          `input-${action}-${data.fingerprint}-${startDate}-${endDate}`,
        );
        if (!active.current) return;
        if (action === "KEEP") {
          setNotice("已保留所选范围的安排，课程继续按原功率依据执行。");
          retry();
        } else
          router.push({
            pathname: "/plans/input-impact-preview",
            params: { decisionId: result.id },
          });
      }
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "处理失败，请重试");
      if (e instanceof Error && e.message.startsWith("生成失败（"))
        generation.current = null;
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setGenerating(false);
        if (active.current) retry();
      }
    }
  };
  return {
    ...resource,
    busy,
    generating,
    actionError: error,
    notice,
    startDate,
    endDate,
    setStart,
    setEnd,
    run,
  };
}
