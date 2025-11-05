import Constants from 'expo-constants';

type ExtraConfig = {
  adminSignupCode?: string;
};

const expoExtra =
  ((Constants.expoConfig as { extra?: ExtraConfig } | null | undefined)?.extra ??
    (Constants.manifest as { extra?: ExtraConfig } | null | undefined)?.extra ??
    {}) as ExtraConfig;

export const adminSignupCode = typeof expoExtra.adminSignupCode === 'string' ? expoExtra.adminSignupCode : '';
