import { View } from "react-native";
import { Flag } from "lucide-react-native";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { coachApi } from "../../coach/services/coach.api";

export function RaceTrainingContext({
  race,
}: {
  race: Awaited<ReturnType<typeof coachApi.race>>;
}) {
  return (
    <Card className="gap-3 border-brand-subtle p-5">
      <View className="flex-row items-center gap-2">
        <Flag size={16} color={colors.brand} />
        <AppText variant="caption" className="text-secondary">
          {race.priority === "A"
            ? "核心目标赛"
            : race.priority === "B"
              ? "重要比赛"
              : "训练型比赛"}
        </AppText>
      </View>
      <AppText variant="section">{race.name}</AppText>
      <AppText className="text-secondary">
        {race.localDate} · {race.distanceKm} km
      </AppText>
      <AppText variant="caption" className="text-secondary">
        {race.intent === "FINISH"
          ? "比赛目标：稳妥完赛"
          : race.intent === "PERFORMANCE"
            ? "比赛目标：追求表现"
            : race.intent === "TEST"
              ? "比赛目标：检验能力"
              : "比赛目标：以赛代练"}
      </AppText>
    </Card>
  );
}
