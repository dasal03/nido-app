import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { BackendError } from '@/services/types';
import { radius, spacing, type } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Button, ErrorBanner, tap } from './ui';

export interface ConfirmOptions {
  /** 'danger' (default) for destructive actions, 'primary' for everything else. */
  tone?: 'danger' | 'primary';
  icon?: IconName;
  /** Extra content between the message and the buttons (e.g. a breakdown). */
  content?: ReactNode;
  /** Label of the dismiss button (defaults to "Cancel"). */
  cancelLabel?: string;
}

type ConfirmFn = (title: string, message: string, confirmLabel: string, onConfirm: () => unknown, options?: ConfirmOptions) => void;

interface Pending extends ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => unknown;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Asks for confirmation with a dialog that follows the app's design (instead of the system alert). */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback<ConfirmFn>((title, message, confirmLabel, onConfirm, options) => {
    setError(null);
    setPending({ title, message, confirmLabel, onConfirm, ...options });
  }, []);

  const close = () => {
    if (!busy) setPending(null);
  };

  const accept = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await pending.onConfirm();
      setPending(null);
    } catch (e) {
      setError(t(e instanceof BackendError ? e.key : 'errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const danger = (pending?.tone ?? 'danger') === 'danger';
  const tint = danger ? colors.danger : colors.accent;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!pending} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <Pressable style={s.backdrop} onPress={close}>
          {/* Stop taps on the card from closing the dialog. */}
          <Pressable style={s.card} onPress={() => {}}>
            {pending && (
              <>
                <View style={[s.icon, { backgroundColor: danger ? colors.dangerSoft : colors.accentSoft }]}>
                  <Icon name={pending.icon ?? (danger ? 'warning' : 'check-circle')} size={28} color={tint} strokeWidth={2.2} />
                </View>
                <Text style={s.title}>{pending.title}</Text>
                {!!pending.message && <Text style={s.message}>{pending.message}</Text>}
                {pending.content}
                <ErrorBanner message={error} />
                <View style={s.buttons}>
                  <Button
                    label={pending.confirmLabel}
                    variant={danger ? 'danger' : 'primary'}
                    loading={busy}
                    onPress={() => {
                      tap(danger ? 'light' : 'success');
                      accept();
                    }}
                  />
                  <Button label={pending.cancelLabel ?? t('common.cancel')} variant="secondary" onPress={close} disabled={busy} />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(6, 10, 22, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    boxShadow: '0px 18px 48px rgba(6, 10, 22, 0.28)',
  },
  icon: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  title: { ...type.h2, color: colors.text, textAlign: 'center' },
  message: { ...type.body, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  buttons: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
}));
