import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../../components/layout/Screen";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";
import { AppText, Button, Spinner } from "../../../components/ui";
import { spacing } from "../../../theme/spacing";
import { useTrainingHistory } from "../hooks/useTrainingHistory";
import { TrainingHistoryRow } from "../components/TrainingHistoryRow";

export function TrainingHistoryScreen() {
  const state = useTrainingHistory();
  return (
    <Screen>
      <NavigationHeader
        title="训练历史"
        backLabel="返回我的"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/profile");
        }}
      />
      <FlatList
        testID="training-history-list"
        data={state.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={state.loading && state.items.length > 0}
        onRefresh={state.retry}
        renderItem={({ item, index }) => (
          <View className="gap-2">
            {index === 0 ||
            state.items[index - 1].scheduledDate !== item.scheduledDate ? (
              <AppText variant="card" className="mt-3">
                {item.scheduledDate}
              </AppText>
            ) : null}
            <TrainingHistoryRow
              workout={item}
              showDate={false}
              onPress={() =>
                router.push({
                  pathname: "/workouts/[workoutId]",
                  params: { workoutId: item.id, source: "history" },
                })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          state.loading ? (
            <Spinner accessibilityLabel="正在加载训练历史" />
          ) : state.error ? (
            <View className="gap-3">
              <AppText className="text-negative">{state.error}</AppText>
              <Button onPress={state.retry}>重试加载训练历史</Button>
            </View>
          ) : (
            <AppText muted>暂无训练历史</AppText>
          )
        }
        ListFooterComponent={
          state.nextCursor ? (
            <View className="mt-4 gap-3">
              {state.moreError ? (
                <AppText className="text-negative">{state.moreError}</AppText>
              ) : null}
              <Button
                variant="secondary"
                loading={state.loadingMore}
                disabled={state.loadingMore}
                onPress={() => void state.loadMore()}
              >
                {state.moreError ? "重试加载更早训练" : "加载更早训练"}
              </Button>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  separator: { height: spacing.md },
});
