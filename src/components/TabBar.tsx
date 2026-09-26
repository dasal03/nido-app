import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LayoutAnimation, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/providers/Preferences';
import { radius, type } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale, tap } from './ui';

const ICONS: Record<string, IconName> = {
  index: 'home',
  goals: 'target',
  activity: 'receipt',
  couple: 'heart',
  settings: 'settings',
};

const BAR_HEIGHT = 64;

/** Vertical space tab screens must leave free so content isn't hidden behind the floating bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 16) + 24;
}

/** Floating pill tab bar: icon-only tabs, the active one expands to show its label. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key].options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (focused || event.defaultPrevented) return;
            tap('selection');
            if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(240, 'easeInEaseOut', 'opacity'));
            navigation.navigate(route.name, route.params);
          };

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              haptic={false}
              scaleTo={0.9}
              onPress={onPress}
              style={[s.item, focused && s.itemActive]}>
              <Icon name={ICONS[route.name] ?? 'sparkles'} size={21} color={focused ? colors.tabActiveIcon : colors.tabIcon} strokeWidth={focused ? 2.4 : 2} />
              {focused && (
                <Text style={s.label} numberOfLines={1}>
                  {label}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, dark }) => ({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: BAR_HEIGHT,
    padding: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.tabBar,
    borderWidth: dark ? 1 : 0,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(10,31,92,0.35)' },
      default: {
        shadowColor: dark ? '#000000' : colors.tabBar,
        shadowOpacity: dark ? 0.5 : 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
      },
    }),
  },
  item: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  itemActive: { backgroundColor: colors.tabActive, paddingHorizontal: 15 },
  label: { ...type.smallStrong, fontSize: 13, color: colors.tabActiveIcon },
}));
