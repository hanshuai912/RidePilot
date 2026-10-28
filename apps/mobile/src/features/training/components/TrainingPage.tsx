import type { ReactNode } from "react";
import { router } from "expo-router";
import { AppHeader } from "../../../components/layout/AppHeader";
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
  children,
}: {
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  title?: string;
  onBack?: () => void;
  children?: ReactNode;
}) {
  return (
    <Screen
      scroll
      scrollProps={{
        contentContainerStyle: {
          ...styles.content,
          paddingBottom: 36,
          gap: 12,
        },
      }}
    >
      {title ? <AppHeader title={title} compact onBack={onBack} /> : null}
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
    </Screen>
  );
}
