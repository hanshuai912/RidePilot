import { ActivityIndicator } from 'react-native';

import { colors } from '../../theme/colors';

export function Spinner({ size = 'small' }: { size?: 'small' | 'large' }) {
  return <ActivityIndicator color={colors.brand} size={size} />;
}
