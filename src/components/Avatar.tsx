import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/providers/Preferences';
import type { User } from '@/store/types';
import { fonts, memberPalette } from '@/theme';
import { initials } from '@/utils/format';

type AvatarUser = Pick<User, 'name' | 'photo'>;

export function Avatar({ user, color, size = 40, ring }: { user: AvatarUser; color: string; size?: number; ring?: string }) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? 2.5 : 0,
    borderColor: ring,
  };
  if (user.photo) {
    return <Image source={{ uri: user.photo }} style={frame} accessibilityLabel={user.name} />;
  }
  return (
    <View style={[styles.avatar, frame, { backgroundColor: color }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(user.name) || '?'}</Text>
    </View>
  );
}

/** Overlapping avatars of a nest's members (up to `max`, then "+n"). Colors follow the join order. */
export function NestAvatars({ users, size = 40, ring, max = 3 }: { users: AvatarUser[]; size?: number; ring?: string; max?: number }) {
  const { colors } = useTheme();
  const border = ring ?? colors.bg;
  const palette = memberPalette(colors);
  const shown = users.slice(0, users.length > max ? max - 1 : max);
  const extra = users.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((u, i) => (
        <View key={i} style={i > 0 && { marginLeft: -size * 0.3 }}>
          <Avatar user={u} color={palette[i % palette.length]} size={size} ring={border} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.avatar,
            {
              marginLeft: -size * 0.3,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 2.5,
              borderColor: border,
              backgroundColor: colors.surfaceAlt,
            },
          ]}>
          <Text style={[styles.initials, { fontSize: size * 0.34, color: colors.textMuted }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: fonts.bold },
});
