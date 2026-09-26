import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { exportCsv, exportPdf } from '@/utils/export';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { ErrorBanner, PressableScale } from './ui';

/** Lets the user export the active nest's movements as CSV or PDF. */
export function ExportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { t, locale } = useT();
  const { couple, members, nestName } = useSavings();
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(kind);
    setError(null);
    try {
      const input = { couple, nestName, members, t, locale };
      await (kind === 'csv' ? exportCsv(input) : exportPdf(input));
      onClose();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.title}>{t('export.title')}</Text>
      <Text style={s.subtitle}>{t('export.subtitle', { name: nestName, n: couple.transactions.length })}</Text>
      <View style={s.options}>
        <Option icon="file-csv" label={t('export.csv')} hint={t('export.csvHint')} loading={busy === 'csv'} onPress={() => run('csv')} />
        <Option icon="file-pdf" label={t('export.pdf')} hint={t('export.pdfHint')} loading={busy === 'pdf'} onPress={() => run('pdf')} />
      </View>
      <ErrorBanner message={error} />
    </Sheet>
  );
}

function Option({
  icon,
  label,
  hint,
  loading,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  loading: boolean;
  onPress: () => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} disabled={loading} scaleTo={0.98} style={s.option}>
      <View style={s.optionIcon}>
        {loading ? <ActivityIndicator color={colors.accent} /> : <Icon name={icon} size={22} color={colors.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionLabel}>{label}</Text>
        <Text style={s.optionHint}>{hint}</Text>
      </View>
      <Icon name="download" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  title: { ...type.h2, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  options: { gap: spacing.sm + 2, marginVertical: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { ...type.bodyStrong, color: colors.text },
  optionHint: { ...type.small, color: colors.textMuted, marginTop: 1 },
}));
