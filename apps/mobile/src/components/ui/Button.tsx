import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '../../lib/cn';
import { colors } from '../../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand',
  secondary: 'border border-border bg-surface-2',
  ghost: 'bg-transparent',
  danger: 'bg-negative',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[40px] px-3',
  md: 'min-h-[48px] px-4',
  lg: 'min-h-[52px] px-5',
};

const textColors: Record<ButtonVariant, string> = {
  primary: colors.brandOn,
  secondary: colors.textPrimary,
  ghost: colors.brand,
  danger: colors.brandOn,
};

export type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'flex-row items-center justify-center rounded-xl',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-50',
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} />
      ) : (
        <Text
          style={{
            color: textColors[variant],
            fontSize: 15,
            lineHeight: 20,
            fontWeight:
              variant === 'secondary' || variant === 'ghost' ? '600' : '700',
          }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
