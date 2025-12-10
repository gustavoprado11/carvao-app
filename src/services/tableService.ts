import { supabase } from '../lib/supabaseClient';
import { ScheduleType, TableRow } from '../types/table';

type PricingTableRecord = {
  id: string;
  owner_email?: string | null;
  company?: string | null;
  route?: string | null;
  location?: string | null;
  title: string;
  description: string;
  notes?: string | null;
  payment_terms?: string | null;
  schedule_type?: string | null;
  is_active?: boolean | null;
  updated_at?: string;
  last_modified_by?: string | null;
  last_modified_at?: string | null;
  last_modified_by_type?: string | null;
};

type PricingRowRecord = {
  id: string;
  table_id: string;
  density_min?: string | null;
  density_max?: string | null;
  price_pf?: string | null;
  price_pj?: string | null;
  unit?: string | null;
};

type ProfileLookupRecord = {
  email: string;
  type: string;
  company?: string | null;
  location?: string | null;
  status?: string | null;
};

export type PricingTable = {
  id: string;
  company?: string;
  route?: string;
  location?: string;
  ownerEmail?: string;
  updatedAt?: string;
  title: string;
  description: string;
  notes: string;
  paymentTerms?: string;
  scheduleType?: ScheduleType;
  isActive?: boolean;
  hasTable?: boolean;
  rows: TableRow[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  lastModifiedByType?: 'admin' | 'owner';
};

const TABLES_TABLE = 'pricing_tables';
const ROWS_TABLE = 'pricing_rows';

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

const generateUuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = Math.random() * 16 | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const normalizeRowId = (id?: string | null) => {
  if (id && uuidPattern.test(id)) {
    return id;
  }
  return generateUuid();
};

const mapRowRecord = (record: PricingRowRecord): TableRow => ({
  id: record.id,
  densityMin: record.density_min ?? '',
  densityMax: record.density_max ?? '',
  pricePF: record.price_pf ?? '',
  pricePJ: record.price_pj ?? '',
  unit: (record.unit as TableRow['unit']) ?? 'm3'
});

const mapTableRecord = (record: PricingTableRecord, rows: PricingRowRecord[]): PricingTable => ({
  id: record.id,
  company: record.company ?? undefined,
  route: record.route ?? undefined,
  location: record.location ?? undefined,
  ownerEmail: record.owner_email ?? undefined,
  updatedAt: record.updated_at ?? undefined,
  title: record.title,
  description: record.description,
  notes: record.notes ?? '',
  paymentTerms: record.payment_terms ?? undefined,
  scheduleType: (record.schedule_type as ScheduleType | null) ?? undefined,
  isActive: record.is_active ?? true,
  hasTable: true,
  rows: rows.map(mapRowRecord),
  lastModifiedBy: record.last_modified_by ?? undefined,
  lastModifiedAt: record.last_modified_at ?? undefined,
  lastModifiedByType: (record.last_modified_by_type as 'admin' | 'owner' | null) ?? undefined
});

export const fetchSteelTableByOwner = async (ownerEmail: string): Promise<PricingTable | null> => {
  const { data: tableRecord, error } = await supabase
    .from(TABLES_TABLE)
    .select('id, owner_email, company, route, location, title, description, notes, payment_terms, schedule_type, is_active, updated_at, last_modified_by, last_modified_at, last_modified_by_type')
    .eq('owner_email', ownerEmail.toLowerCase())
    .maybeSingle();

  if (error) {
    console.warn('[Supabase] fetchSteelTableByOwner failed', error);
    return null;
  }

  const resolvedTableRecord = (tableRecord ?? null) as PricingTableRecord | null;

  if (!resolvedTableRecord) {
    return null;
  }

  const { data: rowRecords, error: rowsError } = await supabase
    .from(ROWS_TABLE)
    .select('id, table_id, density_min, density_max, price_pf, price_pj, unit')
    .eq('table_id', resolvedTableRecord.id)
    .order('density_min', { ascending: true });

  if (rowsError) {
    console.warn('[Supabase] fetchSteelTableByOwner rows failed', rowsError);
    return mapTableRecord(resolvedTableRecord, []);
  }

  const resolvedRowRecords = (rowRecords ?? []) as PricingRowRecord[];
  return mapTableRecord(resolvedTableRecord, resolvedRowRecords);
};

export const persistSteelTable = async (
  ownerEmail: string,
  table: PricingTable,
  company?: string | null,
  route?: string | null
): Promise<PricingTable | null> => {
  const normalizedTableId = table.id && uuidPattern.test(table.id) ? table.id : undefined;

  const tablePayload = {
    id: normalizedTableId,
    owner_email: ownerEmail.toLowerCase(),
    company: company ?? null,
    route: route ?? null,
    location: table.location ?? null,
    title: table.title,
    description: table.description,
    notes: table.notes,
    payment_terms: table.paymentTerms ?? null,
    schedule_type: table.scheduleType ?? null,
    is_active: table.isActive ?? true,
    updated_at: new Date().toISOString()
  };

  const { data: upsertedTable, error } = await supabase
    .from(TABLES_TABLE)
    .upsert(tablePayload, { onConflict: 'id' })
    .select('id, owner_email, company, route, location, title, description, notes, payment_terms, schedule_type, is_active, updated_at')
    .single();

  if (error || !upsertedTable) {
    console.warn('[Supabase] persistSteelTable failed', error);
    throw error ?? new Error('Falha ao salvar tabela de preços.');
  }

  const resolvedTableRecord = upsertedTable as PricingTableRecord;
  const resolvedTableId = resolvedTableRecord.id;

  const normalizedRows = table.rows.map(row => ({
    ...row,
    id: normalizeRowId(row.id)
  }));

  const rowsPayload: PricingRowRecord[] = normalizedRows.map(row => ({
    id: row.id,
    table_id: resolvedTableId,
    density_min: row.densityMin,
    density_max: row.densityMax,
    price_pf: row.pricePF,
    price_pj: row.pricePJ,
    unit: row.unit
  }));

  if (rowsPayload.length > 0) {
    const { error: rowsError } = await supabase.from(ROWS_TABLE).upsert(rowsPayload, { onConflict: 'id' });

    if (rowsError) {
      console.warn('[Supabase] persistSteelTable rows upsert failed', rowsError);
      throw rowsError;
    }
  }

  const { data: existingRows, error: fetchExistingError } = await supabase
    .from(ROWS_TABLE)
    .select('id')
    .eq('table_id', resolvedTableId);

  if (fetchExistingError) {
    console.warn('[Supabase] persistSteelTable fetch existing rows failed', fetchExistingError);
  } else if (existingRows) {
    const existingIds = (existingRows as Array<{ id: string }>).map(row => row.id);
    const keepIds = new Set(rowsPayload.map(row => row.id));
    const idsToDelete = existingIds.filter(rowId => !keepIds.has(rowId));
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from(ROWS_TABLE).delete().in('id', idsToDelete);
      if (deleteError) {
        console.warn('[Supabase] persistSteelTable delete rows failed', deleteError);
        throw deleteError;
      }
    }
  }

  const sanitizedRows: PricingRowRecord[] = rowsPayload.map((row: PricingRowRecord) => ({
    id: row.id,
    table_id: resolvedTableId,
    density_min: row.density_min ?? null,
    density_max: row.density_max ?? null,
    price_pf: row.price_pf ?? null,
    price_pj: row.price_pj ?? null,
    unit: row.unit ?? null
  }));

  const result = mapTableRecord(resolvedTableRecord, sanitizedRows);
  const normalizedRowsForState = normalizedRows.map(row => ({
    id: row.id,
    densityMin: row.densityMin ?? '',
    densityMax: row.densityMax ?? '',
    pricePF: row.pricePF ?? '',
    pricePJ: row.pricePJ ?? '',
    unit: row.unit ?? 'm3'
  }));

  return { ...result, rows: normalizedRowsForState };
};

