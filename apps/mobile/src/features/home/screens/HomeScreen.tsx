import { router } from "expo-router";
import { RefreshControl } from "react-native";
import type { CalendarResponse } from "@ridepilot/contracts";

import { Screen } from "../../../components/layout/Screen";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { HomeHeader } from "../components/HomeHeader";
import { HomeStatusCard } from "../components/HomeStatusCard";
import { HomeTrainingSection } from "../components/HomeTrainingSection";
import { HomeNutritionSection } from "../components/HomeNutritionSection";
import { HomeResourceFeedback } from "../components/HomeResourceFeedback";
import { useHomeData } from "../hooks/useHomeData";

function HomeContent({ token }: { token: string }) {
  const home = useHomeData(token);
  const refresh = () => void home.refresh();
  const refreshing = [
    home.profile,
    home.plan,
    home.training,
    home.nutrition,
    home.next,
  ].some((resource) => resource.loading);
  const openWorkout = (
    workout: CalendarResponse["items"][number],
    action?: "adjust" | "feedback",
  ) =>
    router.push({
      pathname: "/workouts/[workoutId]",
      params: { workoutId: workout.id, ...(action ? { action } : {}) },
    });
  return (
    <Screen
      scroll
      scrollProps={{
        contentContainerClassName: "grow gap-5 px-4 pb-10",
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            accessibilityLabel="刷新首页"
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface1}
          />
        ),
      }}
    >
      <HomeHeader
        displayName={home.profile.data?.displayName || "骑行者"}
        timezone={home.profile.data?.timezone}
        onProfilePress={() => router.push("/(tabs)/profile")}
      />
      <HomeResourceFeedback
        {...home.profile}
        cached={!!home.profile.data}
        label="首页"
        onRetry={refresh}
      />
      <HomeTrainingSection
        training={home.training}
        hasPlan={home.plan.data?.hasActivePlan}
        next={home.next}
        onRetry={refresh}
        onWorkout={openWorkout}
        onCalendar={() =>
          router.push({
            pathname: "/(tabs)/training",
            params: home.date ? { date: home.date } : {},
          })
        }
        onCreate={() =>
          router.push({
            pathname: "/workouts/new",
            params: home.date ? { date: home.date } : {},
          })
        }
      />
      <HomeStatusCard />
      <HomeNutritionSection
        resource={home.nutrition}
        onRetry={refresh}
        onOpen={() => router.push("/(tabs)/nutrition")}
      />
    </Screen>
  );
}

export function HomeScreen() {
  const { session } = useAuth();
  return session ? (
    <HomeContent key={session.user.id} token={session.accessToken} />
  ) : (
    <Screen>
      <AppText>请先登录后查看今日安排。</AppText>
    </Screen>
  );
}
