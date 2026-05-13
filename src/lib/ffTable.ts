// Cruise fuel-flow lookup table, port of lib/models/ff_table.dart.
//
// Indexed by speed in 10-kt steps from 80 to 160. Below 80 kt the helicopter
// transitions toward hover and burn climbs above the Vy minimum, so the table
// flattens to a fixed BELOW_MIN_FF. Above 160 kt the lookup clamps.
//
// Stored globally (not per-mission) under localStorage key `cruiseFFTable`
// as a JSON array of numbers.

export const FF_BELOW_MIN = 600;
export const FF_MIN_SPEED_KT = 80;
export const FF_MAX_SPEED_KT = 160;
export const FF_STEP = 10;
export const FF_ENTRIES = 9; // 80, 90, ..., 160

const STORAGE_KEY = 'cruiseFFTable';

export interface CruiseFFTable {
  /** Length FF_ENTRIES. */
  values: number[];
}

export function defaultFFTable(): CruiseFFTable {
  return { values: Array(FF_ENTRIES).fill(FF_BELOW_MIN) };
}

/** FF (kg/h) at the given speed in kt. */
export function lookupFF(table: CruiseFFTable, speedKt: number): number {
  if (speedKt < FF_MIN_SPEED_KT) return FF_BELOW_MIN;
  if (speedKt >= FF_MAX_SPEED_KT) return table.values[FF_ENTRIES - 1];
  const idx = Math.floor((speedKt - FF_MIN_SPEED_KT) / FF_STEP);
  const frac = (speedKt - FF_MIN_SPEED_KT - idx * FF_STEP) / FF_STEP;
  return table.values[idx] + frac * (table.values[idx + 1] - table.values[idx]);
}

/** FF at Vy (= FF_MIN_SPEED_KT), used for endurance / playtime burn. */
export function vyFF(table: CruiseFFTable): number {
  return table.values[0];
}

/** Speed for index i in [values]. */
export function speedAt(i: number): number {
  return FF_MIN_SPEED_KT + i * FF_STEP;
}

export function withEntry(
  table: CruiseFFTable,
  i: number,
  v: number,
): CruiseFFTable {
  const next = table.values.slice();
  next[i] = v;
  return { values: next };
}

const ls = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadFFTable(): CruiseFFTable {
  const raw = ls()?.getItem(STORAGE_KEY);
  if (raw == null) return defaultFFTable();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== FF_ENTRIES) {
      return defaultFFTable();
    }
    const values = parsed.map((v) =>
      typeof v === 'number' ? v : parseFloat(String(v)),
    );
    if (values.some((v) => !Number.isFinite(v))) return defaultFFTable();
    return { values };
  } catch {
    return defaultFFTable();
  }
}

export function saveFFTable(table: CruiseFFTable): void {
  ls()?.setItem(STORAGE_KEY, JSON.stringify(table.values));
}

/** Cruise fuel burn (kg) for a leg of [distNm] flown at [gsKt]. */
export function legCruiseFuel(
  distNm: number,
  gsKt: number,
  table: CruiseFFTable,
): number {
  if (gsKt <= 0) return 0;
  return (distNm / gsKt) * lookupFF(table, gsKt);
}
