import React, { createContext, useContext } from 'react';
import { ProfileType, UserProfile } from '../types/profile';

type ProfileContextValue = {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => void;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

type Props = {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => void;
  children: React.ReactNode;
};

export const ProfileProvider: React.FC<Props> = ({ profile, updateProfile, logout, children }) => {
  return (
    <ProfileContext.Provider value={{ profile, updateProfile, logout }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const profileLabels: Record<ProfileType, string> = {
  supplier: 'Fornecedor',
  steel: 'Siderúrgica'
};
