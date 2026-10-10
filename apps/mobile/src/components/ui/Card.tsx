import { View, type ViewProps } from 'react-native';

import { cn } from '../../lib/cn';

export type CardProps = ViewProps & { className?: string };

export function Card({ className, ...props }: CardProps) {
  return <View className={cn('rounded-card border border-border bg-surface p-4', className)} {...props} />;
}
