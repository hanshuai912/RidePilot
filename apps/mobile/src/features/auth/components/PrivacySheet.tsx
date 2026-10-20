import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "./AuthButton";
import { authColors as colors } from "./auth-theme";

type PrivacyKind = "welcome" | "login" | "register";
const content: Record<
  PrivacyKind,
  { title: string; text: string; bullets: string[] }
> = {
  welcome: {
    title: "你的数据，由你掌握",
    text: "注册阶段仅收集创建账号所需的号码与密码。后续训练、身体和饮食资料用于生成个人计划，应由对应权限保护。",
    bullets: [
      "测试阶段手机号不代表已验证手机号。",
      "账号密码应安全保存，不向他人展示。",
      "账号与训练资料应分别受到权限保护。",
    ],
  },
  login: {
    title: "账号与数据",
    text: "登录后仅可读取当前账号的训练、身体与饮食资料。开发阶段号码不代表已验证手机号。",
    bullets: [
      "密码错误时保持未登录，已有计划不会改变。",
      "手机号或密码不正确时，不会进入账号。",
      "个人资料应仅用于提供相应的训练与饮食服务。",
    ],
  },
  register: {
    title: "注册前了解这些",
    text: "测试阶段手机号仅作为账号标识，不进行短信验证，也不标记为已验证手机号。",
    bullets: [
      "号码和密码须符合规则；重复号码不能创建新账号。",
      "密码应安全保存，不向他人展示。",
      "个人资料应仅用于提供相应的训练与饮食服务。",
    ],
  },
};

export function PrivacySheet({
  kind,
  visible,
  onClose,
}: {
  kind: PrivacyKind;
  visible: boolean;
  onClose: () => void;
}) {
  const details = content[kind];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityLabel="关闭隐私说明"
      />
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <Text style={styles.title}>{details.title}</Text>
        <Text style={styles.text}>{details.text}</Text>
        <View style={styles.bullets}>
          {details.bullets.map((bullet) => (
            <Text key={bullet} style={styles.text}>
              • {bullet}
            </Text>
          ))}
        </View>
        <AuthButton secondary onPress={onClose}>
          我知道了
        </AuthButton>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "#000A" },
  sheet: {
    backgroundColor: colors.sheet,
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 12,
  },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  text: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  bullets: { gap: 5, marginVertical: 8 },
});
