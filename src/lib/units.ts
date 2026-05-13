// User-selectable distance/speed unit. Canonical storage is always nautical
// miles (distance) and knots (speed); this only affects display + edit.

export type DistanceUnit = 'nm' | 'km';

const NM_PER_KM = 1 / 1.852;
const KM_PER_NM = 1.852;

export const distLabel = (u: DistanceUnit): string => (u === 'km' ? 'km' : 'NM');
export const speedLabel = (u: DistanceUnit): string =>
  u === 'km' ? 'km/h' : 'kt';

export function distFromNm(u: DistanceUnit, nm: number): number {
  return u === 'km' ? nm * KM_PER_NM : nm;
}
export function distToNm(u: DistanceUnit, v: number): number {
  return u === 'km' ? v * NM_PER_KM : v;
}
export function speedFromKt(u: DistanceUnit, kt: number): number {
  return u === 'km' ? kt * KM_PER_NM : kt;
}
export function speedToKt(u: DistanceUnit, v: number): number {
  return u === 'km' ? v * NM_PER_KM : v;
}

export function parseDistanceUnit(s: string | null | undefined): DistanceUnit {
  return s === 'km' ? 'km' : 'nm';
}

/** "XX min (Y.Y)" — minutes plus tenths-of-an-hour. */
export function formatFlightTime(hours: number): string {
  const mins = Math.round(hours * 60);
  const tenths = Math.round(hours * 10) / 10;
  return `${mins} min (${tenths.toFixed(1)})`;
}
