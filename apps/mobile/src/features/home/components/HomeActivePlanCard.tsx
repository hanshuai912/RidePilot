import { useRouter } from "expo-router";
import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Badge, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function HomeActivePlanCard({ version }: { version: number }) {
  const router = useRouter();
  return (
    <Card className="overflow-hidden rounded-card p-0">
      <View className="border-b border-divider bg-surface-2 px-5 pb-5 pt-5">
        <View className="mb-5 h-12 w-12 items-center justify-center rounded-full bg-brand-subtle">
          <CalendarDays color={colors.brand} size={22} strokeWidth={1.7} />
        </View>
        <Badge variant="brand">正式计划 v{version}</Badge>
        <AppText variant="section" className="mt-3">
          训练计划已生效
        </AppText>
        <AppText className="mt-2 leading-6 text-secondary">
          课程已进入训练日历，可查看本周安排。
        </AppText>
      </View>
      <View className="px-5 pb-5 pt-4">
        <Button onPress={() => router.push("/(tabs)/training")}>
          查看训练日历
        </Button>
      </View>
    </Card>
  );
}
