import type { ReactNode } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";
import { Screen } from "../../../components/layout/Screen";
import { AppText, Button, Spinner } from "../../../components/ui";
import { styles } from "./training.styles";

export function backToTraining() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/training");
}
export function TrainingPage({
  loading,
  error,
  retry,
  title,
  onBack,
  busy = false,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  title?: string;
  onBack?: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
          {title ? (
            <NavigationHeader
              title={title}
              onBack={onBack ?? backToTraining}
              disabled={busy}
            />
          ) : null}
          <ScrollView
            testID="training-page-content"
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              ...styles.content,
              paddingBottom: 36,
              gap: 12,
            }}
          >
            {loading ? (
              <Spinner accessibilityLabel="正在加载训练数据" />
            ) : error ? (
              <>
                <AppText style={styles.error}>{error}</AppText>
                {retry ? <Button onPress={retry}>重试</Button> : null}
                <Button
                  variant="secondary"
                  onPress={() => router.dismissTo("/(tabs)/training")}
                >
                  返回训练
                </Button>
              </>
            ) : (
              <>{children}</>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
