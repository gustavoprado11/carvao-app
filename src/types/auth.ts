import { UserProfile } from './profile';

export type AuthMode = 'signIn' | 'signUp';

export type AuthPayload = {
  mode: AuthMode;
  profile: UserProfile;
  password: string;
  otpVerified?: boolean;
};
