import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import type { Assessment } from "@ridepilot/contracts";
import { AppText, Badge } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { assessmentKinds, assessmentStatuses } from "../model/assessment";

export function AssessmentList({
  items,
  empty = "尚未安排阶段测试",
}: {
  items: Assessment[];
  empty?: string;
}) {
  return items.length ? (
    <>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`查看测试：${assessmentKinds[item.kind]}，${item.localDate}，${item.protocol}，${assessmentStatuses[item.status]}`}
          onPress={() =>
            router.push({
              pathname: "/assessments/[assessmentId]",
              params: { assessmentId: item.id },
            })
          }
          className="min-h-11 flex-row items-center gap-3 rounded-card border border-border bg-surface p-4 active:bg-surface-2"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <AppText variant="card">{assessmentKinds[item.kind]}</AppText>
              <Badge variant="neutral">{assessmentStatuses[item.status]}</Badge>
            </View>
            <AppText variant="caption" className="tabular-nums text-secondary">
              {item.localDate}
            </AppText>
            <AppText className="text-secondary">{item.protocol}</AppText>
          </View>
          <ChevronRight color={colors.textSecondary} size={18} />
        </Pressable>
      ))}
    </>
  ) : (
    <AppText muted>{empty}</AppText>
  );
}
