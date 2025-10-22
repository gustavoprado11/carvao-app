import 'react-native-gesture-handler';
import React, { useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './screens/AuthScreen';
import { MainTabs } from './navigation/MainTabs';
import { ProfileProvider } from './context/ProfileContext';
import { TableProvider } from './context/TableContext';
import { colors } from './theme';
import { UserProfile } from './types/profile';
import { fetchProfileByEmail, upsertProfile } from './services/profileService';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border
  }
};

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const handleAuthComplete = async (draftProfile: UserProfile) => {
    const existingProfile = await fetchProfileByEmail(draftProfile.email);
    if (existingProfile) {
      const mergedProfile: UserProfile = {
        ...existingProfile,
        type: draftProfile.type,
        company: draftProfile.company ?? existingProfile.company,
        contact: draftProfile.contact ?? existingProfile.contact
      };
      setProfile(mergedProfile);
      await upsertProfile(mergedProfile);
      return;
    }

    const created = await upsertProfile(draftProfile);
    setProfile(created ?? draftProfile);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    let nextProfile: UserProfile | null = null;
    setProfile(prev => {
      if (!prev) {
        nextProfile = prev;
        return prev;
      }
      nextProfile = { ...prev, ...updates };
      return nextProfile;
    });

    if (nextProfile) {
      const saved = await upsertProfile(nextProfile);
      if (saved) {
        setProfile(saved);
      }
    }
  };

  const handleLogout = () => {
    setProfile(null);
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />
        {profile ? (
          <NavigationContainer theme={navigationTheme}>
            <ProfileProvider profile={profile} updateProfile={handleUpdateProfile} logout={handleLogout}>
              <TableProvider>
                <MainTabs />
              </TableProvider>
            </ProfileProvider>
          </NavigationContainer>
        ) : (
          <AuthScreen onAuthComplete={handleAuthComplete} />
        )}
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});

export default App;
