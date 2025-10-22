export type ProfileType = 'supplier' | 'steel';

export type UserProfile = {
  id?: string;
  type: ProfileType;
  email: string;
  company?: string;
  contact?: string;
};
