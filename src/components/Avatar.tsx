import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/providers/Preferences';
import type { User } from '@/store/types';
import { fonts } from '@/theme';
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

export function CoupleAvatars({ me, partner, size = 40, ring }: { me: AvatarUser; partner: AvatarUser; size?: number; ring?: string }) {
  const { colors } = useTheme();
  const border = ring ?? colors.bg;
  return (
    <View style={{ flexDirection: 'row' }}>
      <Avatar user={me} color={colors.me} size={size} ring={border} />
      <View style={{ marginLeft: -size * 0.3 }}>
        <Avatar user={partner} color={colors.partner} size={size} ring={border} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: fonts.bold },
});
