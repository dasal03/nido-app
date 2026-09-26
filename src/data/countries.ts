/**
 * Countries supported at sign-up: dial code, national phone length and the identity documents
 * accepted in each one (with a format check). Passport ("PA") is accepted everywhere.
 */

export interface DocumentType {
  id: string;
  name: { es: string; en: string };
  pattern: RegExp;
  /** Characters allowed while typing (the full pattern is checked on validation). */
  numeric: boolean;
}

export interface Country {
  code: string;
  flag: string;
  name: { es: string; en: string };
  dial: string;
  /** Allowed length of the national phone number (digits only). */
  phone: [min: number, max: number];
  documents: DocumentType[];
}

const PASSPORT: DocumentType = { id: 'PA', name: { es: 'Pasaporte', en: 'Passport' }, pattern: /^[A-Z0-9]{6,12}$/, numeric: false };
const doc = (id: string, es: string, en: string, pattern: RegExp, numeric = true): DocumentType => ({
  id,
  name: { es, en },
  pattern,
  numeric,
});

export const COUNTRIES: Country[] = [
  {
    code: 'CO',
    flag: '🇨🇴',
    name: { es: 'Colombia', en: 'Colombia' },
    dial: '+57',
    phone: [10, 10],
    documents: [
      doc('CC', 'Cédula de ciudadanía', 'Citizenship ID', /^\d{6,10}$/),
      doc('CE', 'Cédula de extranjería', 'Foreigner ID', /^\d{6,10}$/),
      doc('TI', 'Tarjeta de identidad', 'Identity card (minors)', /^\d{10,11}$/),
      doc('PPT', 'Permiso por protección temporal', 'Temporary protection permit', /^\d{6,10}$/),
      PASSPORT,
    ],
  },
  {
    code: 'MX',
    flag: '🇲🇽',
    name: { es: 'México', en: 'Mexico' },
    dial: '+52',
    phone: [10, 10],
    documents: [
      doc('INE', 'Credencial INE (clave de elector)', 'INE voter ID', /^[A-Z]{6}\d{8}[HM]\d{3}$/, false),
      doc('CURP', 'CURP', 'CURP', /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/, false),
      PASSPORT,
    ],
  },
  {
    code: 'US',
    flag: '🇺🇸',
    name: { es: 'Estados Unidos', en: 'United States' },
    dial: '+1',
    phone: [10, 10],
    documents: [
      doc('DL', 'Licencia de conducir', "Driver's license", /^[A-Z0-9]{4,16}$/, false),
      doc('SID', 'Identificación estatal', 'State ID', /^[A-Z0-9]{4,16}$/, false),
      PASSPORT,
    ],
  },
  {
    code: 'ES',
    flag: '🇪🇸',
    name: { es: 'España', en: 'Spain' },
    dial: '+34',
    phone: [9, 9],
    documents: [doc('DNI', 'DNI', 'DNI', /^\d{8}[A-Z]$/, false), doc('NIE', 'NIE', 'NIE', /^[XYZ]\d{7}[A-Z]$/, false), PASSPORT],
  },
  {
    code: 'AR',
    flag: '🇦🇷',
    name: { es: 'Argentina', en: 'Argentina' },
    dial: '+54',
    phone: [10, 11],
    documents: [doc('DNI', 'DNI', 'DNI', /^\d{7,8}$/), PASSPORT],
  },
  {
    code: 'CL',
    flag: '🇨🇱',
    name: { es: 'Chile', en: 'Chile' },
    dial: '+56',
    phone: [9, 9],
    documents: [doc('RUT', 'RUT', 'RUT', /^\d{7,8}-?[\dK]$/, false), PASSPORT],
  },
  {
    code: 'PE',
    flag: '🇵🇪',
    name: { es: 'Perú', en: 'Peru' },
    dial: '+51',
    phone: [9, 9],
    documents: [doc('DNI', 'DNI', 'DNI', /^\d{8}$/), doc('CE', 'Carné de extranjería', 'Foreigner card', /^\d{9}$/), PASSPORT],
  },
  {
    code: 'EC',
    flag: '🇪🇨',
    name: { es: 'Ecuador', en: 'Ecuador' },
    dial: '+593',
    phone: [9, 9],
    documents: [doc('CI', 'Cédula de identidad', 'Identity card', /^\d{10}$/), PASSPORT],
  },
  {
    code: 'VE',
    flag: '🇻🇪',
    name: { es: 'Venezuela', en: 'Venezuela' },
    dial: '+58',
    phone: [10, 10],
    documents: [doc('CI', 'Cédula de identidad', 'Identity card', /^[VE]?\d{6,9}$/, false), PASSPORT],
  },
  {
    code: 'GT',
    flag: '🇬🇹',
    name: { es: 'Guatemala', en: 'Guatemala' },
    dial: '+502',
    phone: [8, 8],
    documents: [doc('DPI', 'DPI', 'DPI', /^\d{13}$/), PASSPORT],
  },
  {
    code: 'CR',
    flag: '🇨🇷',
    name: { es: 'Costa Rica', en: 'Costa Rica' },
    dial: '+506',
    phone: [8, 8],
    documents: [doc('CED', 'Cédula', 'National ID', /^\d{9}$/), doc('DIMEX', 'DIMEX', 'DIMEX', /^\d{11,12}$/), PASSPORT],
  },
  {
    code: 'PA',
    flag: '🇵🇦',
    name: { es: 'Panamá', en: 'Panama' },
    dial: '+507',
    phone: [7, 8],
    documents: [doc('CIP', 'Cédula', 'National ID', /^(PE|E|N|\d{1,2})-?\d{1,4}-?\d{1,6}$/, false), PASSPORT],
  },
  {
    code: 'DO',
    flag: '🇩🇴',
    name: { es: 'República Dominicana', en: 'Dominican Republic' },
    dial: '+1',
    phone: [10, 10],
    documents: [doc('CED', 'Cédula', 'National ID', /^\d{11}$/), PASSPORT],
  },
  {
    code: 'UY',
    flag: '🇺🇾',
    name: { es: 'Uruguay', en: 'Uruguay' },
    dial: '+598',
    phone: [8, 9],
    documents: [doc('CI', 'Cédula de identidad', 'Identity card', /^\d{7,8}$/), PASSPORT],
  },
];

export const DEFAULT_COUNTRY = 'CO';

export const countryByCode = (code: string | null | undefined) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

export const GENDERS = ['female', 'male', 'nonbinary', 'undisclosed'] as const;
export type Gender = (typeof GENDERS)[number];

/** Minimum age to create an account. */
export const MIN_AGE = 17;
