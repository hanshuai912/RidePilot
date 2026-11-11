import { Fragment } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Flag, History, Target } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { profileMetricStyles as styles } from "./profile-metric-card.styles";

const entries = [
  {
    title: "我的赛事",
    hint: "管理赛事、备赛与赛后恢复",
    href: "/races",
    icon: Flag,
  },
  {
    title: "目标",
    hint: "管理目标、阶段与生成课程",
    href: "/goals",
    icon: Target,
  },
  {
    title: "训练历史",
    hint: "按日期查看历史训练与详情",
    href: "/training-history",
    icon: History,
  },
] as const;

export function ProfilePlanningEntries() {
  return entries.map(({ title, hint, href, icon: Icon }, index) => (
    <Fragment key={href}>
      {index > 0 ? <View style={styles.divider} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={hint}
        onPress={() => router.push(href)}
      >
        <View style={styles.row}>
          <View style={styles.icon}>
            <Icon color={colors.brand} size={18} />
          </View>
          <AppText
            className="font-medium leading-[22px]"
            style={[styles.content, styles.title]}
          >
            {title}
          </AppText>
          <ChevronRight color={colors.textMuted} size={18} />
        </View>
      </Pressable>
    </Fragment>
  ));
}
