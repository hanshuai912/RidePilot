import { Pressable, View } from 'react-native';

import { cn } from '../../lib/cn';
import { AppText } from './AppText';

export type TabOption = { key: string; label: string };

export function Tabs({
  options,
  value,
  onValueChange,
  className,
}: {
  options: TabOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <View className={cn('flex-row rounded-xl bg-surface-2 p-1', className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={cn('flex-1 items-center rounded-lg px-3 py-2.5', selected && 'bg-elevated')}
            key={option.key}
            onPress={() => onValueChange(option.key)}
          >
            <AppText variant="label" className={selected ? 'text-brand' : 'text-muted'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
