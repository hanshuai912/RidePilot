import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { AppText } from "./AppText";
import { colors } from "../../theme/colors";

/** Keeps secondary detail available without competing with the page's task. */
export function Disclosure({
  title,
  summary,
  children,
  defaultExpanded = false,
  keepMounted = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Preserve local form inputs when a user folds and reopens this section. */
  keepMounted?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = expanded ? ChevronUp : ChevronDown;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-70"
      >
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="card">{title}</AppText>
          {summary ? (
            <AppText variant="caption" muted>
              {summary}
            </AppText>
          ) : null}
        </View>
        <Icon size={18} color={colors.textSecondary} accessible={false} />
      </Pressable>
      {expanded || keepMounted ? (
        <View
          className="gap-3 pb-3"
          style={expanded ? undefined : { display: "none" }}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
