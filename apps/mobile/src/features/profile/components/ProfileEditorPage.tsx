import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../../../components/layout/Screen";
import { AppText, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { layout } from "../../../theme/layout";
import { spacing } from "../../../theme/spacing";
import { ProfilePageHeader } from "./ProfilePageHeader";

export function ProfileEditorPage({
  title,
  saving,
  onBack,
  children,
  onSave,
  saveDisabled = false,
  overlay,
}: {
  title: string;
  saving: boolean;
  onBack: () => void;
  children: ReactNode;
  onSave?: () => void;
  saveDisabled?: boolean;
  overlay?: ReactNode;
}) {
  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView edges={["bottom"]} style={styles.fill}>
          <ProfilePageHeader
            title={title}
            disabled={saving}
            onBack={onBack}
            rightAction={
              onSave ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="保存"
                  accessibilityState={{
                    disabled: saveDisabled || saving,
                    busy: saving,
                  }}
                  style={({ pressed }) => [
                    styles.save,
                    (saveDisabled || saving || pressed) && styles.dimmed,
                  ]}
                  disabled={saveDisabled || saving}
                  onPress={onSave}
                >
                  {saving ? (
                    <Spinner accessibilityLabel="正在保存" />
                  ) : (
                    <AppText numberOfLines={1} style={styles.saveText}>
                      保存
                    </AppText>
                  )}
                </Pressable>
              ) : null
            }
          />
          <ScrollView
            testID="profile-editor-content"
            style={styles.fill}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
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
  save: {
    width: layout.tapMin,
    minHeight: layout.tapMin,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.brand,
  },
  dimmed: { opacity: 0.5 },
});
