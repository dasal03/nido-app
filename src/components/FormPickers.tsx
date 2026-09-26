import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { COUNTRIES, countryByCode } from '@/data/countries';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { fonts, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, FieldMessage, PressableScale, WEB_NO_OUTLINE, tap } from './ui';

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  leading?: ReactNode;
}

/** Bottom sheet with a list of options (and optional search), used for country, document and gender. */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
}) {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.sublabel ?? ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.title}>{title}</Text>
      {searchPlaceholder && (
        <View style={s.search}>
          <Icon name="search" size={18} color={colors.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textSubtle}
            keyboardAppearance={dark ? 'dark' : 'light'}
            style={s.searchInput}
            autoCorrect={false}
          />
        </View>
      )}
      <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
        {filtered.map((o, i) => {
          const active = o.value === selected;
          return (
            <PressableScale
              key={o.value}
              haptic={false}
              scaleTo={0.985}
              onPress={() => {
                tap('selection');
                onSelect(o.value);
                setQuery('');
                onClose();
              }}
              style={[s.option, i > 0 && s.divider]}>
              {o.leading}
              <View style={{ flex: 1 }}>
                <Text style={s.optionLabel}>{o.label}</Text>
                {o.sublabel && <Text style={s.optionSub}>{o.sublabel}</Text>}
              </View>
              {active && (
                <View style={s.check}>
                  <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/** Country options with flag, localized name and dial code. */
export function useCountryOptions(): PickerOption[] {
  const { language } = useT();
  return useMemo(
    () =>
      [...COUNTRIES]
        .sort((a, b) => a.name[language].localeCompare(b.name[language], language))
        .map((c) => ({
          value: c.code,
          label: c.name[language],
          sublabel: c.dial,
          leading: <Text style={{ fontSize: 24 }}>{c.flag}</Text>,
        })),
    [language],
  );
}

/** Phone input with a country (flag + dial code) selector in front of the national number. */
export function PhoneField({
  label,
  country,
  digits,
  onChangeDigits,
  onPressCountry,
  onBlur,
  error,
  success,
}: {
  label: string;
  country: string;
  digits: string;
  onChangeDigits: (v: string) => void;
  onPressCountry: () => void;
  onBlur?: () => void;
  error?: string | null;
  success?: string | null;
}) {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const [focused, setFocused] = useState(false);
  const c = countryByCode(country);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View
        style={[
          s.phone,
          focused && { borderColor: colors.accent },
          !!success && { borderColor: colors.success },
          !!error && { borderColor: colors.danger },
        ]}>
        <PressableScale onPress={onPressCountry} haptic={false} scaleTo={0.95} style={s.dialButton} accessibilityLabel={c.name.es}>
          <Text style={{ fontSize: 20 }}>{c.flag}</Text>
          <Text style={s.dial}>{c.dial}</Text>
          <Icon name="chevron-down" size={14} color={colors.textSubtle} />
        </PressableScale>
        <TextInput
          value={digits}
          onChangeText={(v) => onChangeDigits(v.replace(/\D/g, '').slice(0, c.phone[1]))}
          placeholder={'3'.padEnd(c.phone[1], '0')}
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel-national"
          keyboardAppearance={dark ? 'dark' : 'light'}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={s.phoneInput}
        />
        {!!success && !error && <Icon name="check-circle" size={18} color={colors.success} />}
      </View>
      <FieldMessage error={error} success={success} />
    </View>
  );
}

const ITEM = 44;

/** Day / month / year picker in a sheet; works the same on iOS, Android and web. */
export function DatePickerSheet({
  visible,
  value,
  minAge,
  onChange,
  onClose,
}: {
  visible: boolean;
  /** ISO date YYYY-MM-DD, or '' when not set yet. */
  value: string;
  minAge: number;
  onChange: (iso: string) => void;
  onClose: () => void;
}) {
  const s = useStyles();
  const { t, locale } = useT();
  const thisYear = new Date().getFullYear();
  const initial = value ? value.split('-').map(Number) : [thisYear - 25, 1, 1];
  const [year, setYear] = useState(initial[0]);
  const [month, setMonth] = useState(initial[1]);
  const [day, setDay] = useState(initial[2]);
  const [shownFor, setShownFor] = useState(false);
  // Sync with the current value each time the sheet opens.
  if (visible && !shownFor) {
    setShownFor(true);
    setYear(initial[0]);
    setMonth(initial[1]);
    setDay(initial[2]);
  }
  if (!visible && shownFor) setShownFor(false);

  const years = useMemo(() => Array.from({ length: 100 - minAge + 1 }, (_, i) => thisYear - minAge - i), [thisYear, minAge]);
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        n: i + 1,
        label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2000, i, 1)),
      })),
    [locale],
  );
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(day, daysInMonth);

  const done = () => {
    onChange(`${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.title}>{t('auth.birthday')}</Text>
      <View style={s.columns}>
        <Column
          label={t('date.day')}
          items={days.map((d) => ({ key: d, label: String(d) }))}
          selected={safeDay}
          onSelect={setDay}
          visible={visible}
        />
        <Column
          label={t('date.month')}
          items={months.map((m) => ({ key: m.n, label: m.label }))}
          selected={month}
          onSelect={setMonth}
          visible={visible}
          flex={1.4}
        />
        <Column
          label={t('date.year')}
          items={years.map((y) => ({ key: y, label: String(y) }))}
          selected={year}
          onSelect={setYear}
          visible={visible}
          flex={1.2}
        />
      </View>
      <Button label={t('date.done')} icon="check" onPress={done} style={{ marginTop: spacing.md }} />
    </Sheet>
  );
}

function Column({
  label,
  items,
  selected,
  onSelect,
  visible,
  flex = 1,
}: {
  label: string;
  items: { key: number; label: string }[];
  selected: number;
  onSelect: (v: number) => void;
  visible: boolean;
  flex?: number;
}) {
  const s = useStyles();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(
    0,
    items.findIndex((i) => i.key === selected),
  );
  useEffect(() => {
    if (visible) setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, (index - 2) * ITEM), animated: false }), 60);
    // Only when the sheet opens: keep the user's scroll position while they pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return (
    <View style={{ flex }}>
      <Text style={s.columnLabel}>{label}</Text>
      <ScrollView ref={ref} style={s.column} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const active = item.key === selected;
          return (
            <PressableScale
              key={item.key}
              haptic={false}
              scaleTo={0.94}
              onPress={() => {
                tap('selection');
                onSelect(item.key);
              }}
              style={[s.cell, active && s.cellActive]}>
              <Text style={[s.cellText, active && s.cellTextActive]}>{item.label}</Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  title: { ...type.h2, color: colors.text, marginBottom: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md - 2,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, minWidth: 0, height: 44, ...type.body, color: colors.text, ...WEB_NO_OUTLINE },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4, paddingVertical: spacing.sm + 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  optionLabel: { ...type.bodyStrong, color: colors.text },
  optionSub: { ...type.small, color: colors.textMuted, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...type.smallStrong, color: colors.textMuted },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: radius.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingRight: spacing.md - 2,
    gap: spacing.sm,
  },
  dialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 51,
    paddingHorizontal: spacing.md - 4,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  dial: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  phoneInput: { flex: 1, minWidth: 0, height: '100%', ...type.body, color: colors.text, ...WEB_NO_OUTLINE },
  columns: { flexDirection: 'row', gap: spacing.sm },
  columnLabel: { ...type.tiny, color: colors.textSubtle, textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 },
  column: { height: ITEM * 5, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  cell: { height: ITEM, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, marginHorizontal: 4 },
  cellActive: { backgroundColor: colors.primary },
  cellText: { ...type.body, color: colors.textMuted },
  cellTextActive: { fontFamily: fonts.bold, color: colors.onPrimary },
}));
