import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Plug } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { profileMetricStyles as styles } from "./profile-metric-card.styles";

export function ThirdPartyAppsCard() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="第三方 App"
      accessibilityHint="查看和管理第三方 App 连接"
      onPress={() => router.push("/third-party-apps")}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <Plug color={colors.brand} size={18} />
        </View>
        <AppText
          className="font-medium leading-[22px]"
          style={[styles.content, styles.title]}
        >
          第三方 App
        </AppText>
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
    </Pressable>
  );
}
