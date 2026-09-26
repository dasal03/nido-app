import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { fonts, radius, spacing, type } from '@/theme';
import { inviteUrl } from '@/utils/invite';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { PressableScale, tap } from './ui';

/**
 * Invitation to a nest: the code (a personal NIDO code for couples, or the family's FAM code), a QR
 * to scan from another phone, and copy/share actions.
 */
export function InviteSheet({
  visible,
  onClose,
  code,
  title,
  body,
}: {
  visible: boolean;
  onClose: () => void;
  code: string;
  title: string;
  body: string;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(code);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.text}>{body}</Text>
        <View style={s.qrBox}>
          <QRCode value={url} size={200} color="#0A1433" backgroundColor="#FFFFFF" />
        </View>
        <Text style={s.code} selectable>
          {code}
        </Text>
        <View style={s.actions}>
          <PressableScale containerStyle={{ flex: 1 }} style={s.action} onPress={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={18} color={colors.accent} />
            <Text style={s.actionText}>{t(copied ? 'common.copied' : 'common.copy')}</Text>
          </PressableScale>
          <PressableScale
            containerStyle={{ flex: 1 }}
            style={s.action}
            onPress={() => Share.share({ message: t('invite.shareMessage', { url, code }) }).catch(() => {})}>
            <Icon name="share" size={18} color={colors.accent} />
            <Text style={s.actionText}>{t('common.share')}</Text>
          </PressableScale>
        </View>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  body: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  title: { ...type.h2, color: colors.text, textAlign: 'center' },
  text: { ...type.small, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  qrBox: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  code: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: 2, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  actionText: { ...type.bodyStrong, color: colors.accent },
}));
