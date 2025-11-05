import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = (Deno.env.get('NOTIFY_FROM_EMAIL') ?? 'onboarding@resend.dev').trim();
const defaultAdminRecipient = 'gustavocostap11@gmail.com';
const configuredAdminEmail = (Deno.env.get('ADMIN_NOTIFICATION_EMAIL') ?? '').trim();

const adminRecipients = (() => {
  if (fromEmail.endsWith('@resend.dev')) {
    return [defaultAdminRecipient];
  }

  const recipients = new Set<string>();
  if (configuredAdminEmail.length > 0) {
    recipients.add(configuredAdminEmail.toLowerCase());
  }
  recipients.add(defaultAdminRecipient.toLowerCase());
  return Array.from(recipients);
})();
const dashboardUrl = Deno.env.get('ADMIN_DASHBOARD_URL') ?? 'https://carvao-connect-admin.app';

if (!resendApiKey || adminRecipients.length === 0) {
  throw new Error('Missing RESEND_API_KEY or admin recipient configuration.');
}

type SteelPayload = {
  company?: string | null;
  contact?: string | null;
  email: string;
  location?: string | null;
};

const buildHtml = (payload: SteelPayload) => {
  const company = payload.company?.trim() || 'Siderúrgica sem nome';
  const contact = payload.contact?.trim() || 'Não informado';
  const location = payload.location?.trim() || 'Não informado';

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Nova siderúrgica cadastrada</h2>
      <p>Uma nova siderúrgica concluiu o cadastro no Carvão Connect. Confirme o e-mail e valide os dados antes de aprovar.</p>
      <ul style="padding-left: 16px;">
        <li><strong>Empresa:</strong> ${company}</li>
        <li><strong>Responsável:</strong> ${contact}</li>
        <li><strong>E-mail:</strong> ${payload.email}</li>
        <li><strong>Cidade / Estado:</strong> ${location}</li>
      </ul>
      <p style="margin-top: 16px;">
        <a href="${dashboardUrl}" style="background:#1E63F5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Abrir painel administrativo</a>
      </p>
    </div>
  `;
};

serve(async req => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let payload: SteelPayload | null = null;
  try {
    payload = (await req.json()) as SteelPayload;
  } catch (error) {
    return new Response(JSON.stringify({ message: 'Invalid payload', details: String(error) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!payload?.email) {
    return new Response(JSON.stringify({ message: 'Missing email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const html = buildHtml(payload);
  const subject = `Nova siderúrgica cadastrada: ${payload.company?.trim() || payload.email}`;

  console.log('[notify-new-steel] Dispatching email', {
    from: fromEmail,
    to: adminRecipients,
    subject,
    payload
  });

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: adminRecipients,
      subject,
      html
    })
  });

  if (!resendResponse.ok) {
    const details = await resendResponse.text();
    console.error('[notify-new-steel] Failed to send email', details);
    return new Response(JSON.stringify({ message: 'Failed to send email', details }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
