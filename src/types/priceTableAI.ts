export type PriceTableAIResponse = {
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
