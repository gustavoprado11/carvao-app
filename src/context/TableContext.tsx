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
import { fetchSteelTableByOwner, fetchSupplierTables, persistSteelTable } from '../services/tableService';
import type { PricingTable } from '../services/tableService';
import type { TableRow } from '../types/table';

export type { TableRow } from '../types/table';

type TableState = {
  id: string | null;
  title: string;
  description: string;
  rows: TableRow[];
  notes: string;
};

export type SupplierTablePreview = {
  id: string;
  company: string;
  route: string;
  updatedAt: string;
  notes: string;
  rows: TableRow[];
};

type TableContextValue = {
  table: TableState;
  addRow: () => void;
  removeRow: (id: string) => void;
  updateRow: <K extends keyof TableRow>(id: string, key: K, value: TableRow[K]) => void;
  updateNotes: (value: string) => void;
  supplierTables: SupplierTablePreview[];
  refreshSupplierTables: () => Promise<void>;
  loading: boolean;
};

const defaultRows: TableRow[] = [
  { id: 'row-1', densityMin: '0', densityMax: '199,99', pricePF: '240', pricePJ: '260', unit: 'm3' },
  { id: 'row-2', densityMin: '200', densityMax: '219,99', pricePF: '270', pricePJ: '290', unit: 'm3' },
  { id: 'row-3', densityMin: '220', densityMax: '233', pricePF: '280', pricePJ: '300', unit: 'm3' },
  { id: 'row-4', densityMin: '233', densityMax: '500', pricePF: '1200', pricePJ: '1300', unit: 'tonelada' }
];

const fallbackSupplierTables: SupplierTablePreview[] = [
  {
    id: 'fallback-vale',
    company: 'Siderúrgica Vale Azul',
    route: 'Logística Sul • Contrato trimestral',
    updatedAt: 'Atualizado há 2h',
    notes: 'Descontos progressivos por umidade acima de 6% aplicado ao peso líquido.',
    rows: [
      { id: 'fv-1', densityMin: '0', densityMax: '199,99', pricePF: '240', pricePJ: '260', unit: 'm3' },
      { id: 'fv-2', densityMin: '200', densityMax: '219,99', pricePF: '270', pricePJ: '290', unit: 'm3' },
      { id: 'fv-3', densityMin: '220', densityMax: '233', pricePF: '280', pricePJ: '300', unit: 'm3' }
    ]
  },
  {
    id: 'fallback-horizonte',
    company: 'Companhia Horizonte',
    route: 'Logística Sudeste • Contrato mensal',
    updatedAt: 'Atualizado ontem',
    notes: 'Pedidos acima de 800 t recebem adicional de R$ 12/t para frete incluso.',
    rows: [
      { id: 'fh-1', densityMin: '0', densityMax: '210', pricePF: '245', pricePJ: '268', unit: 'm3' },
      { id: 'fh-2', densityMin: '211', densityMax: '235', pricePF: '285', pricePJ: '308', unit: 'm3' },
      { id: 'fh-3', densityMin: '236', densityMax: '260', pricePF: '320', pricePJ: '344', unit: 'tonelada' }
    ]
  }
];

const defaultNotes =
  'UMIDADE (%) DESCONTO (R$ POR METRO)\nDe 6% até 10% Desconto excedente no peso\nDe 10,01% acima Desconto total de umidade';

const TableContext = createContext<TableContextValue | undefined>(undefined);

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const generateTableId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `table-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const mapPricingTableToState = (pricingTable: PricingTable): TableState => ({
  id: pricingTable.id,
  title: pricingTable.title || 'Tabela de Preços',
  description: pricingTable.description || 'Defina as faixas de classificação e os preços correspondentes.',
  notes: pricingTable.notes || defaultNotes,
  rows:
    pricingTable.rows.length > 0
      ? pricingTable.rows
      : [...defaultRows.map(row => ({ ...row, id: generateId() }))]
});

const mapPricingTableToPreview = (pricingTable: PricingTable): SupplierTablePreview => ({
  id: pricingTable.id,
  company: pricingTable.company ?? 'Siderúrgica parceira',
  route: pricingTable.route ?? 'Logística não informada',
  updatedAt: pricingTable.updatedAt ?? 'Atualizado recentemente',
  notes: pricingTable.notes,
  rows: pricingTable.rows
});

type Props = {
  children: React.ReactNode;
};

export const TableProvider: React.FC<Props> = ({ children }) => {
  const { profile } = useProfile();
  const [table, setTable] = useState<TableState>({
    id: null,
    title: 'Tabela de Preços',
    description: 'Defina as faixas de classificação e os preços correspondentes.',
    rows: defaultRows.map(row => ({ ...row })),
    notes: defaultNotes
  });
  const [supplierTables, setSupplierTables] = useState<SupplierTablePreview[]>(fallbackSupplierTables);
  const [loading, setLoading] = useState(false);
  const syncingRef = useRef(false);

  const refreshSupplierTables = useCallback(async () => {
    setLoading(true);
    try {
      const tables = await fetchSupplierTables();
      if (tables.length > 0) {
        setSupplierTables(tables.map(mapPricingTableToPreview));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSupplierTables();
  }, [refreshSupplierTables]);

  useEffect(() => {
    const loadSteelData = async () => {
      if (profile.type !== 'steel' || !profile.email) {
        setTable(prev => ({ ...prev, id: null }));
        return;
      }
      setLoading(true);
      const remoteTable = await fetchSteelTableByOwner(profile.email);
      if (remoteTable) {
        setTable(mapPricingTableToState(remoteTable));
      } else {
        setTable(prev => ({
          ...prev,
          id: null,
          rows: defaultRows.map(row => ({ ...row, id: generateId() })),
          notes: defaultNotes
        }));
      }
      setLoading(false);
    };

    loadSteelData();
  }, [profile]);

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
            rows: next.rows,
            company: profile.company,
            route: profile.company ?? undefined,
            updatedAt: undefined
          },
          profile.company ?? null,
          profile.company ?? null
        );
        if (persisted) {
          setTable(mapPricingTableToState(persisted));
          refreshSupplierTables();
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [profile, refreshSupplierTables]
  );

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
        const next = { ...prev, rows: [...prev.rows, newRow] };
        void persistIfSteel(next);
        return next;
      });
    };

    const removeRow = (id: string) => {
      setTable(prev => {
        const next = { ...prev, rows: prev.rows.filter(row => row.id !== id) };
        void persistIfSteel(next);
        return next;
      });
    };

    const updateRow: TableContextValue['updateRow'] = (id, key, value) => {
      setTable(prev => {
        const next = {
          ...prev,
          rows: prev.rows.map(row => (row.id === id ? { ...row, [key]: value } : row))
        };
        void persistIfSteel(next);
        return next;
      });
    };

    const updateNotes = (notes: string) => {
      setTable(prev => {
        const next = { ...prev, notes };
        void persistIfSteel(next);
        return next;
      });
    };

    return { table, addRow, removeRow, updateRow, updateNotes, supplierTables, refreshSupplierTables, loading };
  }, [table, supplierTables, refreshSupplierTables, persistIfSteel, loading]);

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
};

export const useTable = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
};
