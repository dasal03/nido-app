import { useEffect, useState } from 'react';
import { Animated, Platform, Text, View, type LayoutChangeEvent } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { Icon, type IconName } from '@/components/Icon';
import { Button, ErrorBanner, PressableScale, TextField, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { radius, type } from '@/theme';
import { useAction } from '@/utils/useAction';

type Mode = 'login' | 'register';
const NATIVE_DRIVER = Platform.OS !== 'web';

export default function AuthScreen() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('login');
  const [fade] = useState(() => new Animated.Value(1));

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
        {mode === 'login' ? <LoginForm /> : <RegisterForm />}
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

function LoginForm() {
  const { t } = useT();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { run, loading, error } = useAction(backend.login);
  const submit = () => run({ identifier, password });

  return (
    <View style={{ gap: 16 }}>
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
        placeholder="••••••"
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <ErrorBanner message={error} />
      <Button label={t('auth.loginCta')} iconRight="chevron" onPress={submit} loading={loading} disabled={!identifier || !password} style={{ marginTop: 8 }} />
    </View>
  );
}

function RegisterForm() {
  const { t } = useT();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { run, loading, error } = useAction(backend.register);
  const submit = () => run({ name, username, email, phone, password });

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label={t('auth.name')}
        icon="user"
        value={name}
        onChangeText={setName}
        placeholder={t('auth.namePlaceholder')}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="givenName"
        maxLength={24}
      />
      <TextField
        label={t('auth.username')}
        icon="at"
        value={username}
        onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
        placeholder={t('auth.usernamePlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={20}
      />
      <TextField
        label={t('auth.email')}
        icon="mail"
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.phone')}
        icon="phone"
        value={phone}
        onChangeText={setPhone}
        placeholder={t('auth.phonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={20}
      />
      <TextField
        label={t('auth.password')}
        icon="lock"
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.newPasswordPlaceholder')}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <ErrorBanner message={error} />
      <Button
        label={t('auth.registerCta')}
        iconRight="chevron"
        onPress={submit}
        loading={loading}
        disabled={!name || !username || !email || !phone || !password}
        style={{ marginTop: 8 }}
      />
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
}));
