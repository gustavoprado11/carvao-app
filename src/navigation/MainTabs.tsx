import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MenuScreen } from '../screens/MenuScreen';
import { TablesScreen } from '../screens/TablesScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { colors } from '../theme';

export type MainTabParamList = {
  Menu: undefined;
  Tabelas: undefined;
  Conversas: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 5,
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: 72,
          paddingBottom: 12,
          paddingTop: 12
        },
        tabBarIcon: ({ color, size }) => {
          const icon = getIconName(route.name);
          return <Ionicons name={icon} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600'
        }
      })}
    >
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Tabelas" component={TablesScreen} />
      <Tab.Screen name="Conversas" component={ConversationsScreen} />
    </Tab.Navigator>
  );
};

const getIconName = (routeName: keyof MainTabParamList): keyof typeof Ionicons.glyphMap => {
  switch (routeName) {
    case 'Menu':
      return 'grid-outline';
    case 'Tabelas':
      return 'bar-chart-outline';
    case 'Conversas':
      return 'chatbubble-ellipses-outline';
    default:
      return 'ellipse-outline';
  }
};
