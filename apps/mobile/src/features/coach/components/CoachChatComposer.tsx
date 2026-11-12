import { View } from "react-native";
import { AppText, Button, Input } from "../../../components/ui";
import { chatStyles as styles } from "./coach-chat.styles";

export function CoachChatComposer({
  message,
  onChange,
  onSend,
  onFocus,
  disabled,
  bottomInset,
}: {
  message: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onFocus: () => void;
  disabled: boolean;
  bottomInset: number;
}) {
  return (
    <View
      testID="coach-chat-composer"
      style={[styles.composer, { paddingBottom: bottomInset }]}
    >
      <View style={styles.inputRow}>
        <Input
          accessibilityLabel="向 AI 教练提问"
          placeholder="聊聊你的训练问题…"
          multiline
          maxLength={500}
          value={message}
          onChangeText={onChange}
          onFocus={onFocus}
          style={styles.input}
          scrollEnabled
          returnKeyType="default"
        />
        <Button
          accessibilityLabel="发送问题"
          disabled={disabled || !message.trim()}
          onPress={onSend}
          style={styles.send}
        >
          发送
        </Button>
      </View>
      {message.length >= 450 ? (
        <AppText variant="label" muted>
          {message.length}/500
        </AppText>
      ) : null}
    </View>
  );
}