const formatUpdatedAt = (isoDate?: string) => {
  if (!isoDate) {
    return 'Atualizado recentemente';
  }
  const updatedDate = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - updatedDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) {
    return 'Atualizado há alguns minutos';
  }
  if (diffHours < 24) {
    const hours = Math.round(diffHours);
    return `Atualizado há ${hours}h`;
  }
  return `Atualizado em ${updatedDate.toLocaleDateString('pt-BR')}`;
};

type SteelMetadata = {
  company?: string | null;
  location?: string | null;
};

export const syncSteelTableMetadata = async (ownerEmail: string, metadata: SteelMetadata): Promise<void> => {
  const normalizedEmail = ownerEmail.toLowerCase();
  const updatePayload: Record<string, string | null> = {};

  if ('company' in metadata) {
    updatePayload.company = metadata.company?.trim() ?? null;
  }

  if ('location' in metadata) {
    updatePayload.location = metadata.location?.trim() ?? null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await supabase.from(TABLES_TABLE).update(updatePayload).eq('owner_email', normalizedEmail);

  if (error) {
    console.warn('[Supabase] syncSteelTableMetadata failed', error);
  }
};

export const fetchSupplierTables = async (): Promise<PricingTable[]> => {
  let approvedSteelProfiles: ProfileLookupRecord[] = [];
  let fallbackProfileLookupFailed = false;
  const normalizeStatus = (value?: string | null) => value?.trim().toLowerCase() ?? null;

  const { data: approvedProfiles, error: approvedProfilesError } = await supabase.rpc(
    'get_steel_profiles_by_status',
    {
      target_status: 'approved'
    }
  );

  if (!approvedProfilesError && approvedProfiles) {
    const normalizedProfiles = (approvedProfiles as ProfileLookupRecord[]).map(profile => ({
      ...profile,
      status: normalizeStatus(profile.status)
    }));
    approvedSteelProfiles = normalizedProfiles.filter(profile => normalizeStatus(profile.status) === 'approved');
  } else {
    console.warn('[Supabase] fetchSupplierTables approved profiles lookup failed', approvedProfilesError);
    const { data: fallbackProfiles, error: fallbackError } = await supabase
      .from('profiles')
      .select('email, type, company, location, status')
      .eq('type', 'steel')
      .eq('status', 'approved');

    if (!fallbackError && fallbackProfiles) {
      approvedSteelProfiles = (fallbackProfiles as ProfileLookupRecord[]).filter(
        profile => normalizeStatus(profile.status) === 'approved'
      );
    } else {
      fallbackProfileLookupFailed = true;
      console.warn('[Supabase] fetchSupplierTables fallback profile lookup failed', fallbackError);
    }
  }

  const { data: tableRecords, error } = await supabase
    .from(TABLES_TABLE)
    .select(
      'id, owner_email, company, route, location, title, description, notes, payment_terms, schedule_type, is_active, updated_at, last_modified_by, last_modified_at, last_modified_by_type'
    )
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] fetchSupplierTables failed', error);
  }

  const resolvedTableRecords = (tableRecords ?? []) as PricingTableRecord[];
  const tableIds = resolvedTableRecords.map(record => record.id);
  const ownerEmails = Array.from(
    new Set(
      resolvedTableRecords
        .map(record => record.owner_email?.toLowerCase() ?? null)
        .filter((value): value is string => Boolean(value))
    )
  );

  const steelProfilesMap = new Map<string, ProfileLookupRecord>();
  approvedSteelProfiles.forEach(profile => {
    if (profile.email) {
      steelProfilesMap.set(profile.email.toLowerCase(), profile);
    }
  });

  const approvedEmails = new Set<string>(Array.from(steelProfilesMap.keys()));

  if (ownerEmails.length > 0) {
    const { data: ownerProfileRecords, error: ownerProfileError } = await supabase
      .from('profiles')
      .select('email, status, company, location, type')
      .in('email', ownerEmails);

    if (ownerProfileError) {
      console.warn('[Supabase] fetchSupplierTables owner profile lookup failed', ownerProfileError);
    } else if (ownerProfileRecords) {
      (ownerProfileRecords as ProfileLookupRecord[]).forEach(profile => {
        if (normalizeStatus(profile.status) === 'approved' && profile.type === 'steel' && profile.email) {
          const normalizedEmail = profile.email.toLowerCase();
          approvedEmails.add(normalizedEmail);
          if (!steelProfilesMap.has(normalizedEmail)) {
            steelProfilesMap.set(normalizedEmail, profile);
          }
        }
      });
    }
  }

  const { data: rowRecords, error: rowsError } =
    tableIds.length > 0
      ? await supabase
          .from(ROWS_TABLE)
          .select('id, table_id, density_min, density_max, price_pf, price_pj, unit')
          .in('table_id', tableIds)
      : { data: [], error: null };

  if (rowsError) {
    console.warn('[Supabase] fetchSupplierTables rows failed', rowsError);
  }

  const rowsByTable = new Map<string, PricingRowRecord[]>();
  if (!rowsError && rowRecords) {
    (rowRecords as PricingRowRecord[]).forEach(row => {
      const group = rowsByTable.get(row.table_id) ?? [];
      group.push(row);
      rowsByTable.set(row.table_id, group);
    });
  }

  const mappedTables = resolvedTableRecords
    .filter(record => record.is_active !== false)
    .filter(record => {
      const ownerEmail = record.owner_email?.toLowerCase();
      if (!ownerEmail) {
        return false;
      }
      return approvedEmails.has(ownerEmail);
    })
    .map(record => {
      const ownerEmail = record.owner_email?.toLowerCase() ?? '';
      const profile = steelProfilesMap.get(ownerEmail);
      const rowsForTable = rowsByTable.get(record.id) ?? [];
      const mapped = mapTableRecord(record, rowsError ? [] : rowsForTable);
      const companyName = profile?.company ?? mapped.company ?? 'Empresa não informada';
      const location = profile?.location ?? mapped.location ?? null;
      const routeInfo = mapped.route ?? '';
      return {
        ...mapped,
        company: companyName,
        location: location ?? undefined,
        route: routeInfo,
        updatedAt: formatUpdatedAt(record.updated_at),
        isActive: mapped.isActive ?? true,
        ownerEmail: ownerEmail || mapped.ownerEmail,
        hasTable: true
      };
    });

  const ownersWithTable = new Set(
    mappedTables
      .map(table => table.ownerEmail?.toLowerCase() ?? null)
      .filter((value): value is string => Boolean(value))
  );

  const placeholderTables: PricingTable[] =
    fallbackProfileLookupFailed || steelProfilesMap.size === 0
      ? []
      : Array.from(steelProfilesMap.values())
          .map(profile => profile.email?.toLowerCase() ?? null)
          .filter((email): email is string => Boolean(email))
          .filter(email => !ownersWithTable.has(email))
          .map(email => {
            const profile = steelProfilesMap.get(email);
            return {
              id: `placeholder-${email}`,
              company: profile?.company ?? 'Empresa não informada',
              route: profile?.company ?? undefined,
              location: profile?.location ?? undefined,
              ownerEmail: email,
              updatedAt: 'Aguardando tabela',
              title: 'Tabela pendente',
              description: 'Aguardando publicação da siderúrgica',
              notes: '',
              paymentTerms: undefined,
              scheduleType: undefined,
              isActive: true,
              hasTable: false,
              rows: []
            } as PricingTable;
          });

  return [...mappedTables, ...placeholderTables].sort((a, b) => {
    if (a.hasTable !== b.hasTable) {
      return a.hasTable ? -1 : 1;
    }
    return (a.company ?? '').localeCompare(b.company ?? '', 'pt-BR');
  });
};

