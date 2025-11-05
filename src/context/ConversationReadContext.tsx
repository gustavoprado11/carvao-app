import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import { fetchConversationsByProfile } from '../services/conversationService';
import { ConversationPreview } from '../types/conversation';
import { useProfile } from './ProfileContext';

type ConversationReadContextValue = {
  unreadCount: number;
  isConversationUnread: (conversationId: string, lastMessageAt: string) => boolean;
  markConversationRead: (conversationId: string, lastMessageAt?: string) => Promise<void>;
  recordConversationsSnapshot: (conversations: ConversationPreview[]) => void;
  registerConversationUpdate: (conversationId: string, lastMessageAt: string) => void;
  setActiveConversation: (conversationId: string | null) => void;
};

const ConversationReadContext = createContext<ConversationReadContextValue | undefined>(undefined);

type StoredReadMap = Record<string, string>;

const getStorageKey = (email: string) => `conversation-reads:${email.toLowerCase()}`;

export const ConversationReadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useProfile();
  const [readMap, setReadMap] = useState<StoredReadMap>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const latestConversationsRef = useRef<Record<string, string>>({});
  const readMapRef = useRef<StoredReadMap>({});
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activeConversationRef = useRef<string | null>(null);

  const computeUnread = useCallback((snapshot: Record<string, string>, map: StoredReadMap) => {
    const count = Object.entries(snapshot).reduce((acc, [conversationId, lastMessageAtString]) => {
      const lastMessageAt = new Date(lastMessageAtString).getTime();
      if (Number.isNaN(lastMessageAt)) {
        return acc;
      }
      const lastReadAt = map[conversationId] ? new Date(map[conversationId]).getTime() : 0;
      if (lastMessageAt > lastReadAt) {
        return acc + 1;
      }
      return acc;
    }, 0);

    setUnreadCount(prev => {
      if (prev !== count) {
        return count;
      }
      return prev;
    });
    Notifications.setBadgeCountAsync(count).catch(error =>
      console.warn('[ConversationRead] Failed to update badge count', error)
    );
  }, []);

  const loadReadState = useCallback(async () => {
    if (!profile.email) {
      setReadMap({});
      readMapRef.current = {};
      setUnreadCount(0);
      Notifications.setBadgeCountAsync(0).catch(error =>
        console.warn('[ConversationRead] Failed to update badge count', error)
      );
      return;
    }
    try {
      const stored = await AsyncStorage.getItem(getStorageKey(profile.email));
      const parsed = stored ? (JSON.parse(stored) as StoredReadMap) : {};
      setReadMap(parsed);
      readMapRef.current = parsed;
      computeUnread(latestConversationsRef.current, parsed);
    } catch (error) {
      console.warn('[ConversationRead] Failed to load read map', error);
      setReadMap({});
      readMapRef.current = {};
      const count = Object.keys(latestConversationsRef.current).length;
      setUnreadCount(count);
      Notifications.setBadgeCountAsync(count).catch(error =>
        console.warn('[ConversationRead] Failed to update badge count', error)
      );
    }
  }, [profile.email, computeUnread]);

  useEffect(() => {
    void loadReadState();
  }, [loadReadState]);

  const persistReadMap = useCallback(
    async (nextMap: StoredReadMap) => {
      if (!profile.email) {
        return;
      }
      try {
        await AsyncStorage.setItem(getStorageKey(profile.email), JSON.stringify(nextMap));
      } catch (error) {
        console.warn('[ConversationRead] Failed to persist read map', error);
      }
    },
    [profile.email]
  );

  const isConversationUnread = useCallback(
    (conversationId: string, lastMessageAt: string) => {
      const lastMessage = new Date(lastMessageAt).getTime();
      if (Number.isNaN(lastMessage)) {
        return false;
      }
      const lastRead = readMap[conversationId] ? new Date(readMap[conversationId]).getTime() : 0;
      return lastMessage > lastRead;
    },
    [readMap]
  );

  const markConversationRead = useCallback(
    async (conversationId: string, lastMessageAt?: string) => {
      if (!conversationId) {
        return;
      }
      setReadMap(prev => {
        const latestSnapshotTimestamp = latestConversationsRef.current[conversationId];
        const timestamp = lastMessageAt ?? latestSnapshotTimestamp ?? new Date().toISOString();
        const next = {
          ...prev,
          [conversationId]: timestamp
        };
        readMapRef.current = next;
        computeUnread(latestConversationsRef.current, next);
        void persistReadMap(next);
        return next;
      });
    },
    [computeUnread, persistReadMap]
  );

  const recordConversationsSnapshot = useCallback(
    (conversations: ConversationPreview[]) => {
      const snapshot = conversations.reduce<Record<string, string>>((acc, conversation) => {
        if (conversation.id && conversation.lastMessageAt) {
          acc[conversation.id] = conversation.lastMessageAt;
        }
        return acc;
      }, {});
      latestConversationsRef.current = snapshot;
      computeUnread(snapshot, readMapRef.current);
    },
    [computeUnread]
  );

  const registerConversationUpdate = useCallback(
    (conversationId: string, lastMessageAt: string) => {
      if (!conversationId || !lastMessageAt) {
        return;
      }
      latestConversationsRef.current = {
        ...latestConversationsRef.current,
        [conversationId]: lastMessageAt
      };
      if (activeConversationRef.current === conversationId && appStateRef.current === 'active') {
        void markConversationRead(conversationId, lastMessageAt);
        return;
      }
      computeUnread(latestConversationsRef.current, readMapRef.current);
    },
    [computeUnread, markConversationRead]
  );

  const setActiveConversation = useCallback(
    (conversationId: string | null) => {
      activeConversationRef.current = conversationId;
      if (conversationId) {
        const lastKnown = latestConversationsRef.current[conversationId];
        if (lastKnown) {
          void markConversationRead(conversationId, lastKnown);
        }
      }
    },
    [markConversationRead]
  );

  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && state === 'active') {
        void loadReadState();
      }
      appStateRef.current = state;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [loadReadState]);

  useEffect(() => {
    if (!profile.email) {
      latestConversationsRef.current = {};
      setUnreadCount(0);
      Notifications.setBadgeCountAsync(0).catch(error =>
        console.warn('[ConversationRead] Failed to update badge count', error)
      );
      return;
    }
    const syncExistingConversations = async () => {
      try {
        const data = await fetchConversationsByProfile(profile.email ?? '', profile.type);
        const snapshot = data.reduce<Record<string, string>>((acc, conversation) => {
          if (conversation.id && conversation.lastMessageAt) {
            acc[conversation.id] = conversation.lastMessageAt;
          }
          return acc;
        }, {});
        latestConversationsRef.current = snapshot;
        computeUnread(snapshot, readMapRef.current);
      } catch (error) {
        console.warn('[ConversationRead] Failed to prefetch conversations', error);
      }
    };
    void syncExistingConversations();
  }, [profile.email, profile.type, computeUnread]);

  useEffect(() => {
    return () => {
      Notifications.setBadgeCountAsync(0).catch(error =>
        console.warn('[ConversationRead] Failed to reset badge count on cleanup', error)
      );
    };
  }, []);

  useEffect(() => {
    Notifications.setBadgeCountAsync(unreadCount).catch(error =>
      console.warn('[ConversationRead] Failed to sync badge count', error)
    );
  }, [unreadCount]);

  const value = useMemo(
    () => ({
      unreadCount,
      isConversationUnread,
      markConversationRead,
      recordConversationsSnapshot,
      registerConversationUpdate,
      setActiveConversation
    }),
    [unreadCount, isConversationUnread, markConversationRead, recordConversationsSnapshot, registerConversationUpdate, setActiveConversation]
  );

  return <ConversationReadContext.Provider value={value}>{children}</ConversationReadContext.Provider>;
};

export const useConversationRead = () => {
  const context = useContext(ConversationReadContext);
  if (!context) {
    throw new Error('useConversationRead must be used within a ConversationReadProvider');
  }
  return context;
};
