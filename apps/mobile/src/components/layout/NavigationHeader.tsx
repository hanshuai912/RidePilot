import { Pressable, StyleSheet, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { AppText } from "../ui";
import { colors } from "../../theme/colors";
import { layout } from "../../theme/layout";
import { spacing } from "../../theme/spacing";

export function NavigationHeader({
  title,
  onBack,
  disabled = false,
  backLabel = "返回上一页",
}: {
  title: string;
  onBack: () => void;
  disabled?: boolean;
  backLabel?: string;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={styles.side}
      >
        <ArrowLeft size={20} color={colors.textPrimary} />
      </Pressable>
      <AppText
        variant="card"
        accessibilityRole="header"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.title}
      >
        {title}
      </AppText>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  side: {
    width: layout.tapMin,
    minHeight: layout.tapMin,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: { flex: 1, textAlign: "center" },
});
