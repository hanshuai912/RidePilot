import { StyleSheet, Text, View } from "react-native";

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
    borderColor: "#77504C",
    backgroundColor: "#332523",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  text: { color: "#EFB6B0", fontSize: 12, lineHeight: 19 },
});
