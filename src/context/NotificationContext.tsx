import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

type PermissionStatus = 'unknown' | 'granted' | 'denied';

type PresentNotificationParams = Notifications.NotificationContentInput & {
  data?: Record<string, unknown>;
};

type NotificationContextValue = {
  status: PermissionStatus;
  supported: boolean;
  requestPermission: () => Promise<PermissionStatus>;
  presentNotification: (params: PresentNotificationParams) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

const isSupportedPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  useEffect(() => {
    if (!isSupportedPlatform) {
      setStatus('denied');
      return;
    }

    const loadPermissions = async () => {
      const settings = await Notifications.getPermissionsAsync();
      const granted =
        settings.granted ||
        (Platform.OS === 'ios' &&
          (settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
            settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED));
      setStatus(granted ? 'granted' : 'denied');
    };

    void loadPermissions();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupportedPlatform) {
      setStatus('denied');
      return 'denied';
    }

    const settings = await Notifications.requestPermissionsAsync();
    const granted =
      settings.granted ||
      (Platform.OS === 'ios' &&
        (settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
          settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED));
    const nextStatus: PermissionStatus = granted ? 'granted' : 'denied';
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  const presentNotification = useCallback(
    async (params: PresentNotificationParams) => {
      if (!isSupportedPlatform) {
        return false;
      }
      const ensureStatus = status === 'granted' ? 'granted' : await requestPermission();
      if (ensureStatus !== 'granted') {
        return false;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          ...params,
          data: params.data ?? {}
        },
        trigger: null
      });
      return true;
    },
    [status, requestPermission]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      status,
      supported: isSupportedPlatform,
      requestPermission,
      presentNotification
    }),
    [status, requestPermission, presentNotification]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
