import { View, type ViewProps } from 'react-native';

import { cn } from '../../lib/cn';

export function Separator({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn('h-px w-full bg-divider', className)} {...props} />;
}
