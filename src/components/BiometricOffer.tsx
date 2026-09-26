import { useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import type { TranslationKey } from '@/i18n/es';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { biometricOffer, enableBiometricLogin, markOffered, type BiometryKind } from '@/services/biometrics';
import { fonts, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, tap } from './ui';

export const biometryLabelKey = (kind: BiometryKind): TranslationKey =>
  kind === 'face' ? 'bio.face' : kind === 'fingerprint' ? 'bio.fingerprint' : 'bio.generic';

/** "Sign in with Face ID next time?" — shown once per account after the first password sign-in. */
export function BiometricOffer() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const offer = useSyncExternalStore(biometricOffer.subscribe, biometricOffer.get, biometricOffer.get);
  const [busy, setBusy] = useState(false);
  if (!offer) return null;

  const method = t(biometryLabelKey(offer.kind));
  const close = async () => {
    await markOffered(offer.identifier).catch(() => {});
    biometricOffer.set(null);
  };
  const enable = async () => {
    setBusy(true);
    try {
      await enableBiometricLogin(offer.identifier, offer.password, t('bio.prompt'));
      tap('success');
    } finally {
      setBusy(false);
      await close();
    }
  };

  return (
    <Sheet visible onClose={close}>
      <View style={s.body}>
        <View style={s.icon}>
          <Icon name={offer.kind === 'face' ? 'face-id' : 'fingerprint'} size={34} color={colors.accent} strokeWidth={1.8} />
        </View>
        <Text style={s.title}>{t('bio.offerTitle', { method })}</Text>
        <Text style={s.text}>{t('bio.offerBody')}</Text>
        <Button
          label={t('bio.enable', { method })}
          onPress={enable}
          loading={busy}
          style={{ alignSelf: 'stretch', marginTop: spacing.md }}
        />
        <Button label={t('bio.notNow')} variant="secondary" onPress={close} style={{ alignSelf: 'stretch' }} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  body: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, textAlign: 'center' },
  text: { ...type.body, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
}));
