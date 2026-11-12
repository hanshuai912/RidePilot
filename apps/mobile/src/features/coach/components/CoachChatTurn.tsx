import { View } from "react-native";
import type { CoachChatTurn as Turn } from "@ridepilot/contracts";
import { AppText, Button } from "../../../components/ui";
import { chatStyles as styles } from "./coach-chat.styles";

export function CoachChatTurn({
  turn,
  disabled,
  onRetry,
}: {
  turn: Turn;
  disabled: boolean;
  onRetry: () => void;
}) {
  const time = new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(turn.createdAt));
  return (
    <View style={styles.turn}>
      <AppText variant="label" muted style={styles.time}>
        {time}
      </AppText>
      <View style={styles.userRow} testID="coach-chat-user-message">
        <View style={[styles.bubble, styles.userBubble]}>
          <AppText selectable>{turn.question}</AppText>
        </View>
      </View>
      <View style={styles.assistantRow} testID="coach-chat-assistant-message">
        <View style={styles.avatar} accessibilityElementsHidden>
          <AppText variant="label" className="text-brand">
            AI
          </AppText>
        </View>
        <View style={styles.assistantContent}>
          <AppText variant="label" muted>
            AI 教练
          </AppText>
          <View style={[styles.bubble, styles.assistantBubble]}>
            {turn.status === "COMPLETED" ? (
              <AppText selectable>{turn.answer}</AppText>
            ) : turn.status === "PROCESSING" ? (
              <AppText muted accessibilityLiveRegion="polite">
                正在回复…
              </AppText>
            ) : (
              <View style={styles.failure}>
                <AppText accessibilityRole="alert" className="text-negative">
                  {turn.errorMessage ?? "回复失败，请重试"}
                </AppText>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  accessibilityLabel={`重试提问：${turn.question}`}
                  onPress={onRetry}
                >
                  重试提问
                </Button>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
