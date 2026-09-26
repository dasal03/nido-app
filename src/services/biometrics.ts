import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Biometric sign-in (Face ID / fingerprint) as an alternative to typing the password.
 *
 * The credentials live in the Keychain / Keystore, only on this device. In real builds the item
 * itself is protected with `requireAuthentication` (the OS asks for Face ID / fingerprint to read
 * it). Expo Go can't use that option, so there we gate the read with a LocalAuthentication prompt.
 */

const SECRET_KEY = 'nido.biometric.credentials';
/** Non-secret marker (which account is enrolled), readable without prompting. */
const MARKER_KEY = 'nido/biometric/v1';
const OFFERED_KEY = 'nido/biometric-offered/v1';

export const biometricsSupported = Platform.OS !== 'web';
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type BiometryKind = 'face' | 'fingerprint' | 'generic';

/** Which biometric the device has enrolled, or null if none is available. */
export async function getBiometry(): Promise<BiometryKind | null> {
  if (!biometricsSupported) return null;
  const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  if (!hardware || !enrolled) return null;
  // Android reports several methods (fingerprint, face unlock, iris) behind one system prompt, so
  // it's always called "biometrics" there. Only an iPhone with Face ID is named Face ID.
  if (Platform.OS !== 'ios') return 'generic';
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
  return 'generic';
}

const secureOptions = (prompt: string): SecureStore.SecureStoreOptions => ({
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: !inExpoGo,
  authenticationPrompt: prompt,
});

/** Whether the enrolled identifier (email or username, as typed at sign-in) belongs to this user. */
export function isEnrolledFor(enrolled: string | null, user: { email: string; username: string }) {
  const id = enrolled?.trim().toLowerCase().replace(/^@/, '');
  return !!id && (id === user.email.toLowerCase() || id === user.username.toLowerCase());
}

/** The account enrolled for biometric sign-in on this device, if any. */
export async function getEnrolledIdentifier(): Promise<string | null> {
  if (!biometricsSupported) return null;
  const raw = await AsyncStorage.getItem(MARKER_KEY).catch(() => null);
  return raw ? (JSON.parse(raw).identifier as string) : null;
}

export async function enableBiometricLogin(identifier: string, password: string, prompt: string) {
  await SecureStore.setItemAsync(SECRET_KEY, JSON.stringify({ identifier, password }), secureOptions(prompt));
  await AsyncStorage.setItem(MARKER_KEY, JSON.stringify({ identifier }));
}

export async function disableBiometricLogin() {
  await SecureStore.deleteItemAsync(SECRET_KEY).catch(() => {});
  await AsyncStorage.removeItem(MARKER_KEY).catch(() => {});
}

/**
 * Asks for Face ID / fingerprint and returns the stored credentials, or null if cancelled.
 * If the biometric enrollment changed (the OS invalidates the item), biometric sign-in is turned off.
 */
export async function unlockCredentials(prompt: string): Promise<{ identifier: string; password: string } | null> {
  if (inExpoGo) {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt });
    if (!result.success) return null;
  }
  try {
    const raw = await SecureStore.getItemAsync(SECRET_KEY, secureOptions(prompt));
    if (!raw) {
      await disableBiometricLogin();
      return null;
    }
    return JSON.parse(raw);
  } catch {
    // Cancelled prompt or invalidated key.
    return null;
  }
}

/** Whether we already offered biometric sign-in for this account (so we only ask once). */
export async function wasOffered(identifier: string) {
  const raw = await AsyncStorage.getItem(OFFERED_KEY).catch(() => null);
  return (raw ? (JSON.parse(raw) as string[]) : []).includes(identifier.toLowerCase());
}

export async function markOffered(identifier: string) {
  const raw = await AsyncStorage.getItem(OFFERED_KEY).catch(() => null);
  const list = raw ? (JSON.parse(raw) as string[]) : [];
  await AsyncStorage.setItem(OFFERED_KEY, JSON.stringify([...new Set([...list, identifier.toLowerCase()])]));
}

// Pending offer: set right after a password sign-in; shown by <BiometricOffer /> once the app has
// switched to the signed-in screens (the login screen unmounts as soon as the session starts).
type Pending = { identifier: string; password: string; kind: BiometryKind } | null;
let pending: Pending = null;
const listeners = new Set<() => void>();

export const biometricOffer = {
  get: () => pending,
  set(next: Pending) {
    pending = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** After a successful password sign-in: queue the "use Face ID next time?" offer when it makes sense. */
export async function maybeOfferBiometrics(identifier: string, password: string) {
  const kind = await getBiometry();
  if (!kind) return;
  const enrolled = await getEnrolledIdentifier();
  if (enrolled?.toLowerCase() === identifier.toLowerCase()) return;
  if (await wasOffered(identifier)) return;
  biometricOffer.set({ identifier, password, kind });
}