/**
 * Persiste tabela usando privilégios de admin via RPC admin_upsert_pricing_table
 */
export const adminPersistSteelTable = async (
  ownerEmail: string,
  table: PricingTable,
  company?: string | null,
  location?: string | null
): Promise<PricingTable | null> => {
  const normalizedTableId = table.id && uuidPattern.test(table.id) ? table.id : undefined;

  const tablePayload = {
    id: normalizedTableId ?? null,
    company: company ?? null,
    route: company ?? null,
    location: location ?? null,
    title: table.title,
    description: table.description,
    notes: table.notes,
    payment_terms: table.paymentTerms ?? null,
    schedule_type: table.scheduleType ?? null,
    is_active: table.isActive ?? true
  };

  const normalizedRows = table.rows.map(row => ({
    ...row,
    id: normalizeRowId(row.id)
  }));

  const rowsPayload = normalizedRows.map(row => ({
    id: row.id,
    density_min: row.densityMin,
    density_max: row.densityMax,
    price_pf: row.pricePF,
    price_pj: row.pricePJ,
    unit: row.unit
  }));

  // Chamar RPC admin_upsert_pricing_table
  console.log('[Admin] Chamando admin_upsert_pricing_table para:', ownerEmail.toLowerCase());
  const { data: tableId, error } = await supabase.rpc('admin_upsert_pricing_table', {
    p_owner_email: ownerEmail.toLowerCase(),
    p_table: tablePayload,
    p_rows: rowsPayload
  });

  if (error) {
    console.error('[Supabase] adminPersistSteelTable RPC error:', JSON.stringify(error, null, 2));
    throw error;
  }

  if (!tableId) {
    console.error('[Supabase] adminPersistSteelTable no tableId returned');
    throw new Error('Falha ao salvar tabela como admin - nenhum ID retornado.');
  }

  console.log('[Admin] Tabela salva com sucesso, ID:', tableId);

  // Buscar tabela atualizada com campos de auditoria
  const updatedTable = await fetchSteelTableByOwner(ownerEmail);
  return updatedTable;
};
