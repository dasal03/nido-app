import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSession } from '@/store/SavingsContext';
import { fonts, radius, spacing, type } from '@/theme';
import { inviteUrl, takePendingInvite } from '@/utils/invite';
import { useAction } from '@/utils/useAction';
import { Icon } from './Icon';
import { QrScanner } from './QrScanner';
import { Sheet } from './Sheet';
import { Button, ErrorBanner, PressableScale, TextField, tap } from './ui';

/** Shows the user's code and lets them link with a partner's code (or a sample partner). */
export function LinkForm({ onLinked }: { onLinked?: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const [code, setCode] = useState(() => takePendingInvite() ?? '');
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const link = useAction(backend.linkWithCode);
  const demo = useAction(backend.linkDemoPartner);

  if (!user) return null;

  const copy = async () => {
    await Clipboard.setStringAsync(user.code);
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const url = inviteUrl(user.code);
  const submit = async (value = code) => {
    if (await link.run(value)) {
      tap('success');
      onLinked?.();
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={s.codeCard}>
        <Text style={s.codeLabel}>{t('link.yourCode')}</Text>
        <Text style={s.code} selectable>
          {user.code}
        </Text>
        <View style={s.codeActions}>
          <PressableScale style={s.codeAction} onPress={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={16} color={colors.accent} />
            <Text style={s.codeActionText}>{t(copied ? 'common.copied' : 'common.copy')}</Text>
          </PressableScale>
          <PressableScale style={s.codeAction} onPress={() => Share.share({ message: t('invite.shareMessage', { url, code: user.code }) }).catch(() => {})}>
            <Icon name="share" size={16} color={colors.accent} />
            <Text style={s.codeActionText}>{t('common.share')}</Text>
          </PressableScale>
          <PressableScale style={s.codeAction} onPress={() => setQrOpen(true)} accessibilityLabel={t('invite.showQr')}>
            <Icon name="qr" size={16} color={colors.accent} />
            <Text style={s.codeActionText}>QR</Text>
          </PressableScale>
        </View>
      </View>

      <View style={s.divider}>
        <View style={s.line} />
        <Text style={s.dividerText}>{t('link.or')}</Text>
        <View style={s.line} />
      </View>

      <TextField
        label={t('link.partnerCode')}
        icon="users"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="NIDO-XXXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        onSubmitEditing={() => submit()}
      />
      <ErrorBanner message={link.error ?? demo.error} />
      <Button label={t('link.cta')} icon="link" onPress={() => submit()} loading={link.loading} disabled={code.trim().length < 5} />
      <Button label={t('invite.scan')} icon="scan" variant="secondary" onPress={() => setScanning(true)} />
      <Button
        label={t('link.demo')}
        variant="soft"
        icon="sparkles"
        onPress={async () => {
          if (await demo.run()) onLinked?.();
        }}
        loading={demo.loading}
      />

      <Sheet visible={qrOpen} onClose={() => setQrOpen(false)}>
        <View style={s.qrSheet}>
          <Text style={s.qrTitle}>{t('invite.qrTitle')}</Text>
          <Text style={s.qrBody}>{t('invite.qrBody')}</Text>
          <View style={s.qrBox}>
            <QRCode value={url} size={210} color="#0A1433" backgroundColor="#FFFFFF" />
          </View>
          <Text style={s.qrCode}>{user.code}</Text>
        </View>
      </Sheet>
      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onCode={(scanned) => {
            setScanning(false);
            setCode(scanned);
            submit(scanned);
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  codeCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  codeLabel: { ...type.smallStrong, color: colors.textMuted },
  code: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: 2, marginVertical: spacing.sm },
  codeActions: { flexDirection: 'row', gap: spacing.sm },
  codeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
  },
  codeActionText: { ...type.smallStrong, color: colors.accent },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...type.small, color: colors.textSubtle },
  qrSheet: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  qrTitle: { ...type.h2, color: colors.text },
  qrBody: { ...type.small, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  qrBox: { padding: spacing.md, backgroundColor: '#FFFFFF', borderRadius: radius.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  qrCode: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: 2, marginTop: spacing.sm },
}));
