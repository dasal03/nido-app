import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { DatePickerSheet, PhoneField, PickerSheet, useCountryOptions } from '@/components/FormPickers';
import { Icon, type IconName } from '@/components/Icon';
import { PasswordChecklist, ResetPasswordSheet } from '@/components/ResetPasswordSheet';
import { Button, ErrorBanner, LoadingOverlay, PressableScale, SelectField, SuccessBanner, TextField, tap } from '@/components/ui';
import { DEFAULT_COUNTRY, GENDERS, MIN_AGE, countryByCode } from '@/data/countries';
import type { TranslationKey } from '@/i18n/es';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend, BackendError } from '@/services/backend';
import {
  disableBiometricLogin,
  getBiometry,
  getEnrolledIdentifier,
  maybeOfferBiometrics,
  unlockCredentials,
  type BiometryKind,
} from '@/services/biometrics';
import { radius, spacing, type } from '@/theme';
import { useAction } from '@/utils/useAction';
import {
  phoneDigitsLabel,
  validateBirthday,
  validateConfirm,
  validateDocument,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  validateUsername,
  type FieldError,
} from '@/utils/validation';

type Mode = 'login' | 'register';
const NATIVE_DRIVER = Platform.OS !== 'web';

export default function AuthScreen() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('login');
  const [fade] = useState(() => new Animated.Value(1));
  /** Set after sign-up when the email must be confirmed: shows a success notice on the login form. */
  const [created, setCreated] = useState<string | null>(null);

  const switchTo = (next: Mode) => {
    if (next === mode) return;
    tap('selection');
    fade.setValue(0);
    setMode(next);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: NATIVE_DRIVER }).start();
  };

  return (
    <AuthShell title={t('auth.headline')} subtitle={t(mode === 'login' ? 'auth.loginSubtitle' : 'auth.registerSubtitle')}>
      <AuthSwitch mode={mode} onChange={switchTo} />
      <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        {mode === 'login' ? (
          <LoginForm key={created ?? 'login'} createdEmail={created} />
        ) : (
          <RegisterWizard
            onCreated={(email) => {
              setCreated(email);
              switchTo('login');
            }}
          />
        )}
      </Animated.View>
    </AuthShell>
  );
}

