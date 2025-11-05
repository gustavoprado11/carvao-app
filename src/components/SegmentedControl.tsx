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
    backgroundColor: colors.glassSurface,
    borderRadius: spacing.xxl,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.xs
  },
  segment: {
    flex: 1,
    borderRadius: spacing.xxl,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  activeSegment: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary
  },
  activeLabel: {
    color: colors.surface
  },
  pressed: {
    opacity: 0.8
  }
});
