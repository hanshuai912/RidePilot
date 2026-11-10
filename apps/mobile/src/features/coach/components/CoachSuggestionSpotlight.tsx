import { Pressable, View } from "react-native";
import { ArrowRight, Sparkles } from "lucide-react-native";
import type { CoachSuggestion } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function CoachSuggestionSpotlight({
  item,
  status,
  count,
  onOpen,
  onAll,
}: {
  item: CoachSuggestion;
  status: string;
  count: number;
  onOpen: () => void;
  onAll: () => void;
}) {
  const generating = item.kind === "GENERATION";
  return (
    <View testID="coach-pending-suggestions">
      <View className="mb-2 flex-row flex-wrap items-center justify-between gap-x-2">
        <View className="flex-row items-center gap-2">
          <Sparkles color={colors.brand} size={18} />
          <AppText variant="section">教练建议</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看全部建议与历史"
          onPress={onAll}
          className="min-h-11 justify-center active:opacity-70"
        >
          <AppText variant="caption" className="text-secondary">
            全部建议 · {count} →
          </AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={generating ? "查看生成任务" : "继续预览建议"}
        onPress={generating ? onAll : onOpen}
        className="rounded-xl border-l-2 border-brand bg-surface px-4 py-3 active:bg-surface-2"
      >
        <View className="flex-row items-center gap-2">
          <AppText
            variant="label"
            className={
              item.status === "BLOCKED" ? "text-warning" : "text-brand"
            }
          >
            {status}
            {generating ? "" : " · 草稿未应用"}
          </AppText>
        </View>
        <AppText variant="card" className="mt-2" numberOfLines={2}>
          {item.title}
        </AppText>
        <AppText
          variant="caption"
          className="mt-1 text-secondary"
          numberOfLines={2}
        >
          {item.staleReason ?? item.summary}
        </AppText>
        <View className="mt-3 flex-row items-center gap-2">
          <AppText variant="caption" className="text-brand">
            {generating
              ? "查看进度"
              : item.status === "BLOCKED"
                ? "查看并调整"
                : "预览建议"}
          </AppText>
          <ArrowRight color={colors.brand} size={15} />
        </View>
      </Pressable>
    </View>
  );
}
