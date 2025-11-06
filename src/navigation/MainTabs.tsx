import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuScreen } from '../screens/MenuScreen';
import { TablesScreen } from '../screens/TablesScreen';
import { ConversationsStack } from './ConversationsStack';
import { colors } from '../theme';
import { MessageNotificationListener } from '../components/MessageNotificationListener';
import { useConversationRead } from '../context/ConversationReadContext';

export type MainTabParamList = {
  Menu: undefined;
  Tabelas: undefined;
  Conversas: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabs: React.FC = () => {
  const { unreadCount } = useConversationRead();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const tabBarHeight = 60 + bottomInset;

  return (
    <>
      <MessageNotificationListener />
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
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 12
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => {
          const icon = getIconName(route.name);
          return <Ionicons name={icon} size={size} color={color} />;
        },
        tabBarBadge: route.name === 'Conversas' && unreadCount > 0 ? unreadCount : undefined,
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600'
        }
      })}
    >
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Tabelas" component={TablesScreen} />
      <Tab.Screen name="Conversas" component={ConversationsStack} options={{ headerShown: false }} />
    </Tab.Navigator>
    </>
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
