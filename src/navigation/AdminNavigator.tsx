import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminSteelApprovalsScreen } from '../screens/AdminSteelApprovalsScreen';
import { AdminSupplierApprovalsScreen } from '../screens/AdminSupplierApprovalsScreen';
import { colors } from '../theme';

export type AdminStackParamList = {
  SupplierApprovals: undefined;
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
        name="SupplierApprovals"
        component={AdminSupplierApprovalsScreen}
        options={({ navigation }) => ({
          title: 'Administração',
          headerRight: () => (
            <TextButton label="Siderúrgicas" onPress={() => navigation.navigate('SteelApprovals')} />
          )
        })}
      />
      <Stack.Screen
        name="SteelApprovals"
        component={AdminSteelApprovalsScreen}
        options={({ navigation }) => ({
          title: 'Administração',
          headerRight: () => (
            <TextButton label="Fornecedores" onPress={() => navigation.navigate('SupplierApprovals')} />
          )
        })}
      />
    </Stack.Navigator>
  );
};

const TextButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
  <Text
    onPress={onPress}
    style={{
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
      paddingHorizontal: 8
    }}
  >
    {label}
  </Text>
);
