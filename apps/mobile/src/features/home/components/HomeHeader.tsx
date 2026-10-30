import { UserRound } from "lucide-react-native";
import { Pressable } from "react-native";

import { colors } from "../../../theme/colors";
import { AppHeader } from "../../../components/layout/AppHeader";

function greeting(hour: number): string {
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function HomeHeader({
  displayName,
  onProfilePress,
  now = new Date(),
  timezone,
}: {
  displayName: string;
  onProfilePress: () => void;
  now?: Date;
  timezone?: string;
}) {
  const date = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: timezone,
  }).format(now);

  return (
    <AppHeader
      title={greeting(
        Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            hourCycle: "h23",
          }).format(now),
        ),
      )}
      subtitle={`${displayName} · ${date}`}
      compact
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开我的页面"
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
          onPress={onProfilePress}
        >
          <UserRound color={colors.textSecondary} size={20} strokeWidth={1.7} />
        </Pressable>
      }
    />
  );
}
