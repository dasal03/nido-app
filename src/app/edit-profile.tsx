import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBanner, ScreenHeader, TextField, tap } from '@/components/ui';
import { makeStyles, useT } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSavings } from '@/store/SavingsContext';
import { spacing } from '@/theme';
import { goBack } from '@/utils/navigation';
import { useAction } from '@/utils/useAction';

export default function EditProfileScreen() {
  const s = useStyles();
  const { t } = useT();
  const { me } = useSavings();
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [phone, setPhone] = useState(me.phone);
  const [birthday, setBirthday] = useState(me.birthday);
  const save = useAction(backend.updateProfile);

  const dirty = name !== me.name || username !== me.username || phone !== me.phone || birthday !== me.birthday;

  const onSave = async () => {
    if (await save.run({ name: name.trim(), username, phone, birthday: birthday.trim() })) {
      tap('success');
      goBack();
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('settings.personalInfo')} onLeading={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextField label={t('profile.name')} icon="user" value={name} onChangeText={setName} autoCapitalize="words" maxLength={24} />
          <TextField
            label={t('auth.username')}
            icon="at"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          <TextField label={t('profile.email')} icon="mail" value={me.email} editable={false} />
          <TextField
            label={t('profile.phone')}
            icon="phone"
            value={phone}
            onChangeText={setPhone}
            placeholder={t('auth.phonePlaceholder')}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            maxLength={20}
          />
          <TextField
            label={t('profile.birthday')}
            icon="calendar"
            value={birthday}
            onChangeText={setBirthday}
            placeholder={t('profile.birthdayPlaceholder')}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <ErrorBanner message={save.error} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={s.footer}>
        <Button label={t('common.saveChanges')} icon="check" onPress={onSave} loading={save.loading} disabled={!dirty || !phone.trim()} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
}));
