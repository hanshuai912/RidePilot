import { StyleSheet, Text, View } from "react-native";
import { authColors as colors } from "./auth-theme";

export function AuthFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.negative,
    backgroundColor: "#332523",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  text: { color: colors.negative, fontSize: 12, lineHeight: 19 },
});
