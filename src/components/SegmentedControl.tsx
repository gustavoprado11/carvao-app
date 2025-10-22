import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
};

export const SegmentedControl = <T extends string>({ value, options, onChange }: Props<T>) => {
  return (
    <View style={styles.container}>
      {options.map(option => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              isActive && styles.activeSegment,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.primaryMuted,
    borderRadius: spacing.lg,
    padding: spacing.xs
  },
  segment: {
    flex: 1,
    borderRadius: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  activeSegment: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary
  },
  activeLabel: {
    color: colors.textPrimary
  },
  pressed: {
    opacity: 0.8
  }
});
