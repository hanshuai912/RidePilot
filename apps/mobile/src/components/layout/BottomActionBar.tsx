import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "../../lib/cn";

export function BottomActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: Math.max(20, insets.bottom) }}
      className={cn(
        "border-t border-divider bg-background px-5 pb-5 pt-3",
        className,
      )}
    >
      {children}
    </View>
  );
}
