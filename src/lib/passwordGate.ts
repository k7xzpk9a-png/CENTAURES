// SHA-256 hex of the gate password. Plaintext is intentionally not documented.
// This hash matches the one used by the Flutter app
// (lib/utils/password_gate.dart) so the same password unlocks both builds.
// To change: `printf '%s' 'yournewpassword' | shasum -a 256`, paste below.
const PASSWORD_HASH_HEX =
  '09152cec99b1c536bd7657c52b058455c9999e00eba08be773aacbd864ab442c';

const UNLOCKED_KEY = 'nh90.web.unlocked';

export function isUnlocked(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(UNLOCKED_KEY) === 'true';
}

export async function tryUnlock(password: string): Promise<boolean> {
  if (!password) return false;
  const hex = await sha256Hex(password);
  if (hex !== PASSWORD_HASH_HEX) return false;
  localStorage.setItem(UNLOCKED_KEY, 'true');
  return true;
}

export function lock(): void {
  localStorage.removeItem(UNLOCKED_KEY);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
