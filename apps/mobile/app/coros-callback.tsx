import { useEffect } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { colors } from "../src/theme/tokens";

export default function CorosCallbackRoute() {
  const { status } = useLocalSearchParams<{ status?: string }>();

  useEffect(() => {
    if (status === "error") {
      Alert.alert("COROS 授权未完成", "请在“第三方 App”页面重试绑定。", [
        { text: "知道了" },
      ]);
    }
    router.dismissTo("/third-party-apps");
  }, [status]);

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
        accessibilityLabel="正在完成 COROS 授权"
      />
    </View>
  );
}
