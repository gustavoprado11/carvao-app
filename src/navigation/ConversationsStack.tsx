import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ConversationDetailScreen } from '../screens/ConversationDetailScreen';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export type ConversationsStackParamList = {
  ConversationList: undefined;
  ConversationDetail: {
    conversationId: string;
    supplierEmail: string;
    steelEmail: string;
    counterpartName: string;
  };
};

const Stack = createNativeStackNavigator<ConversationsStackParamList>();

export const ConversationsStack: React.FC = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ConversationList"
        component={ConversationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConversationDetail"
        component={ConversationDetailScreen}
        options={({ route, navigation }) => ({
          headerTitle: () => (
            <Text
              style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}
              numberOfLines={1}
            >
              {route.params.counterpartName}
            </Text>
          ),
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: spacing.sm
              }}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          )
        })}
      />
    </Stack.Navigator>
  );
};
