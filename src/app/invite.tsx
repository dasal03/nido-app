import { Redirect, useLocalSearchParams } from 'expo-router';

import { useSession } from '@/store/SavingsContext';
import { parseInviteCode, setPendingInvite } from '@/utils/invite';

/** Deep link target `nido://invite?code=NIDO-XXXXX`: remembers the code and routes to the linking flow. */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { user, couple } = useSession();
  setPendingInvite(code ? parseInviteCode(code) : null);

  if (!user) return <Redirect href="/login" />;
  if (!couple) return <Redirect href="/link" />;
  return <Redirect href="/add-partner" />;
}
