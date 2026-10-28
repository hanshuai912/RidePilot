import { View } from "react-native";

import { cn } from "../../lib/cn";

export function BottomActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View
      className={cn(
        "border-t border-divider bg-background px-5 pb-5 pt-3",
        className,
      )}
    >
      {children}
    </View>
  );
}
