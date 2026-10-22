import { View } from "react-native";
import { AppText } from "../../../components/ui";
import { styles } from "./training.styles";

export function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.total}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="card">{value}</AppText>
    </View>
  );
}
export function Notice({
  text,
  danger = false,
}: {
  text: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.notice, danger && styles.dangerNotice]}>
      <AppText variant="label" style={danger ? styles.error : styles.orange}>
        {danger ? "需要修改" : "提示"}
      </AppText>
      <AppText variant="caption" muted style={styles.noticeText}>
        {text}
      </AppText>
    </View>
  );
}
