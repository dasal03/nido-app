import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useT, useTheme } from '@/providers/Preferences';
import { useSession } from '@/store/SavingsContext';

export default function TabLayout() {
  const { t } = useT();
  const { colors } = useTheme();
  const { couple } = useSession();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="goals" options={{ title: t('tabs.goals') }} />
      <Tabs.Screen name="activity" options={{ title: t('tabs.activity') }} />
      <Tabs.Screen name="couple" options={{ title: t(couple?.kind === 'family' ? 'tabs.family' : 'tabs.couple') }} />
      <Tabs.Screen name="settings" options={{ title: t('settings.title') }} />
    </Tabs>
  );
}
