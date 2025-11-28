import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useProfile } from './ProfileContext';
import { fetchSteelTableByOwner, fetchSupplierTables, persistSteelTable, adminPersistSteelTable } from '../services/tableService';
import type { PricingTable } from '../services/tableService';
import type { ScheduleType, TableRow } from '../types/table';
import type { PriceTableAIResponse } from '../types/priceTableAI';

export type { TableRow } from '../types/table';

type TableState = {
  id: string | null;
  title: string;
  description: string;
  rows: TableRow[];
  notes: string;
  paymentTerms: string;
  scheduleType: ScheduleType;
  isActive: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  lastModifiedByType?: 'admin' | 'owner';
};

export type SupplierTablePreview = {
  id: string;
  company: string;
  location: string;
  route: string;
  updatedAt: string;
  notes: string;
  paymentTerms?: string;
  scheduleType?: ScheduleType;
  rows: TableRow[];
  isActive: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  lastModifiedByType?: 'admin' | 'owner';
};

type TableContextValue = {
  table: TableState;
  addRow: () => void;
  removeRow: (id: string) => void;
  duplicateRow: (id: string) => void;
  updateRow: <K extends keyof TableRow>(id: string, key: K, value: TableRow[K]) => void;
  updateNotes: (value: string) => void;
  updatePaymentTerms: (value: string) => void;
  updateScheduleType: (value: ScheduleType) => void;
  applyImportedData: (data: PriceTableAIResponse) => void;
  toggleActive: (value: boolean) => void;
  saveTable: () => Promise<void>;
  isDirty: boolean;
  supplierTables: SupplierTablePreview[];
  refreshSupplierTables: () => Promise<void>;
  refreshTableData: () => Promise<void>;
  loadTableForOwner: (ownerEmail: string, metadata?: SteelMetadata) => Promise<void>;
  saveTableForOwner: (ownerEmail: string, metadata?: SteelMetadata) => Promise<void>;
  loading: boolean;
};

const defaultRows: TableRow[] = [
  { id: 'row-1', densityMin: '0', densityMax: '199,99', pricePF: '240', pricePJ: '260', unit: 'm3' },
  { id: 'row-2', densityMin: '200', densityMax: '219,99', pricePF: '270', pricePJ: '290', unit: 'm3' },
  { id: 'row-3', densityMin: '220', densityMax: '233', pricePF: '280', pricePJ: '300', unit: 'm3' },
  { id: 'row-4', densityMin: '233', densityMax: '500', pricePF: '1200', pricePJ: '1300', unit: 'tonelada' }
];

const defaultNotes =
  'UMIDADE (%) DESCONTO (R$ POR METRO)\nDe 6% até 10% Desconto excedente no peso\nDe 10,01% acima Desconto total de umidade';

const TableContext = createContext<TableContextValue | undefined>(undefined);

const fallbackUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : fallbackUuid();

const generateTableId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : fallbackUuid();

const mapPricingTableToState = (pricingTable: PricingTable): TableState => ({
  id: pricingTable.id,
  title: pricingTable.title || 'Tabela de Preços',
  description: pricingTable.description || 'Defina as faixas de classificação e os preços correspondentes.',
  notes: pricingTable.notes ?? defaultNotes,
  paymentTerms: pricingTable.paymentTerms ?? '',
  scheduleType: pricingTable.scheduleType ?? 'agendamento',
  isActive: pricingTable.isActive ?? true,
  rows:
    pricingTable.rows.length > 0
      ? pricingTable.rows
      : [...defaultRows.map(row => ({ ...row, id: generateId() }))],
  lastModifiedBy: pricingTable.lastModifiedBy,
  lastModifiedAt: pricingTable.lastModifiedAt,
  lastModifiedByType: pricingTable.lastModifiedByType
});

const mapPricingTableToPreview = (pricingTable: PricingTable): SupplierTablePreview => ({
  id: pricingTable.id,
  company: pricingTable.company ?? 'Empresa não informada',
  location: pricingTable.location ?? 'Localização não informada',
  route: pricingTable.company ?? '—',
  updatedAt: pricingTable.updatedAt ?? 'Atualizado recentemente',
  notes: pricingTable.notes,
  paymentTerms: pricingTable.paymentTerms ?? undefined,
  scheduleType: pricingTable.scheduleType ?? undefined,
  rows: pricingTable.rows,
  isActive: pricingTable.isActive ?? true,
  lastModifiedBy: pricingTable.lastModifiedBy,
  lastModifiedAt: pricingTable.lastModifiedAt,
  lastModifiedByType: pricingTable.lastModifiedByType
});

type Props = {
  children: React.ReactNode;
};

type SteelMetadata = {
  company?: string | null;
  location?: string | null;
};

