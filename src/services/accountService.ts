import { supabase } from '../lib/supabaseClient';

export const deleteCurrentAccount = async (): Promise<void> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Não foi possível validar a sessão ativa.');
  }

  const accessToken = data.session.access_token;
  const { data: functionData, error: functionError } = await supabase.functions.invoke<{
    success: boolean;
    message?: string;
  }>('delete-account', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: {}
  });

  if (functionError || !functionData?.success) {
    const message =
      functionError?.message ?? functionData?.message ?? 'Não foi possível concluir a exclusão da conta.';
    throw new Error(message);
  }

  await supabase.auth.signOut();
};
