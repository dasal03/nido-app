import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AvatarCropper } from '@/components/AvatarCropper';
import { DeleteAccountSheet } from '@/components/DeleteAccountSheet';
import { ExportSheet } from '@/components/ExportSheet';
import { biometryLabelKey } from '@/components/BiometricOffer';
import {
  biometricsSupported,
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometry,
  getEnrolledIdentifier,
  type BiometryKind,
} from '@/services/biometrics';
import { Icon, type IconName } from '@/components/Icon';
import { AddNestRow, NestActionsSheet, NestRow } from '@/components/NestSheets';
import { PhotoSheet, type PhotoAction } from '@/components/PhotoSheet';
import { SettingsRow } from '@/components/SettingsRow';
import { Sheet } from '@/components/Sheet';
import { LogoutButton } from '@/components/LogoutButton';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, ErrorBanner, PressableScale, TabHeader, TextField, tap } from '@/components/ui';
import { makeStyles, usePreferences, type LanguagePref, type ThemePref } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { ensureNotificationPermission, hasNotificationPermission, notificationsSupported } from '@/services/notifications';
import { useSavings, useSession, type Nest } from '@/store/SavingsContext';
import { darkTheme, lightTheme, radius, spacing, type, type Theme } from '@/theme';
import { goBackToHome } from '@/utils/navigation';
import { cropToAvatar, pickImage, type PickedImage } from '@/utils/photo';
import { useAction } from '@/utils/useAction';

