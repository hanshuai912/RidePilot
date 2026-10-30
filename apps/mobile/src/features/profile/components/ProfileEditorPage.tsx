import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../../../components/layout/Screen";
import { colors } from "../../../theme/colors";
import { layout } from "../../../theme/layout";
import { spacing } from "../../../theme/spacing";
import { ProfilePageHeader } from "./ProfilePageHeader";

export function ProfileEditorPage({
  title,
  saving,
  onBack,
  children,
  footer,
  overlay,
}: {
  title: string;
  saving: boolean;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView edges={["bottom"]} style={styles.fill}>
          <ProfilePageHeader title={title} disabled={saving} onBack={onBack} />
          <ScrollView
            testID="profile-editor-content"
            style={styles.fill}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={styles.footer}>
              <View style={styles.footerContent}>{footer}</View>
            </View>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
      {overlay}
    </Screen>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  footerContent: {
    width: "100%",
    maxWidth: layout.contentMaxWidth,
    alignSelf: "center",
  },
});
