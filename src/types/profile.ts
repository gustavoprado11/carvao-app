export type ProfileType = 'supplier' | 'steel' | 'admin';

export type ProfileStatus = 'pending' | 'approved';

export type SupplyAudience = 'pf' | 'pj' | 'both';

export type SupplierDocumentStatus = 'missing' | 'pending' | 'approved' | 'rejected';

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
  documentStatus?: SupplierDocumentStatus;
  documentUrl?: string;
  documentStoragePath?: string;
  documentUploadedAt?: string;
  documentReviewedAt?: string;
  documentReviewedBy?: string;
  documentReviewNotes?: string;
};