export default function SettingsScreen() {
  const s = useStyles();
  const { t, prefs, setLanguage, setTheme, setPref, theme } = usePreferences();
  const { colors } = theme;
  const { me, currency } = useSavings();
  const { nests, archived } = useSession();
  const tabBarSpace = useTabBarSpace();

  const [photoSheet, setPhotoSheet] = useState(false);
  const [languageSheet, setLanguageSheet] = useState(false);
  const [nestSheet, setNestSheet] = useState<Nest | null>(null);
  const [cropping, setCropping] = useState<PickedImage | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifGranted, setNotifGranted] = useState(false);
  useEffect(() => {
    hasNotificationPermission()
      .then(setNotifGranted)
      .catch(() => {});
  }, []);

  /** Turns a notification preference on (asking for permission first) or off. */
  const toggleNotifications = async (key: 'reminders' | 'monthlyRecap', value: boolean) => {
    setNotice(null);
    if (value && !notificationsSupported) return setNotice(t('settings.webUnavailable'));
    if (value && !(await ensureNotificationPermission())) return setNotice(t('settings.notificationsDenied'));
    if (value) setNotifGranted(true);
    setPref(key, value);
  };

  // Biometric sign-in: available when the device has Face ID / fingerprint enrolled.
  const [bioKind, setBioKind] = useState<BiometryKind | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioSheet, setBioSheet] = useState(false);
  const [bioPassword, setBioPassword] = useState('');
  const bioSave = useAction(async () => {
    // Verify the password with the server before storing it.
    await backend.login({ identifier: me.email, password: bioPassword });
    await enableBiometricLogin(me.email, bioPassword, t('bio.prompt'));
    setBioEnabled(true);
    setBioSheet(false);
    setBioPassword('');
    tap('success');
  });
  useEffect(() => {
    getBiometry()
      .then(setBioKind)
      .catch(() => {});
    getEnrolledIdentifier()
      .then((id) => setBioEnabled(id?.toLowerCase() === me.email.toLowerCase()))
      .catch(() => {});
  }, [me.email]);
  const bioMethod = t(biometryLabelKey(bioKind ?? 'generic'));

  const toggleBiometrics = async (value: boolean) => {
    setNotice(null);
    if (!value) {
      await disableBiometricLogin();
      setBioEnabled(false);
      return;
    }
    if (!biometricsSupported) return setNotice(t('settings.webUnavailable'));
    if (!bioKind) return setNotice(t('settings.lockUnavailable'));
    setBioSheet(true);
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#FFFFFF" />
  );

  const photo = useAction(async (action: PhotoAction) => {
    if (action === 'remove') return backend.updateProfile({ photo: null });
    const picked = await pickImage(action);
    if (picked) setCropping(picked);
  });

  const onPhotoAction = (action: PhotoAction) => {
    setPhotoSheet(false);
    // Let the sheet finish closing before presenting the system picker.
    setTimeout(() => photo.run(action), 250);
  };

  const onCropped = async (rect: { originX: number; originY: number; size: number }) => {
    if (!cropping) return;
    await backend.updateProfile({ photo: await cropToAvatar(cropping, rect) });
    setCropping(null);
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(me.code);
    tap('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const languages: { value: LanguagePref; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ];
  const themes: { value: ThemePref; label: string; icon: IconName }[] = [
    { value: 'system', label: t('settings.system'), icon: 'smartphone' },
    { value: 'light', label: t('settings.light'), icon: 'sun' },
    { value: 'dark', label: t('settings.dark'), icon: 'moon' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <TabHeader title={t('settings.title')} onBack={goBackToHome} trailing={<LogoutButton />} />
        <View style={s.profile}>
          <PressableScale onPress={() => setPhotoSheet(true)} accessibilityLabel={t('profile.changePhoto')} scaleTo={0.94}>
            <Avatar user={me} color={colors.me} size={68} />
            <View style={s.cameraBadge}>
              <Icon name="camera" size={12} color={colors.onPrimary} />
            </View>
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {me.name}
            </Text>
            <Text style={s.handle} numberOfLines={1}>
              @{me.username}
            </Text>
            <Text style={s.email} numberOfLines={1}>
              {me.email}
            </Text>
          </View>
          <PressableScale onPress={() => router.push('/edit-profile')} style={s.editPill} scaleTo={0.92}>
            <Icon name="edit" size={14} color={colors.text} />
            <Text style={s.editText}>{t('settings.editProfile')}</Text>
          </PressableScale>
        </View>
        <ErrorBanner message={photo.error} />

        <Text style={s.section}>{t('settings.account')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon="user-edit"
            label={t('settings.personalInfo')}
            hint={t('settings.personalInfoHint')}
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            icon="qr"
            label={t('profile.yourCode')}
            hint={copied ? t('common.copied') : `${me.code} · ${t('settings.tapToCopy')}`}
            onPress={copyCode}
            divider
            trailing={<Icon name={copied ? 'check-circle' : 'copy'} size={18} color={copied ? colors.success : colors.textSubtle} />}
          />
          <SettingsRow
            icon="trash"
            label={t('deleteAccount.title')}
            hint={t('deleteAccount.hint')}
            danger
            divider
            onPress={() => setDeleting(true)}
          />
        </Card>

        <Text style={s.section}>{t('nests.title')}</Text>
        <Card style={s.group}>
          {nests.map((nest, i) => (
            <NestRow key={nest.couple.id} nest={nest} active={i === 0} onPress={() => setNestSheet(nest)} divider={i > 0} />
          ))}
          <AddNestRow onPress={() => router.push('/add-partner')} />
          {archived.length > 0 && (
            <SettingsRow
              icon="archive"
              label={t('settings.archived')}
              hint={t('settings.archivedHint')}
              value={String(archived.length)}
              onPress={() => router.push('/archived')}
              divider
            />
          )}
        </Card>
        <Text style={s.caption}>{t('nests.manage')}</Text>

        <Text style={s.section}>{t('settings.preferences')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon="language"
            label={t('settings.language')}
            value={languages.find((l) => l.value === prefs.language)?.label}
            onPress={() => setLanguageSheet(true)}
          />
          <SettingsRow
            icon="coins"
            label={t('settings.currency')}
            hint={t(`currency.${currency}` as 'currency.MXN')}
            value={currency}
            onPress={() => router.push('/currency')}
            divider
          />
        </Card>

        <Text style={s.section}>{t('settings.theme')}</Text>
        <View style={s.themes}>
          {themes.map((option) => (
            <ThemeCard
              key={option.value}
              label={option.label}
              icon={option.icon}
              selected={prefs.theme === option.value}
              preview={option.value === 'dark' ? darkTheme : option.value === 'light' ? lightTheme : null}
              onPress={() => {
                tap('selection');
                setTheme(option.value);
              }}
            />
          ))}
        </View>

        <Text style={s.section}>{t('settings.notifications')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon="bell"
            label={t('settings.reminders')}
            hint={t('settings.remindersHint')}
            onPress={() => toggleNotifications('reminders', !(prefs.reminders && notifGranted))}
            trailing={toggle(prefs.reminders && notifGranted, (v) => toggleNotifications('reminders', v))}
          />
          <SettingsRow
            icon="calendar-clock"
            label={t('settings.monthly')}
            hint={t('settings.monthlyHint')}
            onPress={() => toggleNotifications('monthlyRecap', !(prefs.monthlyRecap && notifGranted))}
            trailing={toggle(prefs.monthlyRecap && notifGranted, (v) => toggleNotifications('monthlyRecap', v))}
            divider
          />
        </Card>

        <Text style={s.section}>{t('settings.security')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon={bioKind === 'face' ? 'face-id' : 'fingerprint'}
            label={t('bio.settingsLabel', { method: bioMethod })}
            hint={t('bio.settingsHint')}
            onPress={() => toggleBiometrics(!bioEnabled)}
            trailing={toggle(bioEnabled, toggleBiometrics)}
          />
          <SettingsRow
            icon="eye-off"
            label={t('settings.hideBalances')}
            hint={t('settings.hideBalancesHint')}
            onPress={() => setPref('hideBalances', !prefs.hideBalances)}
            trailing={toggle(prefs.hideBalances, (v) => setPref('hideBalances', v))}
            divider
          />
        </Card>
        {notice && <Text style={s.notice}>{notice}</Text>}

        <Text style={s.section}>{t('settings.data')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon="repeat"
            label={t('recurring.title')}
            hint={t('settings.recurringHint')}
            onPress={() => router.push('/recurring')}
          />
          <SettingsRow
            icon="download"
            label={t('settings.export')}
            hint={t('settings.exportHint')}
            onPress={() => setExporting(true)}
            divider
          />
        </Card>

        <Text style={s.section}>{t('legal.section')}</Text>
        <Card style={s.group}>
          <SettingsRow
            icon="shield"
            label={t('legal.privacy')}
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
          />
          <SettingsRow
            icon="receipt"
            label={t('legal.terms')}
            onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
            divider
          />
        </Card>

        <Text style={s.version}>{t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
      </ScrollView>

      <PhotoSheet visible={photoSheet} user={me} onClose={() => setPhotoSheet(false)} onSelect={onPhotoAction} />
      <NestActionsSheet nest={nestSheet} onClose={() => setNestSheet(null)} />
      <ExportSheet visible={exporting} onClose={() => setExporting(false)} />
      <DeleteAccountSheet visible={deleting} onClose={() => setDeleting(false)} />
      <Sheet visible={bioSheet} onClose={() => setBioSheet(false)}>
        <View style={{ gap: spacing.md }}>
          <Text style={s.sheetTitle}>{t('bio.confirmTitle')}</Text>
          <Text style={s.sheetBody}>{t('bio.confirmBody', { method: bioMethod })}</Text>
          <TextField
            label={t('auth.password')}
            icon="lock"
            value={bioPassword}
            onChangeText={setBioPassword}
            secure
            autoFocus
            onSubmitEditing={() => bioSave.run()}
          />
          <ErrorBanner message={bioSave.error} />
          <Button
            label={t('bio.save')}
            icon={bioKind === 'face' ? 'face-id' : 'fingerprint'}
            onPress={() => bioSave.run()}
            loading={bioSave.loading}
            disabled={!bioPassword}
          />
        </View>
      </Sheet>
      <Sheet visible={languageSheet} onClose={() => setLanguageSheet(false)}>
        <Text style={s.sheetTitle}>{t('settings.language')}</Text>
        <View style={{ marginTop: spacing.sm }}>
          {languages.map((l, i) => (
            <PressableScale
              key={l.value}
              scaleTo={0.985}
              onPress={() => {
                tap('selection');
                setLanguage(l.value);
                setLanguageSheet(false);
              }}
              style={[s.option, i > 0 && s.optionDivider]}>
              <Text style={s.optionLabel}>{l.label}</Text>
              {prefs.language === l.value && (
                <View style={s.check}>
                  <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />
                </View>
              )}
            </PressableScale>
          ))}
        </View>
      </Sheet>
      {cropping && <AvatarCropper key={cropping.uri} image={cropping} onCancel={() => setCropping(null)} onConfirm={onCropped} />}
    </SafeAreaView>
  );
}

/** Theme choice with a miniature preview of the palette. `preview: null` renders a split light/dark swatch. */
function ThemeCard({
  label,
  icon,
  selected,
  preview,
  onPress,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
  preview: Theme | null;
  onPress: () => void;
}) {
  const s = useStyles();
  const { theme } = usePreferences();
  const swatch = (p: Theme, style?: object) => (
    <View style={[s.swatch, { backgroundColor: p.colors.bg }, style]}>
      <View style={[s.swatchBar, { backgroundColor: p.colors.heroGradient[1] }]} />
      <View style={[s.swatchLine, { backgroundColor: p.colors.surface }]} />
      <View style={[s.swatchLine, { backgroundColor: p.colors.surface, width: '60%' }]} />
    </View>
  );
  return (
    <PressableScale containerStyle={{ flex: 1 }} onPress={onPress} haptic={false} style={[s.themeCard, selected && s.themeCardActive]}>
      {preview ? (
        swatch(preview)
      ) : (
        <View style={[s.swatch, { flexDirection: 'row', padding: 0, overflow: 'hidden' }]}>
          {swatch(lightTheme, { flex: 1, borderRadius: 0, borderWidth: 0 })}
          {swatch(darkTheme, { flex: 1, borderRadius: 0, borderWidth: 0 })}
        </View>
      )}
      <View style={s.themeLabelRow}>
        <Icon name={icon} size={14} color={selected ? theme.colors.accent : theme.colors.textMuted} />
        <Text style={[s.themeLabel, selected && { color: theme.colors.text }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    ...elevation,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...type.h3, fontSize: 18, fontFamily: type.h2.fontFamily, color: colors.text },
  handle: { ...type.smallStrong, color: colors.accent, marginTop: 1 },
  email: { ...type.small, color: colors.textMuted, marginTop: 1 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  editText: { ...type.smallStrong, fontSize: 12, color: colors.text },
  section: {
    ...type.tiny,
    color: colors.textSubtle,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  notice: { ...type.small, color: colors.danger, marginTop: spacing.sm, marginLeft: 4 },
  caption: { ...type.small, fontSize: 12, color: colors.textSubtle, marginTop: spacing.sm, marginLeft: 4 },
  group: { paddingVertical: spacing.xs },
  themes: { flexDirection: 'row', gap: spacing.sm + 2 },
  themeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: spacing.sm + 2,
    borderWidth: 2,
    borderColor: 'transparent',
    ...elevation,
  },
  themeCardActive: { borderColor: colors.accent },
  swatch: { height: 64, borderRadius: radius.sm, padding: 8, gap: 5, borderWidth: 1, borderColor: colors.border },
  swatchBar: { height: 16, borderRadius: 5 },
  swatchLine: { height: 7, borderRadius: 4 },
  themeLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  themeLabel: { ...type.smallStrong, color: colors.textMuted },
  version: { ...type.small, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.xl },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetBody: { ...type.small, color: colors.textMuted, lineHeight: 19, marginTop: -6 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  optionDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  optionLabel: { ...type.bodyStrong, color: colors.text },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
