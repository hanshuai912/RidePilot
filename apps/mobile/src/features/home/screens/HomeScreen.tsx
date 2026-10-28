import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../../profile/services/profile.api";
import { coachApi, type CoachPlanStatus } from "../../coach/services/coach.api";
import { HomeActivePlanCard } from "../components/HomeActivePlanCard";
import { HomeEmptyPlanCard } from "../components/HomeEmptyPlanCard";
import { HomeHeader } from "../components/HomeHeader";
import { HomeStatusCard } from "../components/HomeStatusCard";

export function HomeScreen() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState("骑行者");
  const [profileState, setProfileState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [planStatus, setPlanStatus] = useState<CoachPlanStatus | null>(null);
  const [planState, setPlanState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useFocusEffect(
    useCallback(() => {
      if (!session?.accessToken) return;
      let active = true;
      setPlanState("loading");
      void getProfile(session.accessToken)
        .then((profile) => {
          if (!active) return;
          setDisplayName(profile.displayName || "骑行者");
          setProfileState("ready");
        })
        .catch(() => {
          if (active) setProfileState("error");
        });
      void coachApi
        .planStatus(session.accessToken)
        .then((status) => {
          if (!active) return;
          setPlanStatus(status);
          setPlanState("ready");
        })
        .catch(() => {
          if (active) setPlanState("error");
        });
      return () => {
        active = false;
      };
    }, [session]),
  );

  return (
    <Screen
      scroll
      scrollProps={{ contentContainerClassName: "grow px-4 pb-10" }}
    >
      <HomeHeader
        displayName={displayName}
        onProfilePress={() => router.push("/(tabs)/profile")}
      />
      {profileState === "loading" ? (
        <Spinner accessibilityLabel="正在加载个人档案" />
      ) : null}
      {profileState === "error" ? (
        <AppText variant="caption" className="mb-3 text-secondary">
          个人档案暂时无法加载，当前使用默认称呼。
        </AppText>
      ) : null}
      {planState === "loading" ? (
        <Spinner accessibilityLabel="正在加载正式计划" />
      ) : null}
      {planState === "error" ? (
        <AppText variant="caption" className="mb-3 text-warning">
          暂时无法确认正式计划状态，请稍后重试。
        </AppText>
      ) : null}
      {planState === "ready" && planStatus ? (
        planStatus.hasActivePlan ? (
          <HomeActivePlanCard version={planStatus.planVersion} />
        ) : (
          <HomeEmptyPlanCard />
        )
      ) : null}
      <HomeStatusCard />
    </Screen>
  );
}
