import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '@/providers/Preferences';
import { radius, spacing } from '@/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Bottom sheet with a fading backdrop and a spring slide-up; animates out before unmounting. */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  // Mount immediately when opened; unmount only after the closing animation finishes.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      Animated.spring(progress, { toValue: 1, useNativeDriver: NATIVE_DRIVER, speed: 16, bounciness: 4 }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: NATIVE_DRIVER }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, progress]);

  if (!mounted) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={s.anchor} pointerEvents="box-none">
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm, transform: [{ translateY }] }]}>
          <View style={s.handle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { backgroundColor: 'rgba(5,8,15,0.55)' },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
}));
