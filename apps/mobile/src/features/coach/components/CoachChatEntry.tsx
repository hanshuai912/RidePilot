import { Pressable } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "../../../theme/colors";

export function CoachChatEntry() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="问 AI 教练"
      accessibilityHint="进入现有 AI 对话页面"
      onPress={() => router.push("/(tabs)/coach/chat")}
      className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:bg-surface-2"
    >
      <MessageCircle color={colors.brand} size={21} strokeWidth={1.8} />
    </Pressable>
  );
}
