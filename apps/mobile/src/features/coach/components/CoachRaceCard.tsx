import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { coachApi } from "../services/coach.api";

const priorities = { A: "核心目标赛", B: "重要比赛", C: "训练型比赛" } as const;

export function CoachRaceCard({
  race,
  onPress,
}: {
  race: Awaited<ReturnType<typeof coachApi.races>>[number];
  onPress: () => void;
}) {
  const [year, month, day] = race.localDate.split("-");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`为${race.name}制定备赛计划`}
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-card border border-border bg-surface p-4 active:bg-surface-2"
    >
      <View className="min-w-[56px] items-center gap-1 border-r border-divider pr-4">
        <AppText variant="caption" className="text-secondary">
          {Number(month)} 月
        </AppText>
        <AppText variant="title" className="tabular-nums">
          {Number(day)}
        </AppText>
        <AppText variant="label" className="text-secondary">
          {year}
        </AppText>
      </View>
      <View className="min-w-0 flex-1 gap-2">
        <AppText
          variant="caption"
          style={{
            color: race.priority === "A" ? colors.brand : colors.textSecondary,
          }}
        >
          {priorities[race.priority]}
        </AppText>
        <AppText variant="card">{race.name}</AppText>
        <AppText variant="caption" className="text-secondary">
          {race.distanceKm} km ·{" "}
          {race.intent === "FINISH"
            ? "稳妥完赛"
            : race.intent === "PERFORMANCE"
              ? "追求表现"
              : race.intent === "TEST"
                ? "检验能力"
                : "以赛代练"}
        </AppText>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}
