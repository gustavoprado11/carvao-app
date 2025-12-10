import React, { useMemo, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSubscription } from '../context/SubscriptionContext';
import { SupplierOnboardingScreen, type SupplierOnboardingStep } from './SupplierOnboardingScreen';
import { SupplierVerificationPendingScreen } from './SupplierVerificationPendingScreen';
import { NotificationProvider } from '../context/NotificationContext';
import { ConversationReadProvider } from '../context/ConversationReadContext';
import { TableProvider } from '../context/TableContext';
import { MainTabs } from '../navigation/MainTabs';
import { PushTokenRegistrar } from '../components/PushTokenRegistrar';

export const SupplierAccessGate: React.FC = () => {
  const { profile } = useProfile();
  const { activeReceipt } = useSubscription();
  const [isEditingDocument, setIsEditingDocument] = useState(false);

  const documentStatus = useMemo(() => profile.documentStatus ?? 'missing', [profile.documentStatus]);
  const hasSupplierDraft = useMemo(() => {
    if (profile.type !== 'supplier') {
      return false;
    }
    return Boolean(
      profile.company &&
        profile.contact &&
        profile.location &&
        profile.supplyAudience &&
        profile.averageDensityKg &&
        profile.averageMonthlyVolumeM3
    );
  }, [
    profile.averageDensityKg,
    profile.averageMonthlyVolumeM3,
    profile.company,
    profile.contact,
    profile.location,
    profile.supplyAudience,
    profile.type
  ]);

  const resolvedInitialStep: SupplierOnboardingStep =
    documentStatus === 'rejected' || hasSupplierDraft ? 'document' : 'company';
  const onboardingStep = isEditingDocument ? 'document' : resolvedInitialStep;

  if (documentStatus === 'missing' || documentStatus === 'rejected' || isEditingDocument) {
    return (
      <SupplierOnboardingScreen
        onCompleted={() => setIsEditingDocument(false)}
        onCancel={isEditingDocument ? () => setIsEditingDocument(false) : undefined}
        initialStep={onboardingStep}
      />
    );
  }

  if (documentStatus === 'pending') {
    return <SupplierVerificationPendingScreen onUploadNew={() => setIsEditingDocument(true)} />;
  }

  return (
    <NotificationProvider>
      <PushTokenRegistrar />
      <ConversationReadProvider>
        <TableProvider>
          <MainTabs />
        </TableProvider>
      </ConversationReadProvider>
    </NotificationProvider>
  );
};
