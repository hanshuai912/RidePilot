import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RidePilot</Text>
      <Text style={styles.subtitle}>移动端基础工程已就绪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  title: { color: colors.brand, fontSize: typography.title, fontWeight: '600' },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, marginTop: spacing.sm },
});
