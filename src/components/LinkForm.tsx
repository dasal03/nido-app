import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { isFamilyCode } from '@/services/types';
import { useSession } from '@/store/SavingsContext';
import type { NestKind } from '@/store/types';
import { fonts, radius, spacing, type } from '@/theme';
import { takePendingInvite } from '@/utils/invite';
import { useAction } from '@/utils/useAction';
import { Icon } from './Icon';
import { InviteSheet } from './InviteSheet';
import { QrScanner } from './QrScanner';
import { Button, ErrorBanner, PressableScale, Segmented, TextField, tap } from './ui';

/**
 * Starts or joins a nest: a couple (share your code, or enter your partner's) or a family group
 * (create one with a name, or join with the family's FAM code). Codes can also be scanned as QR.
 * With `addMember`, it only adds someone to the active family by their personal code.
 */
export function LinkForm({ onLinked, addMember }: { onLinked?: () => void; addMember?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  const [code, setCode] = useState(() => takePendingInvite() ?? '');
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  // An invite link with a family code opens straight on the family tab.
  const [kind, setKind] = useState<NestKind>(() => (isFamilyCode(code) ? 'family' : 'couple'));
  const [familyName, setFamilyName] = useState('');
  const link = useAction((value: string) =>
    addMember ? backend.addMemberByCode(value) : isFamilyCode(value) ? backend.joinFamily(value) : backend.linkWithCode(value),
  );
  const demo = useAction(backend.linkDemoPartner);
  const family = useAction(backend.createFamily);

  if (!user) return null;

  const done = () => {
    tap('success');
    onLinked?.();
  };
  const submit = async (value = code) => {
    if (await link.run(value)) done();
  };
  const createFamily = async () => {
    if (await family.run(familyName)) done();
  };
  const copy = async () => {
    await Clipboard.setStringAsync(user.code);
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scanner = scanning && (
    <QrScanner
      onClose={() => setScanning(false)}
      onCode={(scanned) => {
        setScanning(false);
        setCode(scanned);
        submit(scanned);
      }}
    />
  );
  const codeField = (label: string, placeholder: string) => (
    <TextField
      label={label}
      icon="users"
      value={code}
      onChangeText={(v) => setCode(v.toUpperCase())}
      placeholder={placeholder}
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={10}
      onSubmitEditing={() => submit()}
    />
  );
  const scanButton = <Button label={t('invite.scan')} icon="scan" variant="secondary" onPress={() => setScanning(true)} />;
  const divider = (label: string) => (
    <View style={s.divider}>
      <View style={s.line} />
      <Text style={s.dividerText}>{label}</Text>
      <View style={s.line} />
    </View>
  );

  if (addMember) {
    return (
      <View style={{ gap: spacing.md }}>
        {codeField(t('family.memberCode'), 'NIDO-XXXXX')}
        <ErrorBanner message={link.error} />
        <Button
          label={t('family.addCta')}
          icon="user-plus"
          onPress={() => submit()}
          loading={link.loading}
          disabled={code.trim().length < 5}
        />
        {scanButton}
        {scanner}
      </View>
    );
  }

  const kindSwitch = (
    <Segmented<NestKind>
      value={kind}
      onChange={setKind}
      options={[
        { value: 'couple', label: t('link.kindCouple'), icon: 'heart' },
        { value: 'family', label: t('link.kindFamily'), icon: 'users' },
      ]}
    />
  );

  if (kind === 'family') {
    return (
      <View style={{ gap: spacing.md }}>
        {kindSwitch}
        <View style={s.familyIntro}>
          <View style={s.familyIcon}>
            <Icon name="home" size={24} color={colors.accent} />
          </View>
          <Text style={s.familyText}>{t('family.intro')}</Text>
        </View>
        <TextField
          label={t('family.name')}
          icon="edit"
          value={familyName}
          onChangeText={setFamilyName}
          placeholder={t('family.namePlaceholder')}
          maxLength={40}
          autoCapitalize="words"
          onSubmitEditing={createFamily}
        />
        <ErrorBanner message={family.error} />
        <Button
          label={t('family.create')}
          icon="users"
          onPress={createFamily}
          loading={family.loading}
          disabled={familyName.trim().length < 2}
        />

        {divider(t('family.joinDivider'))}
        {codeField(t('family.joinCode'), 'FAM-XXXXX')}
        <ErrorBanner message={link.error} />
        <Button
          label={t('family.joinCta')}
          icon="login"
          variant="soft"
          onPress={() => submit()}
          loading={link.loading}
          disabled={!isFamilyCode(code)}
        />
        {scanButton}
        {scanner}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {kindSwitch}
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
          <PressableScale style={s.codeAction} onPress={() => setQrOpen(true)} accessibilityLabel={t('invite.showQr')}>
            <Icon name="qr" size={16} color={colors.accent} />
            <Text style={s.codeActionText}>{t('invite.qrAndShare')}</Text>
          </PressableScale>
        </View>
      </View>

      {divider(t('link.or'))}
      {codeField(t('link.partnerCode'), 'NIDO-XXXXX')}
      <ErrorBanner message={link.error ?? demo.error} />
      <Button label={t('link.cta')} icon="link" onPress={() => submit()} loading={link.loading} disabled={code.trim().length < 5} />
      {scanButton}
      <Button
        label={t('link.demo')}
        variant="soft"
        icon="sparkles"
        onPress={async () => {
          if (await demo.run()) onLinked?.();
        }}
        loading={demo.loading}
      />

      <InviteSheet
        visible={qrOpen}
        onClose={() => setQrOpen(false)}
        code={user.code}
        title={t('invite.qrTitle')}
        body={t('invite.qrBody')}
      />
      {scanner}
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
  familyIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  familyIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  familyText: { ...type.small, color: colors.text, flex: 1, lineHeight: 19 },
}));
