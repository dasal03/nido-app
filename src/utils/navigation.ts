import { router } from 'expo-router';

/** Goes back, or home when the screen was opened directly (deep link / web refresh). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Back action for tab screens: previous screen if any, otherwise the Home tab. */
export function goBackToHome() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}
