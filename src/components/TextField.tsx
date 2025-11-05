import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, spacing } from '../theme';

type Props = TextInputProps & {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const TextField: React.FC<Props> = ({ leading, trailing, style, ...props }) => {
  return (
    <View style={styles.container}>
      {leading ? <View style={styles.accessory}>{leading}</View> : null}
      <TextInput
        placeholderTextColor="rgba(248,250,252,0.65)"
        style={[styles.input, style]}
        {...props}
      />
      {trailing ? <View style={styles.accessory}>{trailing}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassSurface,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs
  },
  accessory: {
    marginHorizontal: spacing.xs
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.surface,
    paddingVertical: spacing.xs
  }
});
