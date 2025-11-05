import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

serve(async req => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ message: 'Missing access token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const {
    data: userData,
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ message: 'Sessão inválida. Faça login novamente.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const userId = userData.user.id;

  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId);
  if (profileError) {
    console.warn('[delete-account] Failed to delete profile record', profileError);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[delete-account] Failed to delete auth user', deleteError);
    return new Response(JSON.stringify({ message: 'Não foi possível excluir a conta agora.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
