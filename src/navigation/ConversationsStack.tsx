import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ConversationDetailScreen } from '../screens/ConversationDetailScreen';

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
        options={({ route }) => ({
          title: route.params.counterpartName,
          headerBackTitle: 'Voltar'
        })}
      />
    </Stack.Navigator>
  );
};