/** Two-option switch with a sliding indicator. */
function AuthSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const half = width / 2 - 4;

  useEffect(() => {
    Animated.spring(x, { toValue: mode === 'login' ? 0 : half, useNativeDriver: NATIVE_DRIVER, speed: 18, bounciness: 6 }).start();
  }, [mode, half, x]);

  const options: { value: Mode; label: string; icon: IconName }[] = [
    { value: 'login', label: t('auth.tabLogin'), icon: 'login' },
    { value: 'register', label: t('auth.tabRegister'), icon: 'user-plus' },
  ];

  return (
    <View style={s.switch} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && <Animated.View style={[s.indicator, { width: half, transform: [{ translateX: x }] }]} />}
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            haptic={false}
            scaleTo={0.96}
            containerStyle={{ flex: 1 }}
            onPress={() => onChange(o.value)}
            style={s.option}>
            <Icon name={o.icon} size={16} color={active ? colors.text : colors.textSubtle} strokeWidth={2.2} />
            <Text style={[s.optionLabel, active && s.optionLabelActive]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const bioLabelKey = (kind: BiometryKind): TranslationKey =>
  kind === 'face' ? 'bio.face' : kind === 'fingerprint' ? 'bio.fingerprint' : 'bio.generic';

function LoginForm({ createdEmail }: { createdEmail: string | null }) {
  const { t } = useT();
  const { colors } = useTheme();
  const s = useStyles();
  const [identifier, setIdentifier] = useState(createdEmail ?? '');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState<{ kind: BiometryKind; identifier: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resent, setResent] = useState(false);
  const resend = useAction(backend.resendConfirmation);
  const { run, loading, error, setError } = useAction(async (creds: { identifier: string; password: string }, offer: boolean) => {
    await backend.login(creds);
    if (offer) await maybeOfferBiometrics(creds.identifier, creds.password);
  });

  useEffect(() => {
    let alive = true;
    Promise.all([getBiometry(), getEnrolledIdentifier()]).then(([kind, enrolled]) => {
      if (alive && kind && enrolled) setBio({ kind, identifier: enrolled });
    });
    return () => {
      alive = false;
    };
  }, []);

  const submit = () => run({ identifier, password }, true);

  const biometricLogin = async () => {
    const creds = await unlockCredentials(t('bio.prompt'));
    if (!creds) return;
    const ok = await run(creds, false);
    // The saved password no longer works (changed elsewhere): turn biometric sign-in off.
    if (!ok) {
      await disableBiometricLogin();
      setBio(null);
      setError(t('errors.badCredentials'));
    }
  };

  const method = bio ? t(bioLabelKey(bio.kind)) : '';

  return (
    <View style={{ gap: 16 }}>
      {createdEmail && <SuccessBanner title={t('auth.createdTitle')} message={t('auth.createdConfirm', { email: createdEmail })} />}
      {bio && (
        <>
          <Button
            label={t('auth.biometricLogin', { method })}
            icon={bio.kind === 'face' ? 'face-id' : 'fingerprint'}
            onPress={biometricLogin}
          />
          <View style={s.dividerRow}>
            <View style={[s.line, { backgroundColor: colors.border }]} />
            <Text style={s.dividerText}>@{bio.identifier.split('@')[0]}</Text>
            <View style={[s.line, { backgroundColor: colors.border }]} />
          </View>
        </>
      )}
      <TextField
        label={t('auth.identifier')}
        icon="user"
        value={identifier}
        onChangeText={setIdentifier}
        placeholder={t('auth.identifierPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
      />
      <TextField
        label={t('auth.password')}
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Pressable onPress={() => setResetting(true)} hitSlop={8} style={s.forgot} accessibilityRole="button">
        <Text style={s.forgotText}>{t('reset.link')}</Text>
      </Pressable>
      <ErrorBanner message={error} />
      {(error === t('errors.emailNotConfirmed') || !!createdEmail) && !!identifier && (
        <Pressable
          onPress={async () => {
            setResent(false);
            if (await resend.run(identifier)) setResent(true);
          }}
          disabled={resend.loading}
          style={s.resend}
          accessibilityRole="button">
          <Icon name={resent ? 'check-circle' : 'mail'} size={16} color={resent ? colors.success : colors.accent} />
          <Text style={[s.forgotText, resent && { color: colors.success }]}>{t(resent ? 'auth.resent' : 'auth.resend')}</Text>
        </Pressable>
      )}
      {!!resend.error && <Text style={s.resendError}>{resend.error}</Text>}
      <Button
        label={t('auth.loginCta')}
        iconRight="chevron"
        variant={bio ? 'secondary' : 'primary'}
        onPress={submit}
        disabled={!identifier || !password}
      />
      <LoadingOverlay visible={loading} message={t('auth.signingIn')} />
      <ResetPasswordSheet visible={resetting} initialEmail={identifier} onClose={() => setResetting(false)} />
    </View>
  );
}

type Field =
  | 'name'
  | 'username'
  | 'email'
  | 'country'
  | 'documentType'
  | 'documentNumber'
  | 'birthday'
  | 'gender'
  | 'phone'
  | 'password'
  | 'confirm'
  | 'terms';
const STEPS: { title: TranslationKey; fields: Field[] }[] = [
  { title: 'auth.stepAccount', fields: ['name', 'username', 'email'] },
  { title: 'auth.stepAbout', fields: ['country', 'documentType', 'documentNumber', 'birthday', 'gender', 'phone'] },
  { title: 'auth.stepSecurity', fields: ['password', 'confirm', 'terms'] },
];

/** Three-step sign-up with live validation; shows a loading overlay while the account is created. */
function RegisterWizard({ onCreated }: { onCreated: (email: string) => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, language, locale } = useT();
  const countryOptions = useCountryOptions();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    name: '',
    username: '',
    email: '',
    country: DEFAULT_COUNTRY,
    documentType: '',
    documentNumber: '',
    birthday: '',
    gender: '',
    phoneCountry: DEFAULT_COUNTRY,
    phone: '',
    password: '',
    confirm: '',
    terms: false,
  });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [picker, setPicker] = useState<'country' | 'phoneCountry' | 'document' | 'gender' | 'birthday' | null>(null);
  /** Last availability answer from the server, tied to the username it was asked for. */
  const [usernameCheck, setUsernameCheck] = useState<{ username: string; email: string; available: boolean } | null>(null);
  const [documentTaken, setDocumentTaken] = useState(false);
  const [checkingStep, setCheckingStep] = useState(false);
  // Only used for its error state; the call itself needs the `needsConfirmation` result.
  const register = useAction(backend.register);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const touch = (field: Field) => setTouched((tt) => ({ ...tt, [field]: true }));
  const country = countryByCode(values.country);
  const document = country.documents.find((d) => d.id === values.documentType);

  // Username availability, checked live (debounced) once the format is valid.
  useEffect(() => {
    if (validateUsername(values.username)) return;
    let alive = true;
    const username = values.username;
    // With the email, retrying a sign-up that was never confirmed can reuse its own username.
    const email = validateEmail(values.email) ? '' : values.email.trim().toLowerCase();
    const id = setTimeout(() => {
      backend
        .isUsernameAvailable(username, email || undefined)
        .then((available) => alive && setUsernameCheck({ username, email, available }))
        .catch(() => {});
    }, 450);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [values.username, values.email]);
  const usernameState: 'checking' | 'available' | 'taken' | null = validateUsername(values.username)
    ? null
    : usernameCheck?.username !== values.username
      ? 'checking'
      : usernameCheck.available
        ? 'available'
        : usernameCheck.email !== (validateEmail(values.email) ? '' : values.email.trim().toLowerCase())
          ? 'checking'
          : 'taken';

  const errors: Record<Field, FieldError> = useMemo(
    () => ({
      name: validateName(values.name),
      username: validateUsername(values.username) ?? (usernameState === 'taken' ? 'errors.usernameTaken' : null),
      email: validateEmail(values.email),
      country: values.country ? null : 'validation.required',
      documentType: values.documentType ? null : 'validation.required',
      documentNumber:
        validateDocument(values.country, values.documentType || '-', values.documentNumber) ??
        (documentTaken ? 'errors.documentTaken' : null),
      birthday: validateBirthday(values.birthday),
      gender: values.gender ? null : 'validation.required',
      phone: validatePhone(values.phoneCountry, values.phone),
      password: validatePassword(values.password),
      confirm: validateConfirm(values.password, values.confirm),
      terms: values.terms ? null : 'validation.terms',
    }),
    [values, usernameState, documentTaken],
  );

  const show = (field: Field) => (touched[field] || attempted[step] ? errors[field] : null);
  const err = (field: Field) => {
    const key = show(field);
    return key ? t(key, { n: phoneDigitsLabel(values.phoneCountry) }) : null;
  };
  const ok = (field: Field) => (touched[field] && !errors[field] ? ' ' : null);
  const stepValid = STEPS[step].fields.every((f) => !errors[f]) && (step !== 0 || usernameState === 'available');

  const next = async () => {
    if (!stepValid) {
      setAttempted((a) => ({ ...a, [step]: true }));
      tap('selection');
      return;
    }
    if (step === 1) {
      // Check the identity document isn't already registered before moving on.
      setCheckingStep(true);
      const available = await backend
        .isDocumentAvailable(values.country, values.documentType, values.documentNumber, values.email)
        .catch(() => true);
      setCheckingStep(false);
      if (!available) {
        setDocumentTaken(true);
        setAttempted((a) => ({ ...a, 1: true }));
        return;
      }
    }
    if (step < STEPS.length - 1) {
      tap();
      setStep(step + 1);
      return;
    }
    await create();
  };

  /** Creates the account; on success with email confirmation, returns to sign-in with a notice. */
  const create = async () => {
    register.setError(null);
    try {
      setCheckingStep(true);
      const { needsConfirmation } = await backend.register({
        name: values.name,
        username: values.username,
        email: values.email,
        phone: `${countryByCode(values.phoneCountry).dial} ${values.phone}`,
        password: values.password,
        country: values.country,
        birthday: values.birthday,
        gender: values.gender,
        documentType: values.documentType,
        documentNumber: values.documentNumber,
      });
      tap('success');
      if (needsConfirmation) onCreated(values.email.trim().toLowerCase());
    } catch (e) {
      const key = e instanceof BackendError ? e.key : 'errors.generic';
      register.setError(t(key));
      if (key === 'errors.usernameTaken') setStep(0);
      if (key === 'errors.documentTaken') {
        setDocumentTaken(true);
        setStep(1);
      }
    } finally {
      setCheckingStep(false);
    }
  };

  const birthdayLabel = values.birthday
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${values.birthday}T12:00:00`))
    : null;

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <View style={s.stepHeader}>
          <Text style={s.stepTitle}>{t(STEPS[step].title)}</Text>
          <Text style={s.stepCount}>{t('auth.stepOf', { n: step + 1, total: STEPS.length })}</Text>
        </View>
        <View style={s.stepBars}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.stepBar, { backgroundColor: i <= step ? colors.accent : colors.surfaceAlt }]} />
          ))}
        </View>
      </View>

      {step === 0 && (
        <>
          <TextField
            label={t('auth.name')}
            icon="user"
            value={values.name}
            onChangeText={(v) => set('name', v)}
            onBlur={() => touch('name')}
            placeholder={t('auth.namePlaceholder')}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={60}
            error={err('name')}
            success={ok('name')}
          />
          <TextField
            label={t('auth.username')}
            icon="at"
            value={values.username}
            onChangeText={(v) => set('username', v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            onBlur={() => touch('username')}
            placeholder={t('auth.usernamePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            maxLength={20}
            error={values.username && usernameState === 'taken' ? t('errors.usernameTaken') : err('username')}
            pending={usernameState === 'checking' ? t('validation.checking') : null}
            success={usernameState === 'available' ? t('validation.usernameAvailable') : null}
          />
          <TextField
            label={t('auth.email')}
            icon="mail"
            value={values.email}
            onChangeText={(v) => set('email', v)}
            onBlur={() => touch('email')}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            error={err('email')}
            success={ok('email')}
          />
        </>
      )}

      {step === 1 && (
        <>
          <SelectField
            label={t('auth.country')}
            value={country.name[language]}
            placeholder={t('auth.select')}
            leading={<Text style={{ fontSize: 20 }}>{country.flag}</Text>}
            onPress={() => setPicker('country')}
            error={err('country')}
          />
          <SelectField
            label={t('auth.documentType')}
            icon="id-card"
            value={document ? `${document.id} · ${document.name[language]}` : null}
            placeholder={t('auth.select')}
            onPress={() => setPicker('document')}
            error={err('documentType')}
          />
          <TextField
            label={t('auth.documentNumber')}
            icon="id-card"
            value={values.documentNumber}
            onChangeText={(v) => {
              setDocumentTaken(false);
              set('documentNumber', (document?.numeric ? v.replace(/\D/g, '') : v.toUpperCase().replace(/[^A-Z0-9-]/g, '')).slice(0, 20));
            }}
            onBlur={() => touch('documentNumber')}
            keyboardType={document?.numeric ? 'number-pad' : 'default'}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!!document}
            error={values.documentType ? err('documentNumber') : null}
            success={values.documentType ? ok('documentNumber') : null}
          />
          <SelectField
            label={t('auth.birthday')}
            icon="calendar"
            value={birthdayLabel}
            placeholder={t('auth.birthdayPlaceholder')}
            onPress={() => setPicker('birthday')}
            error={values.birthday || attempted[1] ? (errors.birthday ? t(errors.birthday) : null) : null}
          />
          <SelectField
            label={t('auth.gender')}
            icon="gender"
            value={values.gender ? t(`gender.${values.gender}` as TranslationKey) : null}
            placeholder={t('auth.select')}
            onPress={() => setPicker('gender')}
            error={err('gender')}
          />
          <PhoneField
            label={t('auth.phone')}
            country={values.phoneCountry}
            digits={values.phone}
            onChangeDigits={(v) => set('phone', v)}
            onPressCountry={() => setPicker('phoneCountry')}
            onBlur={() => touch('phone')}
            error={err('phone')}
            success={ok('phone')}
          />
        </>
      )}

      {step === 2 && (
        <>
          <TextField
            label={t('auth.password')}
            icon="lock"
            value={values.password}
            onChangeText={(v) => set('password', v)}
            onBlur={() => touch('password')}
            placeholder="••••••••"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            error={attempted[2] && errors.password ? t(errors.password) : null}
          />
          <PasswordChecklist password={values.password} />
          <TextField
            label={t('auth.confirmPassword')}
            icon="lock"
            value={values.confirm}
            onChangeText={(v) => set('confirm', v)}
            onBlur={() => touch('confirm')}
            placeholder="••••••••"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            error={values.confirm ? (err('confirm') ?? (errors.confirm ? t(errors.confirm) : null)) : err('confirm')}
            success={values.confirm && !errors.confirm ? ' ' : null}
          />
          <Pressable
            onPress={() => {
              tap('selection');
              set('terms', !values.terms);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: values.terms }}
            style={s.terms}>
            <Icon
              name={values.terms ? 'checkbox-on' : 'checkbox'}
              size={22}
              color={values.terms ? colors.accent : err('terms') ? colors.danger : colors.textSubtle}
            />
            <Text style={s.termsText}>
              {t('auth.termsPrefix')}
              <Text style={s.termsLink} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}>
                {t('auth.termsLink')}
              </Text>
              {t('auth.termsAnd')}
              <Text style={s.termsLink} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}>
                {t('auth.privacyLink')}
              </Text>
              {t('auth.termsSuffix')}
            </Text>
          </Pressable>
          {err('terms') && <Text style={s.termsError}>{err('terms')}</Text>}
        </>
      )}

      <ErrorBanner message={register.error} />
      <View style={s.nav}>
        {step > 0 && <Button label={t('auth.back')} variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        <Button
          label={step === STEPS.length - 1 ? t('auth.registerCta') : t('auth.next')}
          iconRight="chevron"
          onPress={next}
          loading={checkingStep && step === 1}
          style={{ flex: 2 }}
        />
      </View>

      <PickerSheet
        visible={picker === 'country'}
        title={t('auth.country')}
        options={countryOptions}
        selected={values.country}
        searchPlaceholder={t('auth.searchCountry')}
        onSelect={(code) => {
          setValues((v) => ({
            ...v,
            country: code,
            documentType: '',
            documentNumber: '',
            phoneCountry: v.phoneCountry === v.country ? code : v.phoneCountry,
          }));
          setDocumentTaken(false);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'phoneCountry'}
        title={t('auth.phone')}
        options={countryOptions}
        selected={values.phoneCountry}
        searchPlaceholder={t('auth.searchCountry')}
        onSelect={(code) => set('phoneCountry', code)}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'document'}
        title={t('auth.documentType')}
        options={country.documents.map((d) => ({ value: d.id, label: d.name[language], sublabel: d.id }))}
        selected={values.documentType}
        onSelect={(id) => {
          setValues((v) => ({ ...v, documentType: id, documentNumber: '' }));
          setDocumentTaken(false);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'gender'}
        title={t('auth.gender')}
        options={GENDERS.map((g) => ({ value: g, label: t(`gender.${g}` as TranslationKey) }))}
        selected={values.gender}
        onSelect={(g) => set('gender', g)}
        onClose={() => setPicker(null)}
      />
      <DatePickerSheet
        visible={picker === 'birthday'}
        value={values.birthday}
        minAge={MIN_AGE}
        onChange={(iso) => {
          set('birthday', iso);
          touch('birthday');
        }}
        onClose={() => setPicker(null)}
      />
      <LoadingOverlay visible={checkingStep && step === STEPS.length - 1} message={t('auth.creating')} />
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  switch: {
    flexDirection: 'row',
    height: 52,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...elevation,
  },
  option: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  optionLabel: { ...type.bodyStrong, fontSize: 14, color: colors.textSubtle },
  optionLabelActive: { color: colors.text },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1 },
  dividerText: { ...type.small, color: colors.textSubtle },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stepTitle: { ...type.h3, color: colors.text },
  stepCount: { ...type.small, color: colors.textMuted },
  stepBars: { flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 5, borderRadius: 3 },
  resend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  resendError: { ...type.small, color: colors.danger, textAlign: 'center' },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { ...type.smallStrong, color: colors.accent },
  terms: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: 4 },
  termsText: { ...type.small, color: colors.text, flex: 1, lineHeight: 19 },
  termsLink: { fontFamily: type.bodyStrong.fontFamily, color: colors.accent },
  termsError: { ...type.small, fontSize: 12, color: colors.danger, marginTop: -8 },
  nav: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: 4 },
}));
