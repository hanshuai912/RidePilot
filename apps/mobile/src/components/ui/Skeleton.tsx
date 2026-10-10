import { View } from 'react-native';

import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <View className={cn('rounded-lg bg-surface-2', className)} />;
}
