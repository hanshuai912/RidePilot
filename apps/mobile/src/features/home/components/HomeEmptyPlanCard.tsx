import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "../../../theme/colors";
import { AppText, Badge, Card } from "../../../components/ui";

export function HomeEmptyPlanCard() {
  return (
    <Card className="rounded-[20px] p-5">
      <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-brand-subtle">
        <CalendarDays color={colors.brand} size={22} strokeWidth={1.7} />
      </View>
      <Badge variant="brand">今日安排</Badge>
      <AppText variant="section" className="mt-3">
        尚无正式训练计划
      </AppText>
      <AppText className="mt-2 leading-6 text-secondary">
        完成训练档案和目标后，首页会展示你的正式训练安排。
      </AppText>
      <View className="mt-5 rounded-xl border border-divider bg-surface-2 p-3">
        <AppText variant="caption" muted>
          训练日历、课程和计划调整将在对应服务接入后显示。
        </AppText>
      </View>
    </Card>
  );
}
