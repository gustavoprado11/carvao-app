'use client';

import React from 'react';
import { AuthProvider } from './AuthProvider';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthProvider>{children}</AuthProvider>;
};
