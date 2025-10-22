import { supabase } from '../lib/supabaseClient';
import { TableRow } from '../types/table';

type PricingTableRecord = {
  id: string;
  owner_email?: string | null;
  company?: string | null;
  route?: string | null;
  title: string;
  description: string;
  notes?: string | null;
  updated_at?: string;
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

export type PricingTable = {
  id: string;
  company?: string;
  route?: string;
  updatedAt?: string;
  title: string;
  description: string;
  notes: string;
  rows: TableRow[];
};

const TABLES_TABLE = 'pricing_tables';
const ROWS_TABLE = 'pricing_rows';

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
  updatedAt: record.updated_at ?? undefined,
  title: record.title,
  description: record.description,
  notes: record.notes ?? '',
  rows: rows.map(mapRowRecord)
});

export const fetchSteelTableByOwner = async (ownerEmail: string): Promise<PricingTable | null> => {
  const { data: tableRecord, error } = await supabase
    .from(TABLES_TABLE)
    .select('id, owner_email, company, route, title, description, notes, updated_at')
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
  const tablePayload = {
    id: table.id,
    owner_email: ownerEmail.toLowerCase(),
    company: company ?? null,
    route: route ?? null,
    title: table.title,
    description: table.description,
    notes: table.notes
  };

  const { data: upsertedTable, error } = await supabase
    .from(TABLES_TABLE)
    .upsert(tablePayload, { onConflict: 'owner_email' })
    .select('id, owner_email, company, route, title, description, notes, updated_at')
    .single();

  if (error || !upsertedTable) {
    console.warn('[Supabase] persistSteelTable failed', error);
    return null;
  }

  const resolvedTableRecord = upsertedTable as PricingTableRecord;
  const resolvedTableId = resolvedTableRecord.id;

  const rowsPayload: PricingRowRecord[] = table.rows.map(row => ({
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

  return mapTableRecord(resolvedTableRecord, sanitizedRows);
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

export const fetchSupplierTables = async (): Promise<PricingTable[]> => {
  const { data: tableRecords, error } = await supabase
    .from(TABLES_TABLE)
    .select('id, company, route, title, description, notes, updated_at')
    .order('updated_at', { ascending: false });

  if (error || !tableRecords) {
    console.warn('[Supabase] fetchSupplierTables failed', error);
    return [];
  }

  const resolvedTableRecords = tableRecords as PricingTableRecord[];
  const tableIds = resolvedTableRecords.map(record => record.id);

  if (tableIds.length === 0) {
    return [];
  }

  const { data: rowRecords, error: rowsError } = await supabase
    .from(ROWS_TABLE)
    .select('id, table_id, density_min, density_max, price_pf, price_pj, unit')
    .in('table_id', tableIds);

  if (rowsError) {
    console.warn('[Supabase] fetchSupplierTables rows failed', rowsError);
    return resolvedTableRecords.map(record => ({
      ...mapTableRecord(record, []),
      updatedAt: formatUpdatedAt(record.updated_at)
    }));
  }

  const rowsByTable = new Map<string, PricingRowRecord[]>();
  const resolvedRows = (rowRecords ?? []) as PricingRowRecord[];
  resolvedRows.forEach(row => {
    const group = rowsByTable.get(row.table_id) ?? [];
    group.push(row);
    rowsByTable.set(row.table_id, group);
  });

  return resolvedTableRecords.map(record => {
    const rowsForTable = rowsByTable.get(record.id) ?? [];
    const mapped = mapTableRecord(record, rowsForTable);
    return { ...mapped, updatedAt: formatUpdatedAt(record.updated_at) };
  });
};
