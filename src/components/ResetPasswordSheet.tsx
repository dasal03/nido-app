import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { disableBiometricLogin } from '@/services/biometrics';
import { radius, spacing, type } from '@/theme';
import { useAction } from '@/utils/useAction';
import { PASSWORD_RULES, validateConfirm, validateEmail, validatePassword } from '@/utils/validation';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, ErrorBanner, SuccessBanner, TextField, tap } from './ui';

/** Live checklist of the password rules. */
export function PasswordChecklist({ password }: { password: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={s.rules}>
      <Text style={s.rulesTitle}>{t('auth.passwordRules')}</Text>
      {PASSWORD_RULES.map((rule) => {
        const pass = rule.test(password);
        return (
          <View key={rule.id} style={s.rule}>
            <Icon name={pass ? 'check-circle' : 'x-circle'} size={15} color={pass ? colors.success : colors.textSubtle} />
            <Text style={[s.ruleText, pass && { color: colors.success }]}>{t(rule.key)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * "Forgot your password?": asks for the email, sends a 6-digit code, then sets a new password with
 * that code. On success the user is signed in (the router then leaves the login screen).
 */
export function ResetPasswordSheet({ visible, initialEmail, onClose }: { visible: boolean; initialEmail: string; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  // Start over each time the sheet opens.
  if (visible && !shown) {
    setShown(true);
    setStep('email');
    setEmail(initialEmail.includes('@') ? initialEmail.trim() : '');
    setCode('');
    setPassword('');
    setConfirm('');
    setDevCode(null);
  }
  if (!visible && shown) setShown(false);

  const send = useAction(async () => {
    const result = await backend.requestPasswordReset(email);
    setDevCode(result.devCode ?? null);
    setStep('code');
  });
  const reset = useAction(async () => {
    await backend.resetPassword({ email, code, password });
    // A saved biometric password would now be stale.
    await disableBiometricLogin().catch(() => {});
  });

  const emailError = email ? validateEmail(email) : null;
  const passwordError = password ? validatePassword(password) : null;
  const confirmError = confirm ? validateConfirm(password, confirm) : null;
  const canReset = /^\d{6}$/.test(code.trim()) && !validatePassword(password) && !validateConfirm(password, confirm);

  const submitReset = async () => {
    if (!canReset) return;
    if (await reset.run()) {
      tap('success');
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: spacing.md }}>
        <View style={s.head}>
          <View style={s.icon}>
            <Icon name={step === 'email' ? 'key' : 'mail'} size={26} color={colors.accent} />
          </View>
          <Text style={s.title}>{t(step === 'email' ? 'reset.title' : 'reset.codeTitle')}</Text>
          <Text style={s.body}>{step === 'email' ? t('reset.body') : t('reset.codeBody', { email: email.trim() })}</Text>
        </View>

        {step === 'email' ? (
          <>
            <TextField
              label={t('auth.email')}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={emailError ? t(emailError) : null}
              onSubmitEditing={() => !validateEmail(email) && send.run()}
            />
            <ErrorBanner message={send.error} />
            <Button
              label={t('reset.send')}
              icon="send"
              onPress={() => send.run()}
              loading={send.loading}
              disabled={!!validateEmail(email)}
            />
          </>
        ) : (
          <>
            {devCode && <SuccessBanner title={t('reset.devTitle')} message={t('reset.devBody', { code: devCode })} />}
            <TextField
              label={t('reset.code')}
              icon="key"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
            />
            <TextField
              label={t('reset.newPassword')}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              error={passwordError && password.length >= 8 ? t(passwordError) : null}
            />
            <PasswordChecklist password={password} />
            <TextField
              label={t('auth.confirmPassword')}
              icon="lock"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              error={confirmError ? t(confirmError) : null}
              success={confirm && !confirmError ? ' ' : null}
              onSubmitEditing={submitReset}
            />
            <ErrorBanner message={reset.error} />
            <Button label={t('reset.cta')} icon="check" onPress={submitReset} loading={reset.loading} disabled={!canReset} />
            <Button label={t('reset.resend')} variant="secondary" onPress={() => send.run()} loading={send.loading} />
          </>
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  head: { alignItems: 'center', gap: spacing.xs },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.h2, color: colors.text, textAlign: 'center' },
  body: { ...type.small, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  rules: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md - 2, gap: 6 },
  rulesTitle: { ...type.smallStrong, color: colors.textMuted, marginBottom: 2 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { ...type.small, color: colors.textMuted },
}));
