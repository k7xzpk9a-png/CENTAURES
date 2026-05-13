// Typed localStorage wrappers. Plays the role Flutter's SharedPreferences
// played in the original app: every per-mission field is stored under a key
// like `mission_<id>_<field>` (see [missionKey]), with type-specific accessors
// so callers don't sprinkle parseFloat / 'true' === ... everywhere.
//
// Values are stored as plain strings (not JSON-wrapped) so DevTools shows
// `fuelTotal = 800` rather than `'800'`. Booleans are 'true' / 'false'.

const ls = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function missionKey(missionId: string, key: string): string {
  return `mission_${missionId}_${key}`;
}

export function getNum(key: string, dflt: number): number {
  const raw = ls()?.getItem(key);
  if (raw == null) return dflt;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : dflt;
}

export function getNumOrNull(key: string): number | null {
  const raw = ls()?.getItem(key);
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function setNum(key: string, val: number): void {
  ls()?.setItem(key, String(val));
}

export function getInt(key: string, dflt: number): number {
  const raw = ls()?.getItem(key);
  if (raw == null) return dflt;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : dflt;
}

export function setInt(key: string, val: number): void {
  ls()?.setItem(key, String(Math.trunc(val)));
}

export function getBool(key: string, dflt: boolean): boolean {
  const raw = ls()?.getItem(key);
  if (raw == null) return dflt;
  return raw === 'true';
}

export function setBool(key: string, val: boolean): void {
  ls()?.setItem(key, val ? 'true' : 'false');
}

export function getString(key: string, dflt: string): string {
  return ls()?.getItem(key) ?? dflt;
}

export function getStringOrNull(key: string): string | null {
  return ls()?.getItem(key) ?? null;
}

export function setString(key: string, val: string): void {
  ls()?.setItem(key, val);
}

export function removeKey(key: string): void {
  ls()?.removeItem(key);
}

/** Snapshot of every key currently in localStorage. */
export function allKeys(): string[] {
  const s = ls();
  if (!s) return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}
