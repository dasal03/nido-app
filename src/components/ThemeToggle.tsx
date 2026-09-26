import { useEffect, useState } from 'react';
import { Animated, Platform } from 'react-native';

import { makeStyles, usePreferences } from '@/providers/Preferences';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

/** Round button that flips between light and dark themes, with a quick spin on change. */
export function ThemeToggle() {
  const s = useStyles();
  const { theme, setTheme, t } = usePreferences();
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    spin.setValue(0);
    Animated.spring(spin, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 12, bounciness: 8 }).start();
  }, [theme.dark, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('settings.toggleTheme')}
      haptic={false}
      scaleTo={0.88}
      onPress={() => {
        tap('selection');
        setTheme(theme.dark ? 'light' : 'dark');
      }}
      style={s.button}>
      <Animated.View style={{ transform: [{ rotate }, { scale: spin }] }}>
        <Icon name={theme.dark ? 'sun' : 'moon'} size={20} color={theme.colors.text} />
      </Animated.View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...elevation,
  },
}));
