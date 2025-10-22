import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const typography = StyleSheet.create({
  headline: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.textPrimary
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary
  }
});
