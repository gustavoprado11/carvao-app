import React, { useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useProfile } from '../context/ProfileContext';
import { registerPushToken } from '../services/pushTokenService';

export const PushTokenRegistrar: React.FC = () => {
  const { profile } = useProfile();
  const { getExpoPushToken, supported, status, requestPermission } = useNotifications();

  useEffect(() => {
    const syncToken = async () => {
      if (!supported || !profile.email) {
        return;
      }
      if (status !== 'granted') {
        const permission = await requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }
      const token = await getExpoPushToken();
      if (token) {
        await registerPushToken(profile.email, token);
      }
    };

    void syncToken();
  }, [supported, profile.email, status, requestPermission, getExpoPushToken]);

  return null;
};
