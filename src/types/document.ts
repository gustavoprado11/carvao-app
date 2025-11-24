export type DocumentStatus = 'missing' | 'pending' | 'shared' | 'expired' | 'rejected' | 'uploaded';

export type DocumentItem = {
  id: string;
  typeId: string;
  title: string;
  description?: string;
  status: DocumentStatus;
  sharedWith?: string[];
  updatedAt?: string;
  url?: string;
  path?: string;
  sizeBytes?: number;
  supplierId?: string;
  supplierName?: string;
  supplierLocation?: string;
};
