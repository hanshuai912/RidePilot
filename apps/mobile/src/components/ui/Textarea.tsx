import { Input, type InputProps } from './Input';

export function Textarea({ className, ...props }: InputProps) {
  return (
    <Input
      className={className}
      multiline
      textAlignVertical="top"
      style={[{ minHeight: 120, paddingTop: 14 }, props.style]}
      {...props}
    />
  );
}
