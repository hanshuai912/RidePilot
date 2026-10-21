import { useEffect, useState } from "react";
import { router } from "expo-router";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../../profile/services/profile.api";
import { HomeEmptyPlanCard } from "../components/HomeEmptyPlanCard";
import { HomeHeader } from "../components/HomeHeader";
import { HomeStatusCard } from "../components/HomeStatusCard";

export function HomeScreen() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState("骑行者");
  const [profileState, setProfileState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;
    void getProfile(session.accessToken)
      .then((profile) => {
        if (!active) return;
        setDisplayName(profile.displayName || "骑行者");
        setProfileState("ready");
      })
      .catch(() => {
        if (active) setProfileState("error");
      });
    return () => {
      active = false;
    };
  }, [session]);

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
      <HomeEmptyPlanCard />
      <HomeStatusCard />
    </Screen>
  );
}
