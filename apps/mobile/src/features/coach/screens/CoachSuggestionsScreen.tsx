import { useRouter } from "expo-router";
import { TrainingPage } from "../../training/components/TrainingPage";
import { CoachSuggestionsPanel } from "../components/CoachSuggestionsPanel";

export function CoachSuggestionsScreen() {
  const router = useRouter();
  return (
    <TrainingPage
      title="教练建议"
      onBack={() => router.replace("/(tabs)/coach")}
    >
      <CoachSuggestionsPanel />
    </TrainingPage>
  );
}
