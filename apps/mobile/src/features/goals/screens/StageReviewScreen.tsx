import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { StageReviewEvidenceCard } from "../components/StageReviewEvidenceCard";
import { StageReviewFollowups } from "../components/StageReviewFollowups";
import { StageReviewOverview } from "../components/StageReviewOverview";
import { StageReviewForm } from "../components/StageReviewForm";
import { StageReviewPlanner } from "../components/StageReviewPlanner";
import {
  StageReviewDecision,
  StageReviewSummary,
} from "../components/StageReviewSummary";
import { useStageReview } from "../hooks/useStageReview";
import { useStageReviewGeneration } from "../hooks/useStageReviewGeneration";

export function StageReviewScreen() {
  const { stageId = "" } = useLocalSearchParams<{ stageId?: string }>();
  const s = useStageReview(stageId);
  const g = useStageReviewGeneration(s.token, s.evidence);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const history =
    s.data?.history.filter((item) => item.id !== s.evidence?.id) ?? [];
  const showForm = editing || s.dirty || !s.evidence;
  return (
    <TrainingPage
      title="阶段复评"
      onBack={() =>
        s.preview
          ? s.cancelPreview()
          : router.canGoBack()
            ? router.back()
            : router.replace("/goals")
      }
      busy={busy}
      loading={s.loading}
      error={s.error}
      retry={s.retry}
    >
      {guard}
      {g.busy ? <GenerationCancelButton cancellation={g.cancellation} /> : null}
      {current ? (
        <View className="gap-6 py-3">
          <StageReviewOverview snapshot={current} />
          {s.preview ? (
            <View className="gap-4">
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <AppText variant="section">复评决定预览</AppText>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={s.cancelPreview}
                >
                  返回修改复评
                </Button>
              </View>
              <Card className="gap-4 p-5">
                <StageReviewDecision input={s.preview.input} />
                {current.criteria ? (
                  <View className="gap-1 border-t border-divider pt-4">
                    <AppText variant="caption" className="text-secondary">
                      阶段达成条件
                    </AppText>
                    <AppText>{current.criteria}</AppText>
                  </View>
                ) : null}
                <AppText variant="caption" className="text-secondary">
                  确认保存复评；阶段、FTP 与课程变更需另行确认。
                </AppText>
              </Card>
              <Button
                size="lg"
                loading={s.busy}
                disabled={busy}
                onPress={() =>
                  void s.confirm().then((confirmed) => {
                    if (confirmed) setEditing(false);
                  })
                }
              >
                确认保存复评
              </Button>
            </View>
          ) : showForm ? (
            <StageReviewForm flow={s} busy={busy} />
          ) : s.evidence ? (
            <StageReviewSummary
              evidence={s.evidence}
              saved={!!s.saved}
              busy={busy}
              onReview={() => setEditing(true)}
            />
          ) : null}
          {!s.preview && s.evidence ? (
            <>
              <StageReviewPlanner
                current={current}
                evidence={s.evidence}
                flow={g}
                canFollow={canFollow}
                dirty={s.dirty}
                busy={busy}
              />
              <StageReviewFollowups
                items={s.data?.followups ?? []}
                goalId={current.goalId}
                busy={busy || s.dirty}
                resume={(id, roadmap) => void g.resume(id, roadmap)}
                refresh={s.retry}
              />
              {history.length ? (
                <View className="gap-3">
                  <Button
                    variant="ghost"
                    accessibilityState={{ expanded: historyOpen }}
                    disabled={busy}
                    onPress={() => setHistoryOpen((v) => !v)}
                  >
                    {historyOpen
                      ? "收起历史复评"
                      : `历史复评 · ${history.length} 次`}
                  </Button>
                  {historyOpen
                    ? history.map((item) => (
                        <StageReviewEvidenceCard
                          key={item.id}
                          evidence={item}
                        />
                      ))
                    : null}
                </View>
              ) : null}
            </>
          ) : null}
          {s.actionError || g.error ? (
            <View className="gap-2">
              <AppText accessibilityRole="alert" className="text-negative">
                {s.actionError || g.error}
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                <Button variant="ghost" disabled={busy} onPress={s.retry}>
                  刷新阶段证据
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onPress={() => router.push("/(tabs)/coach/goal")}
                >
                  完善 FTP 与训练资料
                </Button>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </TrainingPage>
  );
}
