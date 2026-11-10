import { Pressable } from "react-native";
import { ArrowUpRight, MessageCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function CoachChatEntry() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="问 AI 教练"
      accessibilityHint="进入现有 AI 对话页面"
      onPress={() => router.push("/(tabs)/coach/chat")}
      className="min-h-[52px] flex-row items-center gap-3 rounded-full border border-border bg-surface px-4 py-3 active:bg-surface-2"
    >
      <MessageCircle color={colors.brand} size={19} />
      <AppText variant="caption" className="min-w-0 flex-1 text-secondary">
        向 AI 教练提问或描述训练变化……
      </AppText>
      <ArrowUpRight color={colors.textSecondary} size={18} />
    </Pressable>
  );
}
