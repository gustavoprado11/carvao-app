export type ProfileType = 'supplier' | 'steel' | 'admin';

export type ProfileStatus = 'pending' | 'approved';

export type SupplyAudience = 'pf' | 'pj' | 'both';

export type UserProfile = {
  id?: string;
  type: ProfileType;
  email: string;
  company?: string;
  contact?: string;
  location?: string;
  supplyAudience?: SupplyAudience;
  averageDensityKg?: string;
  averageMonthlyVolumeM3?: string;
  status?: ProfileStatus;
};
