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
    <View className={cn("mb-5 flex-row items-start gap-3", className)}>
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
          <AppText variant="label" className="mb-1 tracking-[1.1px] text-brand">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant={compact ? "section" : "display"}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted className="mt-1 leading-5">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View className="shrink-0">{right}</View> : null}
    </View>
  );
}
