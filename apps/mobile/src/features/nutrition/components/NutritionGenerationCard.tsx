import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import type { useGenerationCancellation } from "../../coach/hooks/useGenerationCancellation";

export function NutritionGenerationCard({
  generating,
  status,
  hasPlan,
  hasDraft,
  disabled,
  onGenerate,
  cancellation,
}: {
  generating: boolean;
  status: "QUEUED" | "RUNNING" | null;
  hasPlan: boolean;
  hasDraft: boolean;
  disabled: boolean;
  onGenerate: () => void;
  cancellation: ReturnType<typeof useGenerationCancellation>;
}) {
  return (
    <Card className="gap-3 p-4">
      <AppText variant="card">
        {hasDraft
          ? "已有待确认草稿"
          : hasPlan
            ? "调整今日饮食"
            : "安排今日饮食"}
      </AppText>
      <AppText variant="caption" muted>
        {hasDraft
          ? "先核对上方草稿。重新生成会替换当前展示的草稿。"
          : "结合饮食档案和训练安排生成建议，预览并确认后才会更新正式计划。"}
      </AppText>
      <Button
        variant={hasPlan || hasDraft ? "secondary" : "primary"}
        loading={generating}
        disabled={disabled}
        onPress={onGenerate}
      >
        {status === "RUNNING" ? "正在生成营养草稿" : "生成今日营养草稿"}
      </Button>
      {generating ? (
        <GenerationCancelButton cancellation={cancellation} />
      ) : null}
      {status ? (
        <View accessibilityLiveRegion="polite">
          <AppText variant="caption" muted>
            {status === "QUEUED" ? "任务排队中" : "AI 生成与安全校验中"}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}
