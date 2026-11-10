import { View } from "react-native";
import { AppText, Button } from "../../../components/ui";
import type { useGenerationCancellation } from "../hooks/useGenerationCancellation";

export function GenerationCancelButton({
  cancellation,
}: {
  cancellation: ReturnType<typeof useGenerationCancellation>;
}) {
  return (
    <View className="mt-3 gap-2">
      <Button
        variant="secondary"
        accessibilityLabel={
          cancellation.cancelling ? "正在取消生成" : "取消生成"
        }
        loading={cancellation.cancelling}
        disabled={!cancellation.canCancel || cancellation.cancelled}
        onPress={() => void cancellation.cancel()}
      >
        {cancellation.cancelled ? "已取消生成" : "取消生成"}
      </Button>
      {cancellation.error ? (
        <AppText className="text-negative" accessibilityLiveRegion="polite">
          {cancellation.error}
        </AppText>
      ) : null}
    </View>
  );
}
