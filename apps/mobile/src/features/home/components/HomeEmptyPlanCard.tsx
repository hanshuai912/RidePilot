import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "../../../theme/colors";
import { AppText, Badge, Button, Card } from "../../../components/ui";

export function HomeEmptyPlanCard() {
  const router = useRouter();
  return (
    <Card className="overflow-hidden rounded-card p-0">
      <View className="border-b border-divider bg-surface-2 px-5 pb-5 pt-5">
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
      </View>
      <View className="px-5 pb-5 pt-4">
        <Button onPress={() => router.push("/(tabs)/coach")}>
          开始建立训练计划
        </Button>
      </View>
    </Card>
  );
}
