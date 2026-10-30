import { router } from "expo-router";
import { ProfileEditorPage } from "../../profile/components/ProfileEditorPage";
import { CorosConnectionCard } from "../components/CorosConnectionCard";

export function ThirdPartyAppsScreen() {
  return (
    <ProfileEditorPage
      title="第三方 App"
      saving={false}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/profile");
      }}
    >
      <CorosConnectionCard />
    </ProfileEditorPage>
  );
}
