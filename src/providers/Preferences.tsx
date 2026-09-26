import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { en } from '@/i18n/en';
import { es, type TranslationKey } from '@/i18n/es';
import { darkTheme, lightTheme, type Theme } from '@/theme';

export type LanguagePref = 'system' | 'es' | 'en';
export type ThemePref = 'system' | 'light' | 'dark';
export type Language = 'es' | 'en';

export interface Prefs {
  language: LanguagePref;
  theme: ThemePref;
  /** Recurring-contribution and streak reminders. */
  reminders: boolean;
  /** Monthly recap notification. */
  monthlyRecap: boolean;
  /** Start with balances masked. */
  hideBalances: boolean;
  /** The welcome slides were seen (or the user has signed in on this device). */
  onboarded: boolean;
}

const DEFAULT_PREFS: Prefs = {
  language: 'system',
  theme: 'system',
  reminders: true,
  monthlyRecap: true,
  hideBalances: false,
  onboarded: false,
};

const STORAGE_KEY = 'nido/prefs/v1';
const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { es, en };
const LOCALES: Record<Language, string> = { es: 'es-MX', en: 'en-US' };

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface PreferencesValue {
  prefs: Prefs;
  setLanguage: (language: LanguagePref) => void;
  setTheme: (theme: ThemePref) => void;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  theme: Theme;
  language: Language;
  /** BCP 47 locale for dates and numbers in the UI language. */
  locale: string;
  t: Translate;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : 'es';
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setPrefs((p) => ({ ...p, ...JSON.parse(raw) })))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(() => {
    const language = prefs.language === 'system' ? deviceLanguage() : prefs.language;
    const dark = prefs.theme === 'system' ? scheme === 'dark' : prefs.theme === 'dark';
    const dict = DICTIONARIES[language];
    const t: Translate = (key, params) => {
      let text = dict[key] ?? es[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
      return text;
    };
    return {
      prefs,
      setLanguage: (l) => update({ language: l }),
      setTheme: (th) => update({ theme: th }),
      setPref: (key, value) => update({ [key]: value }),
      theme: dark ? darkTheme : lightTheme,
      language,
      locale: LOCALES[language],
      t,
    };
  }, [prefs, scheme, update]);

  if (!ready) return null;
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

export const useTheme = () => usePreferences().theme;

export function useT() {
  const { t, locale, language } = usePreferences();
  return { t, locale, language };
}

/** Creates a hook returning theme-aware styles, computed once per theme. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T) {
  const cache = new Map<Theme, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
