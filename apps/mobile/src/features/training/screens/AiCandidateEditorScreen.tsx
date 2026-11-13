import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  aiWorkoutDraftSchema,
  type AiProposalResponse,
} from "@ridepilot/contracts";
import { AppText, Button } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { Editor } from "../components/Editor";
import { InlineWorkoutSegmentEditor } from "../components/InlineWorkoutSegmentEditor";
import { FtpRequiredState } from "../components/FtpRequiredState";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { useTrainingResource } from "../hooks/useTrainingResource";
import { useUnsavedTraining } from "../hooks/useUnsavedTraining";
import type { Draft } from "../model/training";

export function AiCandidateEditorScreen() {
  const { proposalId = "", index = "0" } = useLocalSearchParams<{
    proposalId?: string;
    index?: string;
  }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const position = Number(index);
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    const [proposal, ftp] = await Promise.all([
      coachApi.proposal(token, proposalId),
      coachApi.ftp(token),
    ]);
    if (!["DRAFT", "READY", "BLOCKED"].includes(proposal.status))
      throw new Error("当前候选已应用或已失效，不能编辑");
    if (!Number.isInteger(position) || !proposal.workouts[position])
      throw new Error("候选课程不存在");
    return { proposal, hasFtp: !!ftp };
  }, [token, proposalId, position]);
  const resource = useTrainingResource(load);
  return (
    <TrainingPage
      title="局部编辑 AI 候选"
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
      onBack={backToTraining}
    >
      {resource.data && !resource.data.hasFtp ? (
        <FtpRequiredState />
      ) : resource.data ? (
        <CandidateEditor
          key={`${resource.data.proposal.proposalId}-${resource.data.proposal.proposalVersion}`}
          proposal={resource.data.proposal}
          position={position}
          token={token!}
          hasFtp={resource.data.hasFtp}
          reload={resource.retry}
        />
      ) : null}
    </TrainingPage>
  );
}

function CandidateEditor({
  proposal: base,
  position,
  token,
  hasFtp,
  reload,
}: {
  proposal: AiProposalResponse;
  position: number;
  token: string;
  hasFtp: boolean;
  reload: () => void;
}) {
  const proposalId = base.proposalId;
  const [draft, setDraft] = useState<Draft>(base.workouts[position]);
  const [segment, setSegment] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (saved)
      router.replace({
        pathname: "/(tabs)/coach/suggestion",
        params: { id: proposalId, kind: "TRAINING" },
      });
  }, [saved, proposalId]);
  const guard = useUnsavedTraining(
    dirty,
    "候选修改尚未保存，返回将放弃本次局部编辑。",
    busy,
  );
  const update = (value: Draft) => {
    setDraft(value);
    setDirty(true);
  };
  const save = async () => {
    if (!token || !base || !draft || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = aiWorkoutDraftSchema.safeParse(draft);
      if (!result.success)
        throw new Error("请填写课程名称、训练目的和有效动作（最多 50 个）");
      await coachApi.updateProposal(token, proposalId, {
        expectedProposalVersion: base.proposalVersion,
        draft: {
          summary: base.summary,
          stageSummary: base.stageSummary,
          assessmentSuggestion: base.assessmentSuggestion,
          workouts: base.workouts.map((w, i) =>
            i === position ? result.data : w,
          ),
        },
      });
      setDirty(false);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存草稿失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {guard}
      <AppText muted>
        仅保存候选草稿。保存后需重新预览、校验并确认应用；其他候选课程保留。
      </AppText>
      {draft && segment !== null ? (
        <InlineWorkoutSegmentEditor
          key={segment}
          initial={draft.segments[segment]}
          hasFtp={hasFtp}
          onBack={() => setSegment(null)}
          onSave={(value) => {
            const segments = [...draft.segments];
            segments[segment] = value;
            update({ ...draft, segments });
            setSegment(null);
          }}
        />
      ) : draft ? (
        <Editor
          draft={draft}
          setDraft={update}
          hasFtp={hasFtp}
          feedback={error}
          busy={busy}
          onBack={backToTraining}
          onAdd={() => setSegment(draft.segments.length)}
          onEdit={setSegment}
          onDelete={(i) =>
            update({
              ...draft,
              segments: draft.segments.filter((_, n) => n !== i),
            })
          }
          onSave={() => void save()}
          saveLabel="保存草稿并预览"
          metadataRequired
        />
      ) : null}
      {error ? (
        <Button variant="secondary" onPress={reload}>
          重新读取候选（放弃当前修改）
        </Button>
      ) : null}
    </>
  );
}
