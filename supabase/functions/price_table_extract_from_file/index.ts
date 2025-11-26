import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// Usa versão compatível publicada no deno.land (v4.24.0 está disponível e estável).
import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
const openAiModel = Deno.env.get('PRICE_TABLE_OPENAI_MODEL') ?? 'gpt-4o-mini';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

if (!openAiApiKey) {
  console.warn('[price_table_extract_from_file] OPENAI_API_KEY is not configured.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const openai = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });

const mapOpenAiErrorMessage = (message: string, status?: number) => {
  if (status === 429 || message?.includes('429')) {
    return 'Limite da IA atingido. Verifique o plano ou créditos da conta OpenAI.';
  }
  return `Falha ao processar no modelo. ${message || 'Erro desconhecido.'}`;
};

const toBase64DataUrl = async (file: File) => {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return `data:${file.type || 'application/octet-stream'};base64,${base64}`;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type PriceTableAiResponse = {
  paymentTerms?: string;
  queueMode?: 'agendamento' | 'fila' | null;
  ranges: Array<{
    minDensityKg?: number | null;
    maxDensityKg?: number | null;
    pfPrice?: number | null;
    pjPrice?: number | null;
    unit?: string | null;
    notes?: string | null;
  }>;
  notes?: string | null;
};

serve(async req => {
  try {
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: true, message: 'Method not allowed' });
    }

    const token = req.headers.get('Authorization')?.replace('Bearer', '').trim();
    if (!token) {
      return jsonResponse(401, { error: true, message: 'Sessão inválida. Faça login novamente.' });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse(401, { error: true, message: 'Sessão inválida. Faça login novamente.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('type, email')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('[price_table_extract_from_file] profile lookup failed', profileError);
      return jsonResponse(500, { error: true, message: 'Erro ao validar permissões.' });
    }

    if (!profile || profile.type !== 'steel') {
      return jsonResponse(403, { error: true, message: 'Apenas siderúrgicas podem importar tabelas.' });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonResponse(400, { error: true, message: 'Arquivo inválido ou ausente.' });
    }

    if (!file.type || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
      return jsonResponse(400, { error: true, message: 'Formato não suportado. Envie imagem ou PDF.' });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse(400, { error: true, message: 'Formato não suportado. Envie imagem ou PDF.' });
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(400, { error: true, message: 'Arquivo muito grande. Limite de 10MB.' });
    }

    if (!openai) {
      console.error('[price_table_extract_from_file] missing OPENAI_API_KEY');
      return jsonResponse(500, { error: true, message: 'Serviço indisponível (OPENAI_API_KEY ausente).' });
    }

    const encodedFile = await toBase64DataUrl(file);

    const systemPrompt =
      'Você é um assistente especializado em interpretar tabelas de preços de compra de carvão vegetal de ' +
      'siderúrgicas brasileiras. A partir da imagem ou PDF da tabela de preços, extraia: forma de pagamento, ' +
      'modo de operação (agendamento ou fila), faixas de densidade ou classificação, preço PF e preço PJ, ' +
      'unidade de pagamento (tonelada, m³, saco, etc.) e observações importantes. ' +
      'Retorne APENAS um JSON válido com o formato: ' +
      '{ "paymentTerms": string?, "queueMode": "agendamento" | "fila" | null, "ranges": [{ "minDensityKg": number|null, "maxDensityKg": number|null, "pfPrice": number|null, "pjPrice": number|null, "unit": string|null, "notes": string|null }], "notes": string|null }. ' +
      'Não inclua comentários, markdown ou qualquer texto fora do JSON.';

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: openAiModel,
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Analise a tabela de preços de compra de carvão vegetal e retorne apenas o JSON no formato solicitado.'
              },
              { type: 'image_url', image_url: { url: encodedFile } }
            ]
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'price_table_extract_from_file',
            schema: {
              type: 'object',
              properties: {
                paymentTerms: { type: ['string', 'null'] },
                queueMode: { type: ['string', 'null'], enum: ['agendamento', 'fila', null] },
                ranges: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      minDensityKg: { type: ['number', 'null', 'string'] },
                      maxDensityKg: { type: ['number', 'null', 'string'] },
                      pfPrice: { type: ['number', 'null', 'string'] },
                      pjPrice: { type: ['number', 'null', 'string'] },
                      unit: { type: ['string', 'null'] },
                      notes: { type: ['string', 'null'] }
                    },
                    required: ['minDensityKg', 'maxDensityKg', 'pfPrice', 'pjPrice', 'unit', 'notes'],
                    additionalProperties: false
                  }
                },
                notes: { type: ['string', 'null'] }
              },
              required: ['paymentTerms', 'queueMode', 'ranges', 'notes'],
              additionalProperties: false
            },
            strict: true
          }
        }
      });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : 'Erro desconhecido.';
      console.error('[price_table_extract_from_file] openai call failed', { status, message, error });
      return jsonResponse(status && status >= 400 ? status : 500, {
        error: true,
        message: mapOpenAiErrorMessage(message, status)
      });
    }

    const choice = completion.choices?.[0];
    if (!choice || choice.finish_reason === 'length') {
      console.warn('[price_table_extract_from_file] completion missing content', { finish: choice?.finish_reason });
      return jsonResponse(500, {
        error: true,
        message: 'Não foi possível ler a tabela. Tente tirar outra foto ou enviar um arquivo mais nítido.'
      });
    }

    const rawContent = choice.message?.content?.trim() ?? '';
    const sanitized = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed: PriceTableAiResponse | null = null;
    try {
      parsed = JSON.parse(sanitized) as PriceTableAiResponse;
    } catch (error) {
      console.warn('[price_table_extract_from_file] JSON parse failed', error, { rawContent });
      return jsonResponse(422, {
        error: true,
        message: 'Não foi possível ler a tabela. Tente tirar outra foto ou enviar um arquivo mais nítido.'
      });
    }

    const normalizedRanges =
      Array.isArray(parsed.ranges) && parsed.ranges.length > 0
        ? parsed.ranges.slice(0, 10).map(range => ({
            minDensityKg: normalizeNumber(range.minDensityKg),
            maxDensityKg: normalizeNumber(range.maxDensityKg),
            pfPrice: normalizeNumber(range.pfPrice),
            pjPrice: normalizeNumber(range.pjPrice),
            unit: typeof range.unit === 'string' ? range.unit : null,
            notes: typeof range.notes === 'string' ? range.notes : null
          }))
        : [];

    const responseBody: PriceTableAiResponse = {
      paymentTerms: typeof parsed.paymentTerms === 'string' ? parsed.paymentTerms : undefined,
      queueMode: parsed.queueMode === 'fila' || parsed.queueMode === 'agendamento' ? parsed.queueMode : null,
      ranges: normalizedRanges,
      notes: typeof parsed.notes === 'string' ? parsed.notes : null
    };

    return jsonResponse(200, responseBody);
  } catch (error) {
    console.error('[price_table_extract_from_file] unexpected error', error);
    return jsonResponse(500, {
      error: true,
      message: 'Não foi possível ler a tabela. Tente tirar outra foto ou enviar um arquivo mais nítido.'
    });
  }
});
