import { Text, type TextProps } from "react-native";
import { cn } from "../../lib/cn";
import { textStyles, type TextVariant } from "../../theme/typography";

const weights: Record<TextVariant, string> = {
  display: "font-semibold",
  pageTitle: "font-semibold",
  title: "font-semibold",
  section: "font-semibold",
  navigation: "font-semibold",
  card: "font-semibold",
  body: "",
  caption: "",
  label: "font-medium",
  button: "font-semibold",
  chart: "font-medium",
};
export type AppTextProps = TextProps & {
  variant?: TextVariant;
  muted?: boolean;
  className?: string;
};

export function AppText({
  variant = "body",
  muted = false,
  className,
  style,
  ...props
}: AppTextProps) {
  const { fontSize, lineHeight } = textStyles[variant];
  const classes = className?.split(/\s+/) ?? [];
  const hasColor = classes.some((value) =>
    /^!?text-(primary|secondary|muted|brand|brand-on|positive|negative|warning|white|black)(\/\d+)?$/.test(
      value,
    ),
  );
  const hasWeight = classes.some((value) => /^!?font-/.test(value));
  return (
    <Text
      className={cn(
        !hasWeight && weights[variant],
        !hasColor && (muted ? "text-muted" : "text-primary"),
        className,
      )}
      style={[{ fontSize, lineHeight }, style]}
      {...props}
    />
  );
}
