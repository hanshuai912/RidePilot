import { AppText, Button, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { PersonalInformationForm } from "../components/PersonalInformationForm";
import { ProfileEditorPage } from "../components/ProfileEditorPage";
import { usePersonalInformation } from "../hooks/usePersonalInformation";
import { useProfileEditorNavigation } from "../hooks/useProfileEditorNavigation";

export function PersonalInformationScreen() {
  const { session } = useAuth();
  const editor = usePersonalInformation(session?.accessToken);
  const { back, confirmation } = useProfileEditorNavigation({
    ...editor,
    description: "返回将放弃本次个人信息修改，是否继续？",
  });
  return (
    <ProfileEditorPage
      title="个人信息"
      saving={editor.saving}
      onBack={back}
      overlay={confirmation}
      footer={
        editor.draft ? (
          <Button
            size="lg"
            disabled={!editor.dirty || editor.saving}
            loading={editor.saving}
            onPress={() => void editor.save()}
          >
            保存资料
          </Button>
        ) : null
      }
    >
      {editor.loading ? (
        <Spinner accessibilityLabel="正在加载个人信息" />
      ) : null}
      {editor.error ? (
        <AppText accessibilityRole="alert" className="mb-4 text-warning">
          {editor.error}
        </AppText>
      ) : null}
      {!editor.loading && !editor.draft ? (
        <Button onPress={() => void editor.reload()}>重新加载</Button>
      ) : null}
      {editor.draft ? (
        <PersonalInformationForm
          draft={editor.draft}
          saving={editor.saving}
          onChange={editor.setDraft}
        />
      ) : null}
    </ProfileEditorPage>
  );
}
