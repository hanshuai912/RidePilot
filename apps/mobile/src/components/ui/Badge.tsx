import { View } from 'react-native';

import { cn } from '../../lib/cn';
import { AppText } from './AppText';

type BadgeVariant = 'brand' | 'positive' | 'warning' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-subtle',
  positive: 'bg-positive/20',
  warning: 'bg-warning/20',
  neutral: 'bg-surface-2',
};

const textClasses: Record<BadgeVariant, string> = {
  brand: 'text-brand',
  positive: 'text-positive',
  warning: 'text-warning',
  neutral: 'text-secondary',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <View className={cn('self-start rounded-full px-3 py-1.5', variantClasses[variant], className)}>
      <AppText variant="label" className={textClasses[variant]}>
        {children}
      </AppText>
    </View>
  );
}
