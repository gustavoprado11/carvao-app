export type TableUnit = 'm3' | 'tonelada';
export type ScheduleType = 'agendamento' | 'fila';

export type TableRow = {
  id: string;
  densityMin: string;
  densityMax: string;
  pricePF: string;
  pricePJ: string;
  unit: TableUnit;
};
