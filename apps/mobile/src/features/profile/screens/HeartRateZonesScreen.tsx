import { AppText, Button, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { ProfileEditorPage } from "../components/ProfileEditorPage";
import { HeartRateForm } from "../components/HeartRateForm";
import { HeartRateZones } from "../components/HeartRateZones";
import { useHeartRateEditor } from "../hooks/useHeartRateEditor";
import { useProfileEditorNavigation } from "../hooks/useProfileEditorNavigation";

export function HeartRateZonesScreen() {
  const { session } = useAuth();
  const editor = useHeartRateEditor(session?.accessToken);
  const { back, confirmation } = useProfileEditorNavigation({
    ...editor,
    description: "返回将放弃本次心率设置修改，是否继续？",
  });
  return (
    <ProfileEditorPage
      title="心率区间"
      saving={editor.saving}
      onBack={back}
      overlay={confirmation}
      onSave={editor.loaded ? () => void editor.save() : undefined}
      saveDisabled={!editor.dirty || !editor.valid || editor.saving}
    >
      {editor.loading ? (
        <Spinner accessibilityLabel="正在加载心率设置" />
      ) : null}
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
          <HeartRateForm
            draft={editor.draft}
            update={editor.update}
            saving={editor.saving}
            errors={editor.errors}
          />
          {editor.dirty ? (
            <AppText variant="caption" className="text-warning">
              以下区间为未保存预览，保存后才更新心率设置。
            </AppText>
          ) : null}
          <HeartRateZones values={editor.values} />
        </>
      ) : null}
    </ProfileEditorPage>
  );
}
