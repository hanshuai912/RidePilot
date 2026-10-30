import { AppText, Button, Card, Input, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { ProfileEditorPage } from "../components/ProfileEditorPage";
import { FtpPowerZones } from "../components/FtpPowerZones";
import { useFtpEditor } from "../hooks/useFtpEditor";
import { useProfileEditorNavigation } from "../hooks/useProfileEditorNavigation";

export function CyclingPowerZonesScreen() {
  const { session } = useAuth();
  const editor = useFtpEditor(session?.accessToken);
  const { back, confirmation } = useProfileEditorNavigation({
    ...editor,
    description: "返回将放弃本次 FTP 修改，是否继续？",
  });
  return (
    <ProfileEditorPage
      title="骑行功率区间"
      saving={editor.saving}
      onBack={back}
      overlay={confirmation}
      footer={
        editor.loaded ? (
          <Button
            size="lg"
            disabled={!editor.dirty || editor.value === null || editor.saving}
            loading={editor.saving}
            onPress={() => void editor.save()}
          >
            保存 FTP
          </Button>
        ) : null
      }
    >
      {editor.loading ? <Spinner accessibilityLabel="正在加载 FTP" /> : null}
      {editor.error ? (
        <AppText accessibilityRole="alert" className="mb-4 text-warning">
          {editor.error}
        </AppText>
      ) : null}
      {!editor.loading && !editor.loaded ? (
        <Button onPress={editor.reload}>重新加载</Button>
      ) : null}
      {editor.loaded ? (
        <>
          <Card>
            <AppText variant="card">功能阈值功率</AppText>
            <AppText variant="caption" muted className="mt-2">
              填写已测得的 FTP，支持 50–800 W。
            </AppText>
            <AppText variant="label" muted className="mt-5">
              FTP（W）
            </AppText>
            <Input
              className="mt-2"
              accessibilityLabel="FTP 数值"
              keyboardType="number-pad"
              placeholder="请输入 FTP"
              value={editor.watts}
              onChangeText={editor.setWatts}
              editable={!editor.saving}
            />
            {editor.invalid ? (
              <AppText
                accessibilityRole="alert"
                variant="caption"
                className="mt-2 text-warning"
              >
                请输入 50–800 W 之间的整数 FTP
              </AppText>
            ) : null}
          </Card>
          <FtpPowerZones ftp={editor.value} />
        </>
      ) : null}
    </ProfileEditorPage>
  );
}