export const TableProvider: React.FC<Props> = ({ children }) => {
  const { profile } = useProfile();
  const [table, setTable] = useState<TableState>({
    id: null,
    title: 'Tabela de Preços',
    description: 'Defina as faixas de classificação e os preços correspondentes.',
    rows: defaultRows.map(row => ({ ...row })),
    notes: defaultNotes,
    paymentTerms: '',
    scheduleType: 'agendamento',
    isActive: true
  });
  const [supplierTables, setSupplierTables] = useState<SupplierTablePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const syncingRef = useRef(false);

  const refreshSupplierTables = useCallback(async () => {
    setLoading(true);
    try {
      const tables = await fetchSupplierTables();
      setSupplierTables(tables.filter(table => table.isActive !== false).map(mapPricingTableToPreview));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSupplierTables();
  }, [refreshSupplierTables]);

  const refreshSteelTable = useCallback(async () => {
    if (profile.type !== 'steel' || !profile.email) {
      setTable(prev => ({ ...prev, id: null }));
      setIsDirty(false);
      return;
    }
    setLoading(true);
    const remoteTable = await fetchSteelTableByOwner(profile.email);
    if (remoteTable) {
      setTable(mapPricingTableToState(remoteTable));
      setIsDirty(false);
    } else {
      setTable(prev => ({
        ...prev,
        id: null,
        rows: defaultRows.map(row => ({ ...row, id: generateId() })),
        notes: defaultNotes,
        paymentTerms: '',
        scheduleType: 'agendamento',
        isActive: true
      }));
      setIsDirty(true);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    refreshSteelTable();
  }, [refreshSteelTable]);

  const refreshTableData = useCallback(async () => {
    if (profile.type === 'steel') {
      await refreshSteelTable();
      return;
    }
    await refreshSupplierTables();
  }, [profile.type, refreshSteelTable, refreshSupplierTables]);

  const loadTableForOwner = useCallback(
    async (ownerEmail: string, metadata?: SteelMetadata) => {
      setLoading(true);
      try {
        const remoteTable = await fetchSteelTableByOwner(ownerEmail);
        if (remoteTable) {
          const merged = {
            ...remoteTable,
            company: metadata?.company ?? remoteTable.company,
            location: metadata?.location ?? remoteTable.location
          };
          setTable(mapPricingTableToState(merged));
          setIsDirty(false);
          return;
        }
        setTable(prev => ({
          ...prev,
          id: null,
          rows: defaultRows.map(row => ({ ...row, id: generateId() })),
          notes: defaultNotes,
          paymentTerms: '',
          scheduleType: 'agendamento',
          isActive: true
        }));
        setIsDirty(true);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const persistIfSteel = useCallback(
    async (next: TableState) => {
      if (profile.type !== 'steel' || !profile.email) {
        return;
      }
      if (syncingRef.current) {
        return;
      }
      syncingRef.current = true;

      try {
        const persisted = await persistSteelTable(
          profile.email,
          {
            id: next.id ?? generateTableId(),
            title: next.title,
            description: next.description,
            notes: next.notes,
            paymentTerms: next.paymentTerms,
            scheduleType: next.scheduleType,
            isActive: next.isActive,
            rows: next.rows,
            company: profile.company,
            route: profile.company ?? undefined,
            location: profile.location ?? undefined,
            updatedAt: undefined
          },
          profile.company ?? null,
          profile.location ?? null
        );
        if (!persisted) {
          throw new Error('Não foi possível salvar a tabela no servidor.');
        }

        const merged = {
          ...persisted,
          notes: persisted.notes ?? next.notes,
          paymentTerms: persisted.paymentTerms ?? next.paymentTerms,
          scheduleType: persisted.scheduleType ?? next.scheduleType
        } as PricingTable;

        setTable(mapPricingTableToState(merged));
        setIsDirty(false);
        void refreshSupplierTables();
      } finally {
        syncingRef.current = false;
      }
    },
    [profile, refreshSupplierTables]
  );

  const saveCurrentTable = useCallback(async () => {
    if (profile.type !== 'steel' || !profile.email) {
      return;
    }
    await persistIfSteel(table);
  }, [profile, table, persistIfSteel]);

  const value = useMemo<TableContextValue>(() => {
    const addRow = () => {
      setTable(prev => {
        const newRow: TableRow = {
          id: generateId(),
          densityMin: '',
          densityMax: '',
          pricePF: '',
          pricePJ: '',
          unit: 'm3'
        };
        return { ...prev, rows: [...prev.rows, newRow] };
      });
      setIsDirty(true);
    };

    const removeRow = (id: string) => {
      setTable(prev => ({ ...prev, rows: prev.rows.filter(row => row.id !== id) }));
      setIsDirty(true);
    };

    const duplicateRow = (id: string) => {
      setTable(prev => {
        const target = prev.rows.find(row => row.id === id);
        if (!target) {
          return prev;
        }
        const duplicated: TableRow = {
          ...target,
          id: generateId()
        };
        const index = prev.rows.findIndex(row => row.id === id);
        const nextRows = [...prev.rows];
        nextRows.splice(index + 1, 0, duplicated);
        return { ...prev, rows: nextRows };
      });
      setIsDirty(true);
    };

    const updateRow: TableContextValue['updateRow'] = (id, key, value) => {
      setTable(prev => ({
        ...prev,
        rows: prev.rows.map(row => (row.id === id ? { ...row, [key]: value } : row))
      }));
      setIsDirty(true);
    };

    const updateNotes = (notes: string) => {
      setTable(prev => ({ ...prev, notes }));
      setIsDirty(true);
    };

    const updatePaymentTerms = (value: string) => {
      setTable(prev => ({ ...prev, paymentTerms: value }));
      setIsDirty(true);
    };

    const updateScheduleType = (value: ScheduleType) => {
      setTable(prev => ({ ...prev, scheduleType: value }));
      setIsDirty(true);
    };

    const formatNumberToString = (value: number | null | undefined) => {
      if (value === null || value === undefined) {
        return '';
      }
      const parsed = Number.isFinite(value) ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(parsed)) {
        return '';
      }
      return String(parsed).replace('.', ',');
    };

    const applyImportedData = (data: PriceTableAIResponse) => {
      // IA preenche o mesmo estado da tabela existente; não cria novos campos.
      const mappedRows: TableRow[] =
        Array.isArray(data.ranges) && data.ranges.length > 0
          ? data.ranges.slice(0, 10).map(range => {
              const normalizedUnit = typeof range.unit === 'string' ? range.unit.toLowerCase() : null;
              const allowedUnits: TableRow['unit'][] = ['m3', 'tonelada'];
              const resolvedUnit = allowedUnits.includes(normalizedUnit as TableRow['unit'])
                ? (normalizedUnit as TableRow['unit'])
                : 'm3';
              return {
                id: generateId(),
                densityMin: formatNumberToString(range.minDensityKg),
                densityMax: formatNumberToString(range.maxDensityKg),
                pricePF: formatNumberToString(range.pfPrice),
                pricePJ: formatNumberToString(range.pjPrice),
                unit: resolvedUnit
              };
            })
          : [];

      setTable(prev => ({
        ...prev,
        paymentTerms: data.paymentTerms ?? prev.paymentTerms,
        scheduleType:
          data.queueMode === 'agendamento' || data.queueMode === 'fila' ? data.queueMode : prev.scheduleType,
        notes: data.notes ?? prev.notes,
        rows: mappedRows.length > 0 ? mappedRows : prev.rows
      }));
      setIsDirty(true);
    };

    const toggleActive = (value: boolean) => {
      setTable(prev => ({ ...prev, isActive: value }));
      setIsDirty(true);
    };

    const saveTableForOwner = async (ownerEmail: string, metadata?: SteelMetadata) => {
      const normalizedEmail = ownerEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Selecione uma siderúrgica válida antes de salvar.');
      }
      const resolvedCompany = metadata?.company ?? profile.company ?? null;
      const resolvedLocation = metadata?.location ?? profile.location ?? null;

      // USAR adminPersistSteelTable em vez de persistSteelTable
      const persisted = await adminPersistSteelTable(
        normalizedEmail,
        {
          id: table.id ?? generateTableId(),
          title: table.title,
          description: table.description,
          notes: table.notes,
          paymentTerms: table.paymentTerms,
          scheduleType: table.scheduleType,
          isActive: table.isActive,
          rows: table.rows,
          company: resolvedCompany ?? undefined,
          route: resolvedCompany ?? undefined,
          location: resolvedLocation ?? undefined,
          updatedAt: undefined
        },
        resolvedCompany,
        resolvedLocation
      );

      if (!persisted) {
        throw new Error('Não foi possível salvar a tabela.');
      }

      const merged = {
        ...persisted,
        company: resolvedCompany ?? persisted.company,
        location: resolvedLocation ?? persisted.location
      } as PricingTable;

      setTable(mapPricingTableToState(merged));
      setIsDirty(false);
      await refreshSupplierTables();
    };

    return {
      table,
      addRow,
      removeRow,
      duplicateRow,
      updateRow,
      updateNotes,
      updatePaymentTerms,
      updateScheduleType,
      applyImportedData,
      toggleActive,
      saveTable: saveCurrentTable,
      loadTableForOwner,
      saveTableForOwner,
      isDirty,
      supplierTables,
      refreshSupplierTables,
      refreshTableData,
      loading
    };
  }, [
    table,
    saveCurrentTable,
    isDirty,
    supplierTables,
    refreshSupplierTables,
    refreshTableData,
    loading,
    profile,
    loadTableForOwner
  ]);

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
};

export const useTable = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
};
