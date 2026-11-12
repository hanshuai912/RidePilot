import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { cn } from "../../lib/cn";
import { colors } from "../../theme/colors";
import { AppText } from "../ui/AppText";

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  right,
  onBack,
  compact = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "flex-row items-start gap-3",
        compact ? "mb-4" : "mb-5",
        className,
      )}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回上一步"
          className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
          onPress={onBack}
        >
          <ChevronLeft color={colors.textPrimary} size={20} strokeWidth={1.8} />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <AppText variant="label" className="mb-1 text-secondary">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="pageTitle" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" className="mt-2 text-secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View className="shrink-0">{right}</View> : null}
    </View>
  );
}
