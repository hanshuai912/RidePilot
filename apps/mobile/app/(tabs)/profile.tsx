import { useState } from "react";
import { View } from "react-native";
import { PlaceholderScreen } from "../../src/components/layout/PlaceholderScreen";
import { AppText, Button } from "../../src/components/ui";
import { useAuth } from "../../src/features/auth/hooks/AuthProvider";

export default function ProfileScreen() {
  const { logout, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <PlaceholderScreen
        title="我的"
        description="个人档案和设置模块将在后续产品功能阶段接入。"
      />
      <View style={{ padding: 20, gap: 12 }}>
        <AppText>当前账号：{session?.user.phone}</AppText>
        {error ? <AppText>{error}</AppText> : null}
        <Button
          variant="secondary"
          onPress={async () => {
            try {
              setError(null);
              await logout();
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "退出失败，请重试",
              );
            }
          }}
        >
          退出登录
        </Button>
      </View>
    </View>
  );
}
