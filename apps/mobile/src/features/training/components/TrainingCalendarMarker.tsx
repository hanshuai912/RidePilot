import { StyleSheet, View } from "react-native";

// Shape and colour both identify events, including on a selected gold day.
export function TrainingCalendarMarker({
  kind,
  color,
}: {
  kind: number;
  color: string;
}) {
  return (
    <View
      style={[
        styles.dot,
        shapes[kind],
        {
          backgroundColor: kind === 4 ? "transparent" : color,
          borderColor: color,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 4, height: 4, borderRadius: 2 },
  diamond: { borderRadius: 0, transform: [{ rotate: "45deg" }] },
  square: { borderRadius: 0 },
  dash: { width: 6, height: 2, borderRadius: 0 },
  ring: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
});
const shapes = [
  styles.dot,
  styles.diamond,
  styles.square,
  styles.dash,
  styles.ring,
];
