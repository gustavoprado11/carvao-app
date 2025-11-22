export type DocumentTypeId =
  | 'dcf'
  | 'dae'
  | 'dae_receipt'
  | 'car'
  | 'mapa'
  | 'deed'
  | 'lease';

export type DocumentRequirement = {
  id: DocumentTypeId;
  title: string;
  description?: string;
  required: boolean;
};

export const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  { id: 'dcf', title: 'DCF', description: 'Declaração de Colheita de Florestas Plantadas', required: true },
  {
    id: 'dae',
    title: 'DAE (Taxa Florestal e Expediente)',
    description: 'Comprovante da taxa florestal e expediente',
    required: true
  },
  { id: 'dae_receipt', title: 'Comprovante pagamento DAE', required: true },
  { id: 'car', title: 'CAR', description: 'Cadastro Ambiental Rural', required: true },
  { id: 'mapa', title: 'MAPA', description: 'Registro ou licença junto ao MAPA', required: false },
  { id: 'deed', title: 'Escritura do imóvel', required: true },
  { id: 'lease', title: 'Contrato de arrendamento', description: 'Se arrendado, envie o contrato', required: false }
];
