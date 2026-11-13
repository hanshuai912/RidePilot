import { View } from "react-native";
import { AppText, Spinner } from "../../../components/ui";

export function GenerationProgress({
  status,
  error,
}: {
  status: "QUEUED" | "RUNNING" | "FAILED" | "CANCELLED";
  error: string | null;
}) {
  const active = status === "QUEUED" || status === "RUNNING";
  const copy =
    status === "QUEUED"
      ? "请求已提交，正在等待生成"
      : status === "RUNNING"
        ? "正在生成并校验训练草稿"
        : status === "CANCELLED"
          ? "生成已取消，正式计划没有变化"
          : "生成失败，正式计划没有变化";
  return (
    <View className="items-center gap-4 py-8">
      {active ? (
        <Spinner
          accessibilityLabel={status === "QUEUED" ? "任务排队中" : "任务处理中"}
        />
      ) : null}
      <AppText
        variant="section"
        className="text-center"
        accessibilityLiveRegion="polite"
      >
        {copy}
      </AppText>
      {error ? (
        <AppText className="text-negative" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <AppText variant="caption" muted className="text-center">
        {active
          ? "完成后会进入草稿预览。确认应用前不会改动正式计划。"
          : "可以返回修改生成条件，或重新发起生成。"}
      </AppText>
    </View>
  );
}
