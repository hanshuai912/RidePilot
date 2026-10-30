import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

import { colors } from "../src/theme/tokens";
import { AuthProvider, useAuth } from "../src/features/auth/hooks/AuthProvider";
import { AppText, Button } from "../src/components/ui";

function AuthenticatedStack() {
  const { status, retry } = useAuth();
  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel="正在检查登录状态"
        />
      </View>
    );
  }
  if (status === "unavailable") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <AppText style={{ color: colors.textPrimary }}>
          暂时无法验证登录状态，请检查 API 连接后重试。
        </AppText>
        <Button onPress={() => void retry()}>重试</Button>
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Protected guard={status === "authenticated"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="personal-info"
          options={{ headerShown: false, title: "个人信息" }}
        />
        <Stack.Screen name="workouts" options={{ headerShown: false }} />
        <Stack.Screen
          name="heart-rate-zones"
          options={{ headerShown: false, title: "心率区间" }}
        />
        <Stack.Screen
          name="cycling-power-zones"
          options={{ headerShown: false, title: "骑行功率区间" }}
        />
        <Stack.Screen name="showcase" options={{ title: "UI Showcase" }} />
        <Stack.Screen name="coros-callback" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "guest"}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <AuthenticatedStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
