import { useState } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { fonts, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, Card, Chip, PressableScale, tap } from './ui';

const PRESETS = [50, 60, 70, 40, 30];

/** Agreed contribution split and how the signed-in user is tracking against it. */
export function SplitCard() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { couple, me, partner, byMember } = useSavings();
  const money = useMoney();
  const [editing, setEditing] = useState(false);
  if (!partner) return null;
  const myShare = couple.split?.[me.id] ?? 50;
  const total = byMember[me.id] + byMember[partner.id];
  const diff = byMember[me.id] - (total * myShare) / 100;

  let status: string;
  let tone = colors.textMuted;
  if (Math.abs(diff) < 1) status = t('split.even');
  else if (diff > 0) {
    status = t('split.ahead', { amount: money(diff) });
    tone = colors.success;
  } else {
    status = t('split.behind', { amount: money(-diff) });
    tone = '#E07A00';
  }

  return (
    <>
      <Card style={{ gap: spacing.sm + 4 }}>
        <View style={s.header}>
          <View style={s.icon}>
            <Icon name="percent" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t('split.title')}</Text>
            <Text style={s.summary}>{t('split.summary', { me: myShare, partner: 100 - myShare, name: partner.name })}</Text>
          </View>
          <PressableScale onPress={() => setEditing(true)} style={s.edit} scaleTo={0.92}>
            <Text style={s.editText}>{t('split.edit')}</Text>
          </PressableScale>
        </View>
        <SplitBar mine={myShare} />
        <Text style={[s.status, { color: tone }]}>{status}</Text>
      </Card>
      <SplitSheet visible={editing} initial={myShare} onClose={() => setEditing(false)} />
    </>
  );
}

function SplitBar({ mine }: { mine: number }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.bar}>
      <View style={[s.barPart, { flex: mine, backgroundColor: colors.me }]}>
        <Text style={s.barText}>{mine}%</Text>
      </View>
      <View style={[s.barPart, { flex: 100 - mine, backgroundColor: colors.partner }]}>
        <Text style={s.barText}>{100 - mine}%</Text>
      </View>
    </View>
  );
}

function SplitSheet({ visible, initial, onClose }: { visible: boolean; initial: number; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { me, partner } = useSavings();
  const [mine, setMine] = useState(initial);
  const [shownFor, setShownFor] = useState(visible);
  // Reset the draft each time the sheet opens.
  if (visible && !shownFor) {
    setShownFor(true);
    setMine(initial);
  }
  if (!visible && shownFor) setShownFor(false);

  const step = (delta: number) => {
    tap('selection');
    setMine((m) => Math.min(90, Math.max(10, m + delta)));
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>{t('split.sheetTitle')}</Text>
      <Text style={s.sheetBody}>{t('split.sheetBody')}</Text>
      <View style={s.stepper}>
        <PressableScale onPress={() => step(-5)} style={s.stepButton} scaleTo={0.88} accessibilityLabel="-5%">
          <Icon name="minus" size={20} color={colors.text} />
        </PressableScale>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.big}>
            {mine}% · {100 - mine}%
          </Text>
          <Text style={s.who}>
            {me.name} · {partner?.name}
          </Text>
        </View>
        <PressableScale onPress={() => step(5)} style={s.stepButton} scaleTo={0.88} accessibilityLabel="+5%">
          <Icon name="add" size={20} color={colors.text} />
        </PressableScale>
      </View>
      <SplitBar mine={mine} />
      <View style={s.presets}>
        {PRESETS.map((p) => (
          <Chip key={p} label={`${p}/${100 - p}`} selected={mine === p} onPress={() => setMine(p)} />
        ))}
      </View>
      <Button
        label={t('split.save')}
        icon="check"
        style={{ marginTop: spacing.lg }}
        onPress={async () => {
          if (!partner) return;
          await backend.setSplit(mine === 50 ? null : { [me.id]: mine, [partner.id]: 100 - mine });
          tap('success');
          onClose();
        }}
      />
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.bodyStrong, color: colors.text },
  summary: { ...type.small, color: colors.textMuted, marginTop: 1 },
  edit: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  editText: { ...type.smallStrong, fontSize: 12, color: colors.text },
  bar: { flexDirection: 'row', height: 26, borderRadius: 13, overflow: 'hidden', gap: 3 },
  barPart: { justifyContent: 'center', alignItems: 'center', minWidth: 36 },
  barText: { ...type.tiny, color: '#FFFFFF' },
  status: { ...type.smallStrong },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetBody: { ...type.small, color: colors.textMuted, marginTop: 4, lineHeight: 19 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text },
  who: { ...type.small, color: colors.textMuted },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
}));
