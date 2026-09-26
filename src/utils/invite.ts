import * as Linking from 'expo-linking';

/** Code from an invite link opened before the linking screen was shown (e.g. signed out). */
let pending: string | null = null;

export const setPendingInvite = (code: string | null) => {
  pending = code;
};

/** Returns the pending invite code once, then clears it. */
export function takePendingInvite() {
  const code = pending;
  pending = null;
  return code;
}

/** Deep link that opens Nido on the linking flow with the code prefilled. */
export function inviteUrl(code: string) {
  return Linking.createURL('invite', { queryParams: { code } });
}

/** Extracts a code from a scanned QR (an invite URL or the bare code): a person's NIDO code or a family's FAM code. */
export function parseInviteCode(data: string): string | null {
  const fromUrl = /[?&]code=([^&#]+)/i.exec(data)?.[1];
  const candidate = decodeURIComponent(fromUrl ?? data)
    .trim()
    .toUpperCase();
  return /^(NIDO|FAM)-[A-Z0-9]{5}$/.test(candidate) ? candidate : null;
}
