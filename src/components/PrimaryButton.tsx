import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const PrimaryButton: React.FC<Props> = ({ label, onPress, disabled, loading, style }) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        style,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed
      ]}
    >
      <LinearGradient
        colors={
          isDisabled
            ? ['rgba(148,163,184,0.7)', 'rgba(148,163,184,0.7)']
            : [colors.primaryGradientStart, colors.primaryGradientEnd]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {loading ? (
        <ActivityIndicator color={colors.surface} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: 'rgba(0,0,0,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden'
  },
  label: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  disabled: {
    opacity: 0.65
  },
  pressed: {
    transform: [{ scale: 0.99 }]
  }
});
