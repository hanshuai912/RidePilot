import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";

export type CardProps = ViewProps & {
  className?: string;
  padding?: "none" | "default" | "roomy";
};

export function Card({ className, padding = "default", ...props }: CardProps) {
  const hasPadding = className
    ?.split(/\s+/)
    .some((value) => /^!?p-/.test(value));
  return (
    <View
      className={cn(
        "rounded-card border border-border bg-surface",
        !hasPadding &&
          (padding === "none" ? "p-0" : padding === "roomy" ? "p-5" : "p-4"),
        className,
      )}
      {...props}
    />
  );
}
