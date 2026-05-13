// Reactive mission store. The pure data layer lives in $lib/mission.ts; this
// file wraps it in $state so components subscribe automatically.
//
// Filename ends in `.svelte.ts` to enable runes in a non-component module
// (Svelte 5 requirement).

import {
  clearMissionState,
  copyMissionState,
  freshMission,
  getActiveId,
  loadAllMissions,
  saveAllMissions,
  setActiveId as persistActiveId,
  type MissionData,
} from './mission';

class MissionStore {
  list = $state<MissionData[]>([]);
  activeId = $state<string | null>(null);
  loaded = $state(false);

  /** Idempotent: safe to call from multiple onMount sites. */
  ensureLoaded(): void {
    if (this.loaded) return;
    this.list = loadAllMissions();
    let active = getActiveId();
    if (this.list.length === 0) {
      // First launch: seed a mission so the app always has something to show.
      const seed = freshMission('Mission 1');
      this.list = [seed];
      active = seed.id;
      this.persistList();
      persistActiveId(active);
    } else if (active === null || !this.list.some((m) => m.id === active)) {
      active = this.list[0].id;
      persistActiveId(active);
    }
    this.activeId = active;
    this.loaded = true;
  }

  get active(): MissionData | null {
    if (this.activeId === null) return null;
    return this.list.find((m) => m.id === this.activeId) ?? null;
  }

  findById(id: string): MissionData | null {
    return this.list.find((m) => m.id === id) ?? null;
  }

  setActive(id: string): void {
    if (!this.list.some((m) => m.id === id)) return;
    this.activeId = id;
    persistActiveId(id);
  }

  create(name: string, copyFromId?: string): MissionData {
    const m = freshMission(name);
    if (copyFromId) copyMissionState(copyFromId, m.id);
    this.list = [...this.list, m];
    this.activeId = m.id;
    this.persistList();
    persistActiveId(m.id);
    return m;
  }

  rename(id: string, newName: string): void {
    const idx = this.list.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const updated: MissionData = {
      ...this.list[idx],
      name: newName,
      updatedAt: new Date().toISOString(),
    };
    this.list = [
      ...this.list.slice(0, idx),
      updated,
      ...this.list.slice(idx + 1),
    ];
    this.persistList();
  }

  remove(id: string): void {
    clearMissionState(id);
    this.list = this.list.filter((m) => m.id !== id);
    if (this.activeId === id) {
      this.activeId = this.list[0]?.id ?? null;
      if (this.activeId) persistActiveId(this.activeId);
      else persistActiveId(null);
    }
    this.persistList();
  }

  private persistList(): void {
    saveAllMissions(this.list);
  }
}

export const missionStore = new MissionStore();
