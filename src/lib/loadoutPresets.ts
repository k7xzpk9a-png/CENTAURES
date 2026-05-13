// Loadout-preset model + storage. Port of lib/models/loadout_preset.dart.
//
// A preset captures the loadout-dependent values (empty mass, crew, equipment
// counts) from Configuration and deliberately excludes mission variables
// (fuel, passengers) and the global cruise FF table.
//
// Preset library is global (key: 'loadoutPresets'); the active selection is
// per-mission (missionKey(id, 'activeLoadoutPreset')).

export interface LoadoutPreset {
  name: string;
  emptyMass: number;
  crewMass: number;
  equipmentCounts: Record<string, number>;
}

const PRESETS_KEY = 'loadoutPresets';

const ls = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadPresets(): LoadoutPreset[] {
  const raw = ls()?.getItem(PRESETS_KEY);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPresetShape);
  } catch {
    return [];
  }
}

export function savePresets(list: LoadoutPreset[]): void {
  ls()?.setItem(PRESETS_KEY, JSON.stringify(list));
}

function isPresetShape(x: unknown): x is LoadoutPreset {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.emptyMass === 'number' &&
    typeof o.crewMass === 'number' &&
    typeof o.equipmentCounts === 'object' &&
    o.equipmentCounts !== null
  );
}
