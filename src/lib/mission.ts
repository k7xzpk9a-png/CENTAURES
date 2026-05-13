// Mission entity + store. Direct port of lib/models/mission.dart, minus the
// one-shot legacy-flat-key migration (the Svelte build's localStorage starts
// empty — there are no flat keys to migrate from).
//
// A mission holds identifying metadata + the free-form scratchpad. The actual
// per-mission state (config, route, fuel, atmosphere) lives in localStorage
// keys namespaced by [id] — see [missionKey] in ./missionPersistence.

import {
  allKeys,
  getNum,
  getNumOrNull,
  getString,
  missionKey,
  removeKey,
} from './missionPersistence';

export interface MissionData {
  id: string;
  name: string;
  scratchpad: string;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** ISO-8601 UTC. */
  updatedAt: string;
}

/** Build a new mission with a fresh id and the given name. */
export function freshMission(name: string): MissionData {
  // ID shape mirrors Mission.fresh in Dart: millis-since-epoch in base36 plus
  // a random 4-hex tail. Random tail replaces Dart's `name.hashCode & 0xFFFF`
  // — the two never collide in practice and the tail also disambiguates
  // missions created in the same millisecond.
  const now = new Date();
  const millis = now.getTime().toString(36);
  const tail = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  const iso = now.toISOString();
  return {
    id: `${millis}${tail}`,
    name,
    scratchpad: '',
    createdAt: iso,
    updatedAt: iso,
  };
}

const MISSIONS_KEY = 'missions_v1';
const ACTIVE_KEY = 'activeMissionId';

const ls = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage;

export function loadAllMissions(): MissionData[] {
  const raw = ls()?.getItem(MISSIONS_KEY);
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMissionShape);
  } catch {
    return [];
  }
}

export function saveAllMissions(missions: MissionData[]): void {
  ls()?.setItem(MISSIONS_KEY, JSON.stringify(missions));
}

export function getActiveId(): string | null {
  return ls()?.getItem(ACTIVE_KEY) ?? null;
}

export function setActiveId(id: string | null): void {
  const s = ls();
  if (!s) return;
  if (id === null) s.removeItem(ACTIVE_KEY);
  else s.setItem(ACTIVE_KEY, id);
}

function isMissionShape(x: unknown): x is MissionData {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.updatedAt === 'string'
  );
}

/** Copy every per-mission key from [fromId]'s namespace into [toId]'s. */
export function copyMissionState(fromId: string, toId: string): void {
  const fromPrefix = `mission_${fromId}_`;
  const toPrefix = `mission_${toId}_`;
  const s = ls();
  if (!s) return;
  for (const k of allKeys()) {
    if (!k.startsWith(fromPrefix)) continue;
    const v = s.getItem(k);
    if (v != null) s.setItem(toPrefix + k.substring(fromPrefix.length), v);
  }
}

/** Drop every per-mission key for [missionId]. */
export function clearMissionState(missionId: string): void {
  const prefix = `mission_${missionId}_`;
  for (const k of allKeys()) {
    if (k.startsWith(prefix)) removeKey(k);
  }
}

/** Cheap recap snapshot used by the home page mission cards. */
export interface MissionRecapData {
  totalDistNm: number;
  totalHours: number;
  /** Loaded fuel (manual or auto), not a recomputed required-fuel figure. */
  requiredFuel: number;
  /** Whatever the Performance tab last persisted for this mission. */
  mtow: number | null;
  tow: number;
}

export function computeMissionRecap(missionId: string): MissionRecapData {
  const d = (k: string, dflt: number) => getNum(missionKey(missionId, k), dflt);
  const s = (k: string, dflt: string) =>
    getString(missionKey(missionId, k), dflt);

  // Defaults mirror the Flutter app's _loadAllData so a fresh mission shows
  // sensible numbers instead of zeros.
  const distOut = d('distOut', 50);
  const distIn = d('distIn', 50);
  const gsOut = d('gsOut', 120);
  const gsIn = d('gsIn', 120);
  const fuelTotal = d('fuelTotal', 800);

  const empty = parseFloat(s('emptyWeight', '6800'));
  const crew = parseFloat(s('crewWeight', '200'));
  const passengers = parseFloat(s('passengerWeight', '0'));

  const cachedTotal = d('totalWeight', 0);
  const tow =
    cachedTotal > 0
      ? cachedTotal
      : (Number.isFinite(empty) ? empty : 6800) +
        (Number.isFinite(crew) ? crew : 200) +
        (Number.isFinite(passengers) ? passengers : 0) +
        fuelTotal;

  return {
    totalDistNm: distOut + distIn,
    totalHours:
      (gsOut > 0 ? distOut / gsOut : 0) + (gsIn > 0 ? distIn / gsIn : 0),
    requiredFuel: fuelTotal,
    mtow: getNumOrNull(missionKey(missionId, 'mtow')),
    tow,
  };
}
