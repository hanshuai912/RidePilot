import { View } from "react-native";
import { AppText, Card } from "../../../components/ui";
import { FtpMeasurementCard } from "./FtpMeasurementCard";
import { HeartRateSettingsCard } from "./HeartRateSettingsCard";
import { ThirdPartyAppsCard } from "./ThirdPartyAppsCard";
import { ProfilePlanningEntries } from "./ProfilePlanningEntries";
import { profileMetricStyles as styles } from "./profile-metric-card.styles";

export function ProfileSettingsList({ token }: { token: string }) {
  return (
    <View testID="profile-settings-list" className="mt-6 gap-3">
      <AppText variant="section">运动能力</AppText>
      <Card padding="none" className="overflow-hidden">
        <FtpMeasurementCard token={token} />
        <View style={styles.divider} />
        <HeartRateSettingsCard token={token} />
      </Card>
      <AppText variant="section" className="mt-3">
        训练管理与历史
      </AppText>
      <Card padding="none" className="overflow-hidden">
        <ProfilePlanningEntries />
      </Card>
      <AppText variant="section" className="mt-3">
        连接与同步
      </AppText>
      <Card padding="none" className="overflow-hidden">
        <ThirdPartyAppsCard />
      </Card>
    </View>
  );
}
