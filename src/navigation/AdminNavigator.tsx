import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminSteelApprovalsScreen } from '../screens/AdminSteelApprovalsScreen';
import { AdminSupplierApprovalsScreen } from '../screens/AdminSupplierApprovalsScreen';
import { TablesScreen } from '../screens/TablesScreen';
import { colors } from '../theme';

export type AdminStackParamList = {
  SupplierApprovals: undefined;
  SteelApprovals: undefined;
  SteelTables: undefined;
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
          headerRight: () => <AdminHeaderNav navigation={navigation} current="SupplierApprovals" />
        })}
      />
      <Stack.Screen
        name="SteelApprovals"
        component={AdminSteelApprovalsScreen}
        options={({ navigation }) => ({
          title: 'Administração',
          headerRight: () => <AdminHeaderNav navigation={navigation} current="SteelApprovals" />
        })}
      />
      <Stack.Screen
        name="SteelTables"
        component={TablesScreen}
        options={({ navigation }) => ({
          title: 'Administração',
          headerRight: () => <AdminHeaderNav navigation={navigation} current="SteelTables" />
        })}
      />
    </Stack.Navigator>
  );
};

const AdminHeaderNav: React.FC<{ navigation: any; current: keyof AdminStackParamList }> = ({
  navigation,
  current
}) => (
  <Text
    onPress={() => {
      const next =
        current === 'SupplierApprovals'
          ? 'SteelApprovals'
          : current === 'SteelApprovals'
          ? 'SteelTables'
          : 'SupplierApprovals';
      navigation.navigate(next);
    }}
    style={{
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
      paddingHorizontal: 8
    }}
  >
    {current === 'SupplierApprovals' ? 'Siderúrgicas' : current === 'SteelApprovals' ? 'Tabelas' : 'Fornecedores'}
  </Text>
);
