import { router } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";

export function FtpRequiredState() {
  return (
    <Card>
      <AppText variant="card">先设置 FTP</AppText>
      <AppText variant="body" muted className="mt-2">
        FTP 用于确定训练强度。设置后返回即可继续，当前选择和输入会保留。
      </AppText>
      <Button
        className="mt-4"
        onPress={() => router.push("/cycling-power-zones")}
      >
        设置 FTP
      </Button>
    </Card>
  );
}
