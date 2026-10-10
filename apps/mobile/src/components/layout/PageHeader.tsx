import { View } from 'react-native';

import { cn } from '../../lib/cn';
import { AppText } from '../ui/AppText';

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('mb-6 flex-row items-start justify-between', className)}>
      <View className="flex-1 pr-4">
        <AppText variant="title">{title}</AppText>
        {subtitle && <AppText className="mt-1 text-secondary">{subtitle}</AppText>}
      </View>
      {right}
    </View>
  );
}
