<!--
  Configuration page. Port of lib/pages/configuration_page.dart.

  Layout (top → bottom):
    1. Preset bar — active preset name + "Manage" button (opens bottom sheet)
    2. Total card — green/orange/red status vs MTOW
    3. Aircraft mass — empty / fuel / crew / passengers
    4. Cruise FF table — 9 entries (80–160 kt in 10-kt steps)
    5. Equipment — 13-item grid with ± and × counts
    6. Saved footer

  Fuel auto/manual override is shared with Fuel page (same localStorage
  keys). MTOW is read once on mount; Phase 5 will wire it to the Performance
  page so it updates live.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import NumberField from '$lib/components/NumberField.svelte';
  import WeightItemButton from '$lib/components/WeightItemButton.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Icon from '$lib/Icon.svelte';
  import {
    FF_ENTRIES,
    loadFFTable,
    saveFFTable,
    speedAt,
    type CruiseFFTable,
  } from '$lib/ffTable';
  import {
    getBool,
    getInt,
    getNum,
    getNumOrNull,
    getString,
    getStringOrNull,
    missionKey,
    removeKey,
    setBool,
    setInt,
    setNum,
    setString,
  } from '$lib/missionPersistence';
  import {
    loadPresets,
    savePresets,
    type LoadoutPreset,
  } from '$lib/loadoutPresets';
  import { computeRequiredFuel } from '$lib/fuel';

  // ── Static equipment catalogue (port of weightItems in Dart) ────────────
  type EquipmentItem = { name: string; weightKg: number };
  const EQUIPMENT_ITEMS: EquipmentItem[] = [
    { name: 'MAG58', weightKg: 12 },
    { name: 'Troop seat', weightKg: 14 },
    { name: 'Ferry tank', weightKg: 20 },
    { name: 'Ferry tank Support', weightKg: 8 },
    { name: 'Amunition MAG58', weightKg: 8 },
    { name: 'Pronal 1000l', weightKg: 110 },
    { name: 'Motopompe + lot', weightKg: 107 },
    { name: 'Bac souple', weightKg: 70 },
    { name: 'Ensemble tractage', weightKg: 35 },
    { name: 'Rolling device', weightKg: 100 },
    { name: 'Stretchers', weightKg: 12 },
    { name: 'Lot arrimage complet', weightKg: 35 },
    { name: 'Fast Rope', weightKg: 12 },
  ];

  const id = $derived(page.params.id ?? '');

  // ── State (initial defaults; replaced on mount from localStorage) ───────
  let emptyWeight = $state('6800');
  let crewWeight = $state('200');
  let passengerWeight = $state('0');
  let fuelTotal = $state(800);
  let manualOverride = $state(false);
  let equipmentCounts = $state<Record<string, number>>({});
  let ffStrings = $state<string[]>(Array(FF_ENTRIES).fill('600'));
  let presets = $state<LoadoutPreset[]>([]);
  let activePresetName = $state<string | null>(null);
  let mtow = $state<number | null>(null);

  // Sibling-tab inputs we read once for the required-fuel calc + reset button.
  let distOut = $state(50);
  let distIn = $state(50);
  let gsOut = $state(120);
  let gsIn = $state(120);
  let playtime = $state(30);
  let reserve = $state(250);

  let mounted = $state(false);
  let lastSavedAt = $state<Date | null>(null);
  let presetSheetOpen = $state(false);

  onMount(() => {
    if (!id) return;
    emptyWeight = getString(missionKey(id, 'emptyWeight'), '6800');
    crewWeight = getString(missionKey(id, 'crewWeight'), '200');
    passengerWeight = getString(missionKey(id, 'passengerWeight'), '0');
    fuelTotal = getNum(missionKey(id, 'fuelTotal'), 800);
    manualOverride = getBool(missionKey(id, 'fuelManualOverride'), false);

    const counts: Record<string, number> = {};
    for (const item of EQUIPMENT_ITEMS) {
      counts[item.name] = getInt(missionKey(id, `count_${item.name}`), 0);
    }
    equipmentCounts = counts;

    const table = loadFFTable();
    ffStrings = table.values.map((v) => v.toFixed(0));

    presets = loadPresets();
    activePresetName = getStringOrNull(missionKey(id, 'activeLoadoutPreset'));

    distOut = getNum(missionKey(id, 'distOut'), 50);
    distIn = getNum(missionKey(id, 'distIn'), 50);
    gsOut = getNum(missionKey(id, 'gsOut'), 120);
    gsIn = getNum(missionKey(id, 'gsIn'), 120);
    playtime = getNum(missionKey(id, 'playtime'), 30);
    reserve = getNum(missionKey(id, 'reserve'), 250);

    mtow = getNumOrNull(missionKey(id, 'mtow'));
    mounted = true;
  });

  // ── Derived ─────────────────────────────────────────────────────────────
  const cruiseFFTable = $derived.by<CruiseFFTable>(() => {
    const values = ffStrings.map((s) => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0 ? v : 600;
    });
    return { values };
  });

  const equipmentWeight = $derived(
    EQUIPMENT_ITEMS.reduce(
      (sum, item) => sum + item.weightKg * (equipmentCounts[item.name] ?? 0),
      0,
    ),
  );

  const numericEmpty = $derived(parseFloat(emptyWeight) || 0);
  const numericCrew = $derived(parseFloat(crewWeight) || 0);
  const numericPassengers = $derived(parseFloat(passengerWeight) || 0);

  const totalWeight = $derived(
    numericEmpty +
      numericCrew +
      numericPassengers +
      fuelTotal +
      equipmentWeight,
  );
  const nonPayloadMass = $derived(
    numericEmpty + numericCrew + equipmentWeight,
  );

  const requiredFuel = $derived(
    computeRequiredFuel({
      distOut,
      distIn,
      gsOut,
      gsIn,
      playtimeMin: playtime,
      reserveKg: reserve,
      table: cruiseFFTable,
    }),
  );

  // Auto-track required fuel when override is off (mirrors Fuel page logic).
  $effect(() => {
    if (mounted && !manualOverride) {
      fuelTotal = requiredFuel;
    }
  });

  // ── MTOW status colour + headline ───────────────────────────────────────
  const margin = $derived(mtow == null ? null : mtow - totalWeight);
  const overMtow = $derived(margin != null && margin < 0);
  const tight = $derived(margin != null && !overMtow && margin < 200);
  const accentColor = $derived.by(() => {
    if (mtow == null) return '#9e9e9e'; // white54
    if (overMtow) return '#ef5350'; // redAccent
    if (tight) return '#ffa726'; // orangeAccent
    return '#69f0ae'; // greenAccent
  });
  const totalHeadlineLabel = $derived.by(() => {
    if (mtow == null) return 'MTOW unknown';
    return overMtow ? 'OVER MTOW by' : 'Available payload';
  });
  const totalHeadlineValue = $derived.by(() => {
    if (mtow == null) return '— calculate on Performance';
    return `${Math.abs(margin!).toFixed(0)} kg`;
  });

  // ── Active preset + modified flag ───────────────────────────────────────
  const activePreset = $derived.by(() => {
    if (!activePresetName) return null;
    return presets.find((p) => p.name === activePresetName) ?? null;
  });
  const presetIsModified = $derived.by(() => {
    const p = activePreset;
    if (!p) return false;
    if (numericEmpty !== p.emptyMass) return true;
    if (numericCrew !== p.crewMass) return true;
    for (const item of EQUIPMENT_ITEMS) {
      const cur = equipmentCounts[item.name] ?? 0;
      const ref = p.equipmentCounts[item.name] ?? 0;
      if (cur !== ref) return true;
    }
    return false;
  });
  const presetLabel = $derived.by(() => {
    if (!activePresetName) return 'No preset';
    return presetIsModified
      ? `${activePresetName} · modified`
      : activePresetName;
  });
  const presetLabelColor = $derived.by(() => {
    if (!activePresetName) return '#9e9e9e';
    return presetIsModified ? '#ffa726' : '#69f0ae';
  });

  // ── Persistence ─────────────────────────────────────────────────────────
  function touchSaved() {
    lastSavedAt = new Date();
  }

  $effect(() => {
    if (!mounted) return;
    setString(missionKey(id, 'emptyWeight'), emptyWeight);
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    setString(missionKey(id, 'crewWeight'), crewWeight);
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    setString(missionKey(id, 'passengerWeight'), passengerWeight);
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    setNum(missionKey(id, 'fuelTotal'), fuelTotal);
    setBool(missionKey(id, 'fuelManualOverride'), manualOverride);
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    for (const item of EQUIPMENT_ITEMS) {
      setInt(
        missionKey(id, `count_${item.name}`),
        equipmentCounts[item.name] ?? 0,
      );
    }
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    setNum(missionKey(id, 'totalWeight'), totalWeight);
  });
  $effect(() => {
    if (!mounted) return;
    setNum(missionKey(id, 'nonPayloadMass'), nonPayloadMass);
  });
  $effect(() => {
    if (!mounted) return;
    saveFFTable(cruiseFFTable);
    touchSaved();
  });
  $effect(() => {
    if (!mounted) return;
    savePresets(presets);
  });
  $effect(() => {
    if (!mounted) return;
    if (activePresetName === null) {
      removeKey(missionKey(id, 'activeLoadoutPreset'));
    } else {
      setString(missionKey(id, 'activeLoadoutPreset'), activePresetName);
    }
  });

  // ── UI handlers ─────────────────────────────────────────────────────────
  function onFuelInput(v: string) {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n >= 0) {
      fuelTotal = n;
      manualOverride = true;
    }
  }

  function resetFuelOverride() {
    manualOverride = false;
  }

  // Custom bind handler for the fuel NumberField (it's a string-bound input).
  let fuelString = $state('800');
  $effect(() => {
    if (mounted) fuelString = fuelTotal.toFixed(0);
  });
  $effect(() => {
    // When user types in the fuel field, parse and propagate. We can't use
    // bind:value directly because typing must also flip manualOverride.
    if (!mounted) return;
    if (fuelString === fuelTotal.toFixed(0)) return;
    onFuelInput(fuelString);
  });

  function incrementItem(name: string) {
    equipmentCounts = {
      ...equipmentCounts,
      [name]: (equipmentCounts[name] ?? 0) + 1,
    };
  }
  function decrementItem(name: string) {
    const cur = equipmentCounts[name] ?? 0;
    if (cur === 0) return;
    equipmentCounts = { ...equipmentCounts, [name]: cur - 1 };
  }
  function setItemCount(name: string, n: number) {
    equipmentCounts = { ...equipmentCounts, [name]: Math.max(0, n) };
  }

  function resetAllEquipment() {
    const next: Record<string, number> = {};
    for (const item of EQUIPMENT_ITEMS) next[item.name] = 0;
    equipmentCounts = next;
  }

  function jumpToFuel() {
    goto(`/m/${id}/fuel`, { replaceState: true });
  }

  // ── Preset operations ───────────────────────────────────────────────────
  function captureCurrent(name: string): LoadoutPreset {
    return {
      name,
      emptyMass: numericEmpty,
      crewMass: numericCrew,
      equipmentCounts: { ...equipmentCounts },
    };
  }

  function applyPreset(p: LoadoutPreset) {
    emptyWeight = p.emptyMass.toFixed(0);
    crewWeight = p.crewMass.toFixed(0);
    const next: Record<string, number> = {};
    for (const item of EQUIPMENT_ITEMS) {
      next[item.name] = p.equipmentCounts[item.name] ?? 0;
    }
    equipmentCounts = next;
    activePresetName = p.name;
    presetSheetOpen = false;
  }

  function saveCurrentAsNew() {
    const name = window.prompt('Save preset as…', '');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = presets.findIndex((p) => p.name === trimmed);
    if (existing >= 0) {
      const ok = window.confirm(
        `A preset named "${trimmed}" already exists. Replace it with the current configuration?`,
      );
      if (!ok) return;
      presets = presets.map((p, i) =>
        i === existing ? captureCurrent(trimmed) : p,
      );
    } else {
      presets = [...presets, captureCurrent(trimmed)];
    }
    activePresetName = trimmed;
    presetSheetOpen = false;
  }

  function updatePresetFromCurrent(p: LoadoutPreset) {
    const idx = presets.findIndex((e) => e.name === p.name);
    if (idx < 0) return;
    presets = presets.map((e, i) => (i === idx ? captureCurrent(p.name) : e));
    activePresetName = p.name;
    presetSheetOpen = false;
  }

  function renamePreset(p: LoadoutPreset) {
    const name = window.prompt('Rename preset', p.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === p.name) return;
    if (presets.some((e) => e.name === trimmed)) {
      window.alert(`A preset named "${trimmed}" already exists.`);
      return;
    }
    presets = presets.map((e) =>
      e.name === p.name ? { ...e, name: trimmed } : e,
    );
    if (activePresetName === p.name) activePresetName = trimmed;
  }

  function deletePreset(p: LoadoutPreset) {
    const ok = window.confirm(
      `Delete "${p.name}"? This cannot be undone. Current configuration on screen is unaffected.`,
    );
    if (!ok) return;
    presets = presets.filter((e) => e.name !== p.name);
    if (activePresetName === p.name) activePresetName = null;
  }

  function formatTime(t: Date): string {
    const two = (n: number) => n.toString().padStart(2, '0');
    return `${two(t.getHours())}:${two(t.getMinutes())}:${two(t.getSeconds())}`;
  }
