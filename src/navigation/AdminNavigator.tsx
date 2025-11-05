import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminSteelApprovalsScreen } from '../screens/AdminSteelApprovalsScreen';
import { colors } from '../theme';

export type AdminStackParamList = {
  SteelApprovals: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export const AdminNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary }
      }}
    >
      <Stack.Screen
        name="SteelApprovals"
        component={AdminSteelApprovalsScreen}
        options={{ title: 'Administração' }}
      />
    </Stack.Navigator>
  );
};
