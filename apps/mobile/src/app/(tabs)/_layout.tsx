import { Tabs } from 'expo-router';

import { colors, layout } from '../../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.border,
          height: layout.tapMin + 28,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarLabel: '首页' }} />
      <Tabs.Screen name="training" options={{ title: '训练', tabBarLabel: '训练' }} />
      <Tabs.Screen name="nutrition" options={{ title: '饮食', tabBarLabel: '饮食' }} />
      <Tabs.Screen name="coach" options={{ title: 'AI 教练', tabBarLabel: 'AI 教练' }} />
      <Tabs.Screen name="profile" options={{ title: '我的', tabBarLabel: '我的' }} />
    </Tabs>
  );
}
