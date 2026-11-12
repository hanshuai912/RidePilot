import { Pressable, ScrollView, View } from "react-native";
import { Flag, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/layout/Screen";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { useCoachRaces } from "../hooks/useCoachRaces";
import { CoachRaceCard } from "../components/CoachRaceCard";

export function CoachRacePreparationScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { races, loading, error, retry } = useCoachRaces(session?.accessToken);
  const addRace = () => router.push("/races/new");
  return (
    <Screen>
      <NavigationHeader
        title="赛事备赛"
        onBack={() => router.replace("/(tabs)/coach")}
        rightAction={
          session && races.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加赛事"
              onPress={addRace}
              className="h-11 w-11 items-center justify-center"
            >
              <Plus size={22} color={colors.brand} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-8 pt-6"
      >
        <View>
          <AppText variant="title">为哪场比赛做准备？</AppText>
          <AppText className="mt-2 text-secondary">
            选择赛事后，查看备赛日期、训练影响与专属草稿。
          </AppText>
        </View>
        {!session ? (
          <AppText>请先登录后查看赛事。</AppText>
        ) : loading ? (
          <Spinner accessibilityLabel="读取待备赛赛事" />
        ) : error ? (
          <Card>
            <AppText accessibilityRole="alert">{error}</AppText>
            <Button variant="secondary" className="mt-4" onPress={retry}>
              重新读取赛事
            </Button>
          </Card>
        ) : races.length ? (
          <View className="gap-3">
            <AppText variant="caption" className="text-secondary">
              待备赛赛事 · {races.length}
            </AppText>
            {races.map((race) => (
              <CoachRaceCard
                key={race.id}
                race={race}
                onPress={() =>
                  router.push({
                    pathname: "/races/proposal",
                    params: { raceId: race.id, phase: "PREPARATION" },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <Card className="items-center py-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
              <Flag size={24} color={colors.brand} />
            </View>
            <AppText variant="card">暂无待备赛赛事</AppText>
            <AppText className="mt-2 text-center text-secondary">
              添加比赛日期、距离和目标，开始规划备赛。
            </AppText>
            <Button className="mt-5 self-stretch" onPress={addRace}>
              添加赛事
            </Button>
          </Card>
        )}
        {session && !loading && !error ? (
          <Button variant="ghost" onPress={() => router.push("/races")}>
            查看全部赛事
          </Button>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
