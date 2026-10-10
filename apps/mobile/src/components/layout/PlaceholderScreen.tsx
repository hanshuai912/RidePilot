import { View } from 'react-native';

import { AppText, Badge, Card } from '../ui';
import { Screen } from './Screen';

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <Screen scroll>
      <View className="px-screen pt-4">
        <Badge variant="brand">UI FOUNDATION</Badge>
        <AppText variant="display" className="mt-5">
          {title}
        </AppText>
        <Card className="mt-6">
          <AppText className="text-secondary">{description}</AppText>
          <AppText variant="caption" muted className="mt-4">
            当前仅用于验证导航、安全区和主题基础设施。
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}
