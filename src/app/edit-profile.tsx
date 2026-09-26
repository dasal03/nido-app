import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatePickerSheet, PhoneField, PickerSheet, useCountryOptions } from '@/components/FormPickers';
import { Icon } from '@/components/Icon';
import { Button, ErrorBanner, ScreenHeader, SelectField, TextField, tap } from '@/components/ui';
import { GENDERS, MIN_AGE, countryByCode } from '@/data/countries';
import type { TranslationKey } from '@/i18n/es';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { goBack } from '@/utils/navigation';
import { useAction } from '@/utils/useAction';
import { phoneDigitsLabel, splitPhone, validateBirthday, validateName, validatePhone, validateUsername } from '@/utils/validation';

export default function EditProfileScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, language, locale } = useT();
  const { me } = useSavings();
  const countryOptions = useCountryOptions();
  const initialCountry = me.country || 'CO';
  const initialPhone = splitPhone(me.phone, initialCountry);
  const initialPhoneCountry = countryOptions.find((o) => o.sublabel === initialPhone.dial)?.value ?? initialCountry;

  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username);
  const [country, setCountry] = useState(initialCountry);
  const [phoneCountry, setPhoneCountry] = useState(initialPhoneCountry);
  const [phone, setPhone] = useState(initialPhone.digits);
  const [birthday, setBirthday] = useState(/^\d{4}-\d{2}-\d{2}$/.test(me.birthday) ? me.birthday : '');
  const [gender, setGender] = useState(me.gender);
  const [picker, setPicker] = useState<'country' | 'phoneCountry' | 'gender' | 'birthday' | null>(null);
  const save = useAction(backend.updateProfile);

  const fullPhone = `${countryByCode(phoneCountry).dial} ${phone}`;
  const errors = {
    name: validateName(name),
    username: validateUsername(username),
    phone: validatePhone(phoneCountry, phone),
    birthday: birthday ? validateBirthday(birthday) : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const dirty =
    name !== me.name ||
    username !== me.username ||
    fullPhone !== me.phone ||
    country !== initialCountry ||
    birthday !== me.birthday ||
    gender !== me.gender;
  const msg = (key: TranslationKey | null) => (key ? t(key, { n: phoneDigitsLabel(phoneCountry) }) : null);

  const onSave = async () => {
    if (await save.run({ name: name.trim(), username, phone: fullPhone, country, birthday, gender })) {
      tap('success');
      goBack();
    }
  };

  const c = countryByCode(country);
  const doc = countryByCode(me.country).documents.find((d) => d.id === me.documentType);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('settings.personalInfo')} onLeading={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextField
            label={t('profile.name')}
            icon="user"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={60}
            error={msg(errors.name)}
          />
          <TextField
            label={t('auth.username')}
            icon="at"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            error={msg(errors.username)}
          />
          <TextField label={t('profile.email')} icon="mail" value={me.email} editable={false} />
          <SelectField
            label={t('auth.country')}
            value={c.name[language]}
            placeholder={t('auth.select')}
            leading={<Text style={{ fontSize: 20 }}>{c.flag}</Text>}
            onPress={() => setPicker('country')}
          />
          <PhoneField
            label={t('profile.phone')}
            country={phoneCountry}
            digits={phone}
            onChangeDigits={setPhone}
            onPressCountry={() => setPicker('phoneCountry')}
            error={msg(errors.phone)}
          />
          <SelectField
            label={t('profile.birthday')}
            icon="calendar"
            value={
              birthday
                ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
                    new Date(`${birthday}T12:00:00`),
                  )
                : null
            }
            placeholder={t('auth.birthdayPlaceholder')}
            onPress={() => setPicker('birthday')}
            error={msg(errors.birthday)}
          />
          <SelectField
            label={t('auth.gender')}
            icon="gender"
            value={gender ? t(`gender.${gender}` as TranslationKey) : null}
            placeholder={t('auth.select')}
            onPress={() => setPicker('gender')}
          />
          {!!me.documentNumber && (
            <View style={s.doc}>
              <Icon name="id-card" size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={s.docLabel}>{t('profile.document')}</Text>
                <Text style={s.docValue}>
                  {doc ? `${doc.id} · ` : ''}
                  {me.documentNumber.replace(/.(?=.{4})/g, '•')}
                </Text>
                <Text style={s.docHint}>{t('profile.documentLocked')}</Text>
              </View>
              <Icon name="lock" size={16} color={colors.textSubtle} />
            </View>
          )}
          <ErrorBanner message={save.error} />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={s.footer}>
        <Button label={t('common.saveChanges')} icon="check" onPress={onSave} loading={save.loading} disabled={!dirty || !valid} />
      </View>

      <PickerSheet
        visible={picker === 'country'}
        title={t('auth.country')}
        options={countryOptions}
        selected={country}
        searchPlaceholder={t('auth.searchCountry')}
        onSelect={setCountry}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'phoneCountry'}
        title={t('auth.phone')}
        options={countryOptions}
        selected={phoneCountry}
        searchPlaceholder={t('auth.searchCountry')}
        onSelect={setPhoneCountry}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'gender'}
        title={t('auth.gender')}
        options={GENDERS.map((g) => ({ value: g, label: t(`gender.${g}` as TranslationKey) }))}
        selected={gender}
        onSelect={setGender}
        onClose={() => setPicker(null)}
      />
      <DatePickerSheet
        visible={picker === 'birthday'}
        value={birthday}
        minAge={MIN_AGE}
        onChange={setBirthday}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  docLabel: { ...type.smallStrong, color: colors.textMuted },
  docValue: { ...type.bodyStrong, color: colors.text, marginTop: 2, letterSpacing: 1 },
  docHint: { ...type.small, fontSize: 11, color: colors.textSubtle, marginTop: 2 },
}));
