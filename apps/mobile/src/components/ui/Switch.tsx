import { Switch as NativeSwitch } from 'react-native';

import { colors } from '../../theme/colors';

export function Switch({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSwitch
      accessibilityRole="switch"
      disabled={disabled}
      onValueChange={onValueChange}
      thumbColor={value ? colors.brandOn : colors.textMuted}
      trackColor={{ false: colors.surface2, true: colors.brand }}
      value={value}
    />
  );
}
