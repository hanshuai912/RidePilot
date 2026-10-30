import { View } from "react-native";
import { AppText, Button } from "../../../components/ui";

export function HomeResourceFeedback({
  error,
  cached,
  label,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  cached: boolean;
  label: string;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
        <View className="gap-2 rounded-xl border border-warning/40 bg-surface-2 p-3">
          <AppText variant="caption" className="text-warning">
            {label}读取失败：{error}
            {cached ? "。下方为上次读取内容，操作前请重试刷新。" : ""}
          </AppText>
          <Button variant="secondary" size="sm" onPress={onRetry}>
            重试{label}
          </Button>
        </View>
      ) : null}
    </>
  );
}
