import { MIN_AGE, countryByCode } from '@/data/countries';
import type { TranslationKey } from '@/i18n/es';

/** A validation result: null when valid, otherwise the translation key of the message. */
export type FieldError = TranslationKey | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
const NAME_RE = /^[\p{L}][\p{L} '.-]{1,59}$/u;

export function validateName(value: string): FieldError {
  const v = value.trim();
  if (!v) return 'validation.required';
  return NAME_RE.test(v) ? null : 'validation.name';
}

export function validateUsername(value: string): FieldError {
  if (!value) return 'validation.required';
  return USERNAME_RE.test(value) ? null : 'errors.usernameInvalid';
}

export function validateEmail(value: string): FieldError {
  const v = value.trim();
  if (!v) return 'validation.required';
  return EMAIL_RE.test(v) ? null : 'errors.invalidEmail';
}

export const PASSWORD_RULES = [
  { id: 'length', key: 'validation.pwLength', test: (v: string) => v.length >= 8 },
  { id: 'upper', key: 'validation.pwUpper', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', key: 'validation.pwLower', test: (v: string) => /[a-z]/.test(v) },
  { id: 'number', key: 'validation.pwNumber', test: (v: string) => /\d/.test(v) },
  { id: 'symbol', key: 'validation.pwSymbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const satisfies readonly { id: string; key: TranslationKey; test: (v: string) => boolean }[];

export function validatePassword(value: string): FieldError {
  if (!value) return 'validation.required';
  return PASSWORD_RULES.every((r) => r.test(value)) ? null : 'validation.pwWeak';
}

export function validateConfirm(password: string, confirm: string): FieldError {
  if (!confirm) return 'validation.required';
  return password === confirm ? null : 'validation.pwMismatch';
}

/** `digits` is the national number without the dial code. */
export function validatePhone(country: string, digits: string): FieldError {
  if (!digits) return 'validation.required';
  const [min, max] = countryByCode(country).phone;
  return /^\d+$/.test(digits) && digits.length >= min && digits.length <= max ? null : 'validation.phoneDigits';
}

/** "10" or "7–8": the digit count expected for a country's national phone numbers. */
export function phoneDigitsLabel(country: string) {
  const [min, max] = countryByCode(country).phone;
  return min === max ? String(min) : `${min}–${max}`;
}

/** Whole years between an ISO date (YYYY-MM-DD) and today. */
export function ageFrom(iso: string, today = new Date()) {
  const [y, m, d] = iso.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export function validateBirthday(iso: string): FieldError {
  if (!iso) return 'validation.required';
  const age = ageFrom(iso);
  if (Number.isNaN(age) || age > 120) return 'validation.birthday';
  return age >= MIN_AGE ? null : 'validation.minAge';
}

export function validateDocument(country: string, type: string, number: string): FieldError {
  if (!type) return 'validation.required';
  if (!number) return 'validation.required';
  const doc = countryByCode(country).documents.find((d) => d.id === type);
  if (!doc) return 'validation.required';
  return doc.pattern.test(number.toUpperCase()) ? null : 'validation.document';
}

/** "+57 3012668858" → { dial: "+57", digits: "3012668858" } (falls back to the country's dial code). */
export function splitPhone(phone: string, country: string) {
  const dial = countryByCode(country).dial;
  const clean = phone.trim();
  if (clean.startsWith(dial)) return { dial, digits: clean.slice(dial.length).replace(/\D/g, '') };
  if (clean.startsWith('+')) {
    const [code, ...rest] = clean.split(' ');
    return { dial: code, digits: rest.join('').replace(/\D/g, '') };
  }
  return { dial, digits: clean.replace(/\D/g, '') };
}
