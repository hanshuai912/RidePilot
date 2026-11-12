import { NavigationHeaderAction } from "../../../components/layout/NavigationHeaderAction";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "../../../components/layout/Screen";
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
                <NavigationHeaderAction
                  label="保存"
                  loading={saving}
                  disabled={saveDisabled}
                  onPress={onSave}
                />
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
});