</script>

<div class="page">
  <!-- ── PRESET BAR ─────────────────────────────────────────────── -->
  <section class="preset-bar">
    <span class="preset-icon" aria-hidden="true">▦</span>
    <span class="preset-label">Preset:</span>
    <span class="preset-name" style:color={presetLabelColor}>
      {presetLabel}
    </span>
    <button
      class="manage-btn"
      type="button"
      onclick={() => (presetSheetOpen = true)}
    >
      Manage
    </button>
  </section>

  <!-- ── TOTAL CARD ─────────────────────────────────────────────── -->
  <section class="total-card" style:border-color={accentColor}>
    <span class="total-label">{totalHeadlineLabel}</span>
    <span
      class="total-value"
      class:large={mtow != null}
      style:color={accentColor}
    >
      {totalHeadlineValue}
    </span>
    <div class="total-detail">
      <span>Total {totalWeight.toFixed(0)} kg</span>
      {#if mtow != null}
        <span class="mtow">/ MTOW {mtow.toFixed(0)} kg</span>
      {/if}
    </div>
  </section>

  <!-- ── AIRCRAFT MASS ──────────────────────────────────────────── -->
  <section>
    <h3 class="section-title">Aircraft mass</h3>
    <div class="mass-grid">
      <NumberField label="Empty A/C mass (kg)" bind:value={emptyWeight} />
      <NumberField
        label="Fuel (kg)"
        bind:value={fuelString}
        accent
        onJump={jumpToFuel}
      />
      <NumberField label="Crew (kg)" bind:value={crewWeight} />
      <NumberField label="Passengers (kg)" bind:value={passengerWeight} />
    </div>
    <div class="fuel-status">
      <span class="fuel-status-icon" aria-hidden="true">
        {manualOverride ? '✎' : '↻'}
      </span>
      <span
        class="fuel-status-text"
        style:color={manualOverride ? '#ffa726' : 'rgba(255,255,255,0.54)'}
      >
        {manualOverride
          ? `Manual fuel · Required ${requiredFuel.toFixed(0)} kg`
          : `Auto-tracking required (Required ${requiredFuel.toFixed(0)} kg)`}
      </span>
      {#if manualOverride}
        <button class="reset-link" type="button" onclick={resetFuelOverride}>
          Reset to required
        </button>
      {/if}
    </div>
  </section>

  <!-- ── CRUISE FF TABLE ────────────────────────────────────────── -->
  <section>
    <h3 class="section-title">Cruise fuel flows (kg/h by speed)</h3>
    <div class="ff-grid">
      {#each ffStrings as _, i (i)}
        <NumberField label={`${speedAt(i)} kt`} bind:value={ffStrings[i]} />
      {/each}
    </div>
    <p class="hint">
      &lt; 80 kt assumes 600 kg/h (hover transition). Between table points,
      FF is interpolated linearly.
    </p>
  </section>

  <!-- ── EQUIPMENT ──────────────────────────────────────────────── -->
  <section>
    <div class="equipment-header">
      <h3 class="section-title">Equipment</h3>
      <button
        class="reset-equip"
        type="button"
        onclick={resetAllEquipment}
        aria-label="Reset all equipment counts"
      >
        ↺ Reset all
      </button>
    </div>
    <div class="equipment-grid">
      {#each EQUIPMENT_ITEMS as item (item.name)}
        <WeightItemButton
          {item}
          count={equipmentCounts[item.name] ?? 0}
          onIncrement={() => incrementItem(item.name)}
          onDecrement={() => decrementItem(item.name)}
          onSetCount={(n) => setItemCount(item.name, n)}
        />
      {/each}
    </div>
  </section>

  <!-- ── SAVED FOOTER ───────────────────────────────────────────── -->
  <footer class="saved">
    <span aria-hidden="true">☁</span>
    <span>
      {lastSavedAt == null
        ? 'Changes save automatically.'
        : `Saved · ${formatTime(lastSavedAt)}`}
    </span>
  </footer>
</div>

<!-- ── PRESET MANAGER BOTTOM SHEET ──────────────────────────────── -->
<BottomSheet bind:open={presetSheetOpen} title="Loadout presets">
  {#snippet children()}
    {#if presets.length === 0}
      <p class="empty">
        No presets yet. Save your current configuration to create the first one.
      </p>
    {:else}
      <ul class="preset-list">
        {#each presets as p (p.name)}
          {@const isActive = p.name === activePresetName}
          {@const eqCount = Object.values(p.equipmentCounts).reduce(
            (a, b) => a + b,
            0,
          )}
          <li class="preset-item">
            <button
              class="preset-row"
              type="button"
              onclick={() => applyPreset(p)}
            >
              <span
                class="preset-radio"
                aria-hidden="true"
                style:color={isActive ? '#448aff' : '#9e9e9e'}>{isActive ? '◉' : '○'}</span
              >
              <span class="preset-main">
                <span class="preset-row-name" class:active={isActive}>
                  {p.name}
                </span>
                <span class="preset-sub">
                  Empty {p.emptyMass.toFixed(0)} kg · Crew
                  {p.crewMass.toFixed(0)} kg · {eqCount} item{eqCount === 1 ? '' : 's'}
                </span>
              </span>
            </button>
            <div class="preset-actions">
              <button
                type="button"
                class="preset-action"
                onclick={() => updatePresetFromCurrent(p)}
              >
                Update
              </button>
              <button
                type="button"
                class="preset-action"
                onclick={() => renamePreset(p)}
              >
                Rename
              </button>
              <button
                type="button"
                class="preset-action danger"
                onclick={() => deletePreset(p)}
              >
                Delete
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    <button class="save-new" type="button" onclick={saveCurrentAsNew}>
      <Icon name="add" size={20} />
      Save current as new preset
    </button>
  {/snippet}
</BottomSheet>

<style>
  .page {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Preset bar ─────────────────────────────────────────────────── */
  .preset-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
  }
  .preset-icon { color: rgba(255, 255, 255, 0.6); font-size: 16px; }
  .preset-label { font-size: 12px; color: rgba(255, 255, 255, 0.6); }
  .preset-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .manage-btn {
    min-height: 44px;
    padding: 6px 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
  }
  .manage-btn:active { background: rgba(255, 255, 255, 0.05); }

  /* ── Total card ─────────────────────────────────────────────────── */
  .total-card {
    padding: 16px;
    background: #424242;
    border-radius: 8px;
    border: 1.5px solid;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .total-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .total-value {
    font-size: 16px;
    font-weight: 700;
  }
  .total-value.large { font-size: 28px; }
  .total-detail {
    display: flex;
    align-items: baseline;
    gap: 12px;
    font-size: 13px;
    color: #fff;
    margin-top: 4px;
  }
  .total-detail .mtow { color: rgba(255, 255, 255, 0.6); }

  /* ── Section titles ─────────────────────────────────────────────── */
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0 0 8px 2px;
  }

  /* ── Aircraft mass + FF grids ───────────────────────────────────── */
  .mass-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .fuel-status {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: 11px;
  }
  .fuel-status-icon { font-size: 12px; }
  .fuel-status-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reset-link {
    background: transparent;
    border: none;
    color: #448aff;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 6px;
    min-height: 32px;
  }
  .reset-link:active { opacity: 0.7; }

  .ff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 12px;
  }
  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin: 8px 0 0;
  }

  /* ── Equipment ──────────────────────────────────────────────────── */
  .equipment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .equipment-header .section-title { margin: 0; }
  .reset-equip {
    background: transparent;
    border: none;
    color: #ef5350;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 10px;
    min-height: 36px;
  }
  .reset-equip:active { background: rgba(239, 83, 80, 0.1); border-radius: 4px; }
  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  /* ── Saved footer ──────────────────────────────────────────────── */
  .saved {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 4px;
  }

  /* ── Preset sheet body ─────────────────────────────────────────── */
  .empty {
    padding: 16px;
    color: rgba(255, 255, 255, 0.54);
    margin: 0;
  }
  .preset-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .preset-item {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .preset-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }
  .preset-row:active { background: rgba(255, 255, 255, 0.04); }
  .preset-radio { font-size: 20px; flex: 0 0 auto; }
  .preset-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .preset-row-name {
    font-size: 14px;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preset-row-name.active { font-weight: 700; }
  .preset-sub {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
  }
  .preset-actions {
    display: flex;
    gap: 6px;
    padding: 0 12px 12px;
  }
  .preset-action {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 4px;
    min-height: 36px;
    cursor: pointer;
  }
  .preset-action:active { background: rgba(255, 255, 255, 0.1); }
  .preset-action.danger { color: #ef5350; }
  .save-new {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    color: #448aff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    min-height: 56px;
  }
  .save-new:active { background: rgba(68, 138, 255, 0.08); }
</style>
