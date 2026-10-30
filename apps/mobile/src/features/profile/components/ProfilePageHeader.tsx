import { Pressable, StyleSheet, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { layout } from "../../../theme/layout";
import { spacing } from "../../../theme/spacing";

export function ProfilePageHeader({
  title,
  disabled,
  onBack,
}: {
  title: string;
  disabled: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回我的"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={styles.side}
      >
        <ArrowLeft size={20} color={colors.textPrimary} />
      </Pressable>
      <AppText variant="card" accessibilityRole="header" style={styles.title}>
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
