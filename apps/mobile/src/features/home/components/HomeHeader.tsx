import { UserRound } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { colors } from "../../../theme/colors";
import { AppText } from "../../../components/ui/AppText";

function greeting(hour: number): string {
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function HomeHeader({
  displayName,
  onProfilePress,
  now = new Date(),
}: {
  displayName: string;
  onProfilePress: () => void;
  now?: Date;
}) {
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);

  return (
    <View className="mb-5 flex-row items-start justify-between">
      <View className="flex-1 pr-4">
        <AppText variant="title">{greeting(now.getHours())}</AppText>
        <AppText className="mt-1 text-secondary">
          {displayName} · {date}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开我的页面"
        className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
        onPress={onProfilePress}
      >
        <UserRound color={colors.textSecondary} size={20} strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}
