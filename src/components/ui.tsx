import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { radius, spacing, type } from '@/theme';
import { Icon, type IconName } from './Icon';

const NATIVE_DRIVER = Platform.OS !== 'web';

export function tap(style: 'light' | 'success' | 'selection' = 'light') {
  if (Platform.OS === 'web') return;
  if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (style === 'selection') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Returns a cross-platform destructive confirmation (Alert buttons are no-ops on web). */
export function useConfirm() {
  const { t } = useT();
  return (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  };
}

/** Pressable with a springy scale-down and a light haptic — the base of every tappable surface. */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.97,
  haptic = true,
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Style of the animated surface. */
  style?: StyleProp<ViewStyle>;
  /** Layout style of the outer touch target (flex, width…). */
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: NATIVE_DRIVER, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPressIn={() => spring(scaleTo)}
      onPressOut={() => spring(1)}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}>
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

const LAYOUT_KEYS = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'position', 'top', 'left', 'right', 'bottom']);

/** Splits a style into layout props (for the outer touch target) and visual props (for the animated surface). */
function splitLayout(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) (LAYOUT_KEYS.has(key) ? outer : inner)[key] = value;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const v = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.border },
    soft: { bg: colors.accentSoft, fg: colors.accent, border: colors.accentSoft },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  const { outer, inner } = splitLayout(style);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      containerStyle={outer}
      style={[s.button, { backgroundColor: v.bg, borderColor: v.border }, inner]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={v.fg} strokeWidth={2.4} />}
          <Text style={[s.buttonLabel, { color: v.fg }]}>{label}</Text>
          {iconRight && <Icon name={iconRight} size={18} color={v.fg} strokeWidth={2.4} />}
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, tone = 'surface' }: { icon: IconName; onPress: () => void; label: string; tone?: 'surface' | 'glass' }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      scaleTo={0.9}
      style={[s.iconButton, tone === 'glass' && s.iconButtonGlass]}>
      <Icon name={icon} size={20} color={tone === 'glass' ? colors.onHero : colors.text} />
    </PressableScale>
  );
}

/** Top bar for stacked screens and modals: leading action, centered title, optional trailing action. */
export function ScreenHeader({
  title,
  leading = 'back',
  onLeading,
  trailing,
}: {
  title?: string;
  leading?: 'back' | 'close';
  onLeading: () => void;
  trailing?: ReactNode;
}) {
  const s = useStyles();
  const { t } = useT();
  return (
    <View style={s.header}>
      <IconButton icon={leading} label={t(leading === 'back' ? 'common.back' : 'common.close')} onPress={onLeading} />
      {title ? <Text style={s.headerTitle}>{title}</Text> : <View />}
      {trailing ?? <View style={{ width: 42 }} />}
    </View>
  );
}

/** Large-title header for tab screens, with a back button before the title. */
export function TabHeader({ title, onBack, trailing }: { title: string; onBack: () => void; trailing?: ReactNode }) {
  const s = useStyles();
  const { t } = useT();
  return (
    <View style={s.tabHeader}>
      <IconButton icon="back" label={t('common.back')} onPress={onBack} />
      <Text style={s.tabHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const s = useStyles();
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Progress bar that animates to its value on mount and on change. */
export function ProgressBar({ progress, color, height = 8, track }: { progress: number; color?: string; height?: number; track?: string }) {
  const { colors } = useTheme();
  const [value] = useState(() => new Animated.Value(0));
  const pct = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    Animated.timing(value, { toValue: pct, duration: 700, delay: 80, useNativeDriver: false }).start();
  }, [pct, value]);
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? colors.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={{ width, height: '100%', borderRadius: height, backgroundColor: color ?? colors.accent }} />
    </View>
  );
}

export function Chip({ label, selected, onPress, leading }: { label: string; selected: boolean; onPress: () => void; leading?: ReactNode }) {
  const s = useStyles();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap('selection');
        onPress();
      }}
      haptic={false}
      scaleTo={0.95}
      style={[s.chip, selected && s.chipSelected]}>
      {leading}
      <Text style={[s.chipLabel, selected && s.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Pill segmented control with optional icons, used for theme and language choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            haptic={false}
            scaleTo={0.95}
            containerStyle={{ flex: 1 }}
            onPress={() => {
              tap('selection');
              onChange(o.value);
            }}
            style={[s.segment, active && s.segmentActive]}>
            {o.icon && <Icon name={o.icon} size={16} color={active ? colors.text : colors.textMuted} />}
            <Text style={[s.segmentLabel, active && s.segmentLabelActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function TextField({ label, icon, secure, editable = true, ...input }: TextInputProps & { label: string; icon: IconName; secure?: boolean }) {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.field, focused && s.fieldFocused, !editable && s.fieldDisabled]}>
        <Icon name={icon} size={18} color={focused ? colors.accent : colors.textSubtle} />
        <TextInput
          {...input}
          editable={editable}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.textSubtle}
          keyboardAppearance={dark ? 'dark' : 'light'}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[s.fieldInput, !editable && { color: colors.textMuted }]}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={t(hidden ? 'auth.showPassword' : 'auth.hidePassword')}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={20} color={colors.textSubtle} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  const s = useStyles();
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={s.error} accessibilityRole="alert">
      <Icon name="alert" size={18} color={colors.danger} />
      <Text style={s.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...elevation },
  button: {
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonLabel: { ...type.bodyStrong, fontSize: 16 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...elevation,
  },
  iconButtonGlass: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTitle: { ...type.h3, color: colors.text },
  tabHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginVertical: spacing.sm },
  tabHeaderTitle: { ...type.h1, color: colors.text, flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg + 4,
    marginBottom: spacing.sm + 4,
  },
  sectionTitle: { ...type.h2, color: colors.text },
  sectionAction: { ...type.smallStrong, fontSize: 14, color: colors.accent },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...type.smallStrong, color: colors.text },
  chipLabelSelected: { color: colors.onPrimary },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4, gap: 4 },
  segment: {
    height: 40,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  segmentActive: { backgroundColor: colors.surface, ...elevation, borderWidth: 0 },
  segmentLabel: { ...type.smallStrong, color: colors.textMuted },
  segmentLabelActive: { color: colors.text },
  fieldLabel: { ...type.smallStrong, color: colors.textMuted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    height: 54,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldFocused: { borderColor: colors.accent },
  fieldDisabled: { backgroundColor: colors.surfaceAlt, borderColor: colors.surfaceAlt },
  fieldInput: { flex: 1, minWidth: 0, height: '100%', ...type.body, color: colors.text, outlineWidth: 0 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md - 4,
  },
  errorText: { ...type.smallStrong, color: colors.danger, flex: 1 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...type.h3, color: colors.text, marginBottom: 4 },
  emptyBody: { ...type.small, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
}));
