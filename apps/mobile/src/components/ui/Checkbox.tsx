import { Pressable } from 'react-native';
import { Check } from 'lucide-react-native';

import { cn } from '../../lib/cn';
import { colors } from '../../theme/colors';

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      className={cn(
        'h-6 w-6 items-center justify-center rounded-md border',
        checked ? 'border-brand bg-brand' : 'border-border bg-surface-2',
        disabled && 'opacity-50',
        className,
      )}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
    >
      {checked && <Check color={colors.brandOn} size={16} strokeWidth={3} />}
    </Pressable>
  );
}
