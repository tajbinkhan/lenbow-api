import { CurrencySchemaType } from '../../../database/types';

export type CurrencyData = Omit<CurrencySchemaType, 'id' | 'createdAt' | 'updatedAt'>;
