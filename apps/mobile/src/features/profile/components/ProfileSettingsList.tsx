import { View } from "react-native";
import { Card } from "../../../components/ui";
import { FtpMeasurementCard } from "./FtpMeasurementCard";
import { HeartRateSettingsCard } from "./HeartRateSettingsCard";
import { ThirdPartyAppsCard } from "./ThirdPartyAppsCard";
import { ProfilePlanningEntries } from "./ProfilePlanningEntries";
import { profileMetricStyles as styles } from "./profile-metric-card.styles";

export function ProfileSettingsList({ token }: { token: string }) {
  return (
    <Card
      testID="profile-settings-list"
      className="overflow-hidden !p-0"
      style={styles.group}
    >
      <FtpMeasurementCard token={token} />
      <View style={styles.divider} />
      <HeartRateSettingsCard token={token} />
      <View style={styles.divider} />
      <ProfilePlanningEntries />
      <View style={styles.divider} />
      <ThirdPartyAppsCard />
    </Card>
  );
}
