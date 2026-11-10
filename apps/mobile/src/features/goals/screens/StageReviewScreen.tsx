import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { StageReviewInput } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { ChoicePill } from "../../coach/components/CoachPage";
import {
  StageReviewEvidenceCard,
  StageReviewFacts,
} from "../components/StageReviewEvidenceCard";
import { StageReviewFollowups } from "../components/StageReviewFollowups";
import { useStageReview } from "../hooks/useStageReview";
import { useStageReviewGeneration } from "../hooks/useStageReviewGeneration";
import { outcomeLabels, decisionLabels } from "../model/goal-lifecycle";

export function StageReviewScreen() {
  const { stageId = "" } = useLocalSearchParams<{ stageId?: string }>();
  const s = useStageReview(stageId);
  const g = useStageReviewGeneration(s.token, s.evidence);
  const busy = s.busy || g.busy;
  const guard = useUnsavedTraining(
    s.dirty,
    "离开将放弃尚未确认的复评内容，确认离开？",
    busy,
  );
  const current = s.data?.snapshot;
  const canFollow =
    !!current &&
    !!s.evidence &&
    current.fingerprint === s.evidence.snapshot.fingerprint &&
    s.data?.history[0]?.id === s.evidence.id &&
    current.goalStatus === "ACTIVE";
  return (
    <TrainingPage
      title="阶段复评"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/goals")
      }
      busy={busy}
      loading={s.loading}
      error={s.error}
      retry={s.retry}
    >
      {guard}
      {g.busy ? <GenerationCancelButton cancellation={g.cancellation} /> : null}
      {current ? (
        <>
          <Card>
            <AppText variant="section">当前事实与达成条件</AppText>
            <StageReviewFacts snapshot={current} />
          </Card>
          {!s.preview ? (
            <>
              <Input
                accessibilityLabel="阶段达成条件"
                value={s.criteria}
                onChangeText={s.setCriteria}
                maxLength={300}
                multiline
                editable={!busy}
                placeholder="填写可观察、可核对的阶段达成条件"
              />
              <Button
                variant="secondary"
                disabled={busy}
                onPress={() => void s.saveCriteria()}
              >
                保存达成条件
              </Button>
              <AppText variant="section">本次结论</AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.keys(outcomeLabels) as StageReviewInput["outcome"][]
                ).map((v) => (
                  <ChoicePill
                    key={v}
                    label={outcomeLabels[v]}
                    selected={s.outcome === v}
                    onPress={() => {
                      if (!busy) s.setOutcome(v);
                    }}
                  />
                ))}
              </View>
              <AppText variant="section">选择下一步</AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.keys(decisionLabels) as StageReviewInput["decision"][]
                ).map((v) => (
                  <ChoicePill
                    key={v}
                    label={decisionLabels[v]}
                    selected={s.decision === v}
                    onPress={() => {
                      if (!busy) s.setDecision(v);
                    }}
                  />
                ))}
              </View>
              <Input
                accessibilityLabel="复评理由与证据"
                value={s.rationale}
                onChangeText={s.setRationale}
                maxLength={500}
                multiline
                editable={!busy}
                placeholder="说明判断依据与选择理由，证据不足也可记录"
              />
              <Button disabled={busy} onPress={() => void s.prepare()}>
                预览本次复评决定
              </Button>
            </>
          ) : (
            <Card>
              <AppText variant="section">复评决定预览</AppText>
              <AppText className="mt-2">
                {outcomeLabels[s.preview.input.outcome]} ·{" "}
                {decisionLabels[s.preview.input.decision]}
              </AppText>
              <AppText className="mt-2">{s.preview.input.rationale}</AppText>
              <AppText muted className="mt-2">
                确认将保存以上事实、条件与选择。阶段、FTP
                和正式课程需另行确认变更。
              </AppText>
              <Button loading={busy} onPress={() => void s.confirm()}>
                确认保存复评
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onPress={s.cancelPreview}
              >
                返回修改复评
              </Button>
            </Card>
          )}
          {s.saved ? (
            <AppText className="text-positive">
              阶段复评已保存，请主动选择下方后续操作
            </AppText>
          ) : null}
          {s.evidence ? (
            <>
              <StageReviewEvidenceCard evidence={s.evidence} />
              <Card>
                <AppText variant="section">根据最近复评规划后续</AppText>
                {!canFollow ? (
                  <AppText className="text-warning">
                    复评依据已变化或目标未激活，请刷新并重新复评；到期目标可先延期。
                  </AppText>
                ) : null}
                {s.evidence.decision === "EXTEND" ||
                s.evidence.decision === "ADJUST" ? (
                  <>
                    <AppText muted>
                      阶段草稿 1–365 天；按日期课程 1–84 天。均须在目标期限内。
                    </AppText>
                    <Input
                      accessibilityLabel="复评后开始日期"
                      value={g.startDate}
                      onChangeText={g.setStartDate}
                      editable={!busy}
                    />
                    <Input
                      accessibilityLabel="复评后结束日期"
                      value={g.endDate}
                      onChangeText={g.setEndDate}
                      editable={!busy}
                    />
                    <Button
                      disabled={busy || !canFollow || s.dirty}
                      onPress={() => void g.generate(true)}
                    >
                      生成阶段调整草稿
                    </Button>
                  </>
                ) : null}
                {current.endDate < current.localDate ? (
                  <AppText muted>
                    阶段日程已结束，后续可选择延长或调整；进入下一阶段需要仍有效的后续日期。
                  </AppText>
                ) : null}
                {s.evidence.decision !== "EXTEND" ? (
                  <Button
                    disabled={
                      busy ||
                      !canFollow ||
                      current.stale ||
                      s.dirty ||
                      (s.evidence.decision === "KEEP" &&
                        current.endDate < current.localDate)
                    }
                    onPress={() => void g.generate(false)}
                  >
                    {s.evidence.decision === "NEXT"
                      ? "生成下一阶段课程草稿"
                      : "生成后续课程草稿"}
                  </Button>
                ) : (
                  <AppText muted>
                    请先确认新的阶段安排，再从目标详情生成课程。
                  </AppText>
                )}
                <Button
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    router.push({
                      pathname: "/goals/manage",
                      params: { goalId: current.goalId },
                    })
                  }
                >
                  管理目标 / 延期
                </Button>
              </Card>
            </>
          ) : null}
          <StageReviewFollowups
            items={s.data?.followups ?? []}
            goalId={current.goalId}
            busy={busy || s.dirty}
            resume={(id, roadmap) => void g.resume(id, roadmap)}
            refresh={s.retry}
          />
          {s
            .data!.history.slice(
              s.evidence?.id === s.data!.history[0]?.id ? 1 : 0,
            )
            .map((h) => (
              <StageReviewEvidenceCard key={h.id} evidence={h} />
            ))}
        </>
      ) : null}
      {s.actionError || g.error ? (
        <>
          <AppText className="text-negative">
            {s.actionError || g.error}
          </AppText>
          <Button variant="secondary" disabled={busy} onPress={s.retry}>
            刷新阶段证据
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => router.push("/(tabs)/coach/goal")}
          >
            完善 FTP 与训练资料
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
