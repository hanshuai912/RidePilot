import { Pressable, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
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
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-x-2">
        <AppText variant="section">教练建议</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看全部建议与历史"
          onPress={onAll}
          className="min-h-11 justify-center active:opacity-70"
        >
          <AppText variant="body" className="text-secondary">
            全部建议 · {count} →
          </AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={generating ? "查看生成任务" : "继续预览建议"}
        onPress={generating ? onAll : onOpen}
        className="rounded-card border border-brand-subtle bg-surface p-4 active:bg-surface-2"
      >
        <View className="flex-row items-center gap-2">
          <AppText
            variant="label"
            className={
              item.status === "BLOCKED"
                ? "rounded-lg bg-surface-2 px-2 py-1 text-warning"
                : "rounded-lg bg-brand-subtle px-2 py-1 text-brand"
            }
          >
            {status}
            {generating ? "" : " · 草稿未应用"}
          </AppText>
        </View>
        <AppText variant="card" className="mt-3">
          {item.title}
        </AppText>
        <AppText variant="body" className="mt-1 text-secondary">
          {item.staleReason ?? item.summary}
        </AppText>
        <View className="mt-4 flex-row items-center justify-between gap-2 border-t border-divider pt-3">
          <AppText variant="body" className="text-brand">
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
