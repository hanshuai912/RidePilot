import { Pressable } from "react-native";
import { Plus } from "lucide-react-native";
import { router } from "expo-router";
import { colors } from "../../../theme/colors";

export function AddGoalButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="添加目标"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.push("/goals/new")}
      className={`h-11 w-11 items-center justify-center ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      <Plus size={22} color={colors.brand} />
    </Pressable>
  );
}
