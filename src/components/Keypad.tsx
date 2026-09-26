import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { fonts } from '@/theme';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;
export type KeypadKey = (typeof KEYS)[number];

/** Applies a keypad press to an amount string, keeping at most 2 decimals and 9 integer digits. */
export function applyKey(value: string, key: KeypadKey) {
  if (key === 'del') return value.length <= 1 ? '0' : value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : value + '.';
  const [int, dec] = value.split('.');
  if (dec !== undefined) return dec.length >= 2 ? value : value + key;
  if (int.length >= 9) return value;
  return value === '0' ? key : value + key;
}

export function Keypad({ onKey, allowDecimal = true, decimalSeparator = '.' }: { onKey: (key: KeypadKey) => void; allowDecimal?: boolean; decimalSeparator?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={s.grid}>
      {KEYS.map((k) =>
        k === '.' && !allowDecimal ? (
          <View key={k} style={s.cell} />
        ) : (
          <PressableScale
            key={k}
            accessibilityLabel={k === 'del' ? t('transfer.backspace') : k}
            haptic={false}
            scaleTo={0.88}
            containerStyle={s.cell}
            onPress={() => {
              tap('selection');
              onKey(k);
            }}
            style={s.key}>
            {k === 'del' ? <Icon name="backspace" size={26} color={colors.text} /> : <Text style={s.keyText}>{k === '.' ? decimalSeparator : k}</Text>}
          </PressableScale>
        ),
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.333%', height: 60, padding: 3 },
  key: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  keyText: { fontFamily: fonts.semibold, fontSize: 28, color: colors.text },
}));
