import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CoachChatTurn as Turn } from "@ridepilot/contracts";
import { AppText, Button, Spinner } from "../../../components/ui";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";
import { Screen } from "../../../components/layout/Screen";
import { spacing } from "../../../theme/tokens";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { useCoachChat } from "../hooks/useCoachChat";
import { CoachChatTurn } from "../components/CoachChatTurn";
import { CoachChatComposer } from "../components/CoachChatComposer";
import { chatStyles as styles } from "../components/coach-chat.styles";

export function CoachChatScreen() {
  const { session } = useAuth();
  return (
    <CoachChatSession
      key={session?.user.id ?? "signed-out"}
      token={session?.accessToken}
    />
  );
}

function CoachChatSession({ token }: { token?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chat = useCoachChat(token);
  const list = useRef<FlatList<Turn>>(null);
  const atBottom = useRef(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollToLatest = () => {
    atBottom.current = true;
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const latestKey = chat.turns[0]?.clientMessageId;
  useEffect(() => {
    if (atBottom.current)
      list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [latestKey]);
  return (
    <Screen>
      <KeyboardAvoidingView
        testID="coach-chat-keyboard"
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
        enabled={Platform.OS !== "web"}
      >
        <NavigationHeader
          title="AI 教练"
          onBack={() => router.replace("/(tabs)/coach")}
        />
        <AppText variant="label" muted style={styles.hint}>
          训练建议供你参考，调整计划请返回教练首页
        </AppText>
        {!token ? (
          <View style={styles.empty}>
            <AppText>请先登录</AppText>
          </View>
        ) : chat.loading ? (
          <View style={styles.empty}>
            <Spinner accessibilityLabel="正在读取聊天记录" />
          </View>
        ) : chat.loadError ? (
          <View style={styles.empty}>
            <AppText accessibilityRole="alert">{chat.loadError}</AppText>
            <Button onPress={() => void chat.refresh()}>
              重新读取聊天记录
            </Button>
          </View>
        ) : chat.turns.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="section">今天想聊点什么？</AppText>
            <AppText muted style={styles.emptyText}>
              可以问我训练安排、恢复或骑行补给的问题。
            </AppText>
          </View>
        ) : (
          <FlatList
            ref={list}
            testID="coach-chat-messages"
            style={styles.fill}
            contentContainerStyle={styles.list}
            data={chat.turns}
            inverted
            keyExtractor={(turn) => turn.clientMessageId}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            onScroll={(event) => {
              atBottom.current = event.nativeEvent.contentOffset.y < 80;
            }}
            scrollEventThrottle={100}
            onLayout={() => {
              if (atBottom.current) scrollToLatest();
            }}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            renderItem={({ item }) => (
              <CoachChatTurn
                turn={item}
                disabled={chat.blocked}
                onRetry={() => {
                  void chat.send(item);
                }}
              />
            )}
            ListFooterComponent={
              <View style={styles.footer}>
                {chat.moreError ? (
                  <AppText accessibilityRole="alert" className="text-negative">
                    {chat.moreError}
                  </AppText>
                ) : null}
                {chat.nextCursor ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={chat.loadingMore}
                    onPress={() => void chat.loadMore()}
                  >
                    查看更早消息
                  </Button>
                ) : (
                  <AppText variant="label" muted>
                    以上是全部聊天记录
                  </AppText>
                )}
              </View>
            }
          />
        )}
        {chat.syncError ? (
          <Button size="sm" variant="ghost" onPress={() => void chat.refresh()}>
            {chat.syncError} · 重试同步
          </Button>
        ) : null}
        <CoachChatComposer
          message={chat.message}
          onChange={chat.setMessage}
          onSend={() => {
            scrollToLatest();
            void chat.send();
          }}
          onFocus={scrollToLatest}
          disabled={chat.blocked}
          bottomInset={
            keyboardOpen ? spacing.xs : Math.max(insets.bottom, spacing.md)
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
