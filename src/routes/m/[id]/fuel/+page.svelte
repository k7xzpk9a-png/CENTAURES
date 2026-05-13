<!--
  Fuel page — workflow step (d). Direct port of lib/pages/fuel_page.dart.

  Pilot edits the actual fuel they'll load (auto-tracks required mission fuel
  until they type a value), then sees a breakdown: legs + playtime + reserve.
  Cruise FF table lives on Configuration (global, not per-mission); playtime
  is burned at FF@80 (Vy, max endurance).

  Legs (distOut/distIn/gsOut/gsIn) come from the Mission page in the Svelte
  port (in the Flutter version they were on a separate Route page). Until the
  Mission page is built (Phase 4 — 4b), they default to 50 nm / 120 kt — same
  values main.dart used in the Flutter app's _loadAllData.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import PreciseSlider from '$lib/components/PreciseSlider.svelte';
  import {
    legCruiseFuel,
    loadFFTable,
    vyFF,
    type CruiseFFTable,
  } from '$lib/ffTable';
  import {
    getBool,
    getNum,
    missionKey,
    setBool,
    setNum,
  } from '$lib/missionPersistence';
  import {
    distFromNm,
    distLabel,
    formatFlightTime,
    parseDistanceUnit,
    type DistanceUnit,
  } from '$lib/units';

  const id = $derived(page.params.id ?? '');

  // Mount-loaded values; updated via $effect (persistence) below.
  let fuelTotal = $state(800);
  let playtime = $state(30); // minutes
  let reserve = $state(250); // kg
  let distOut = $state(50); // nm
  let distIn = $state(50); // nm
  let gsOut = $state(120); // kt
  let gsIn = $state(120); // kt
  let manualOverride = $state(false);
  let unit = $state<DistanceUnit>('nm');
  let cruiseFFTable = $state<CruiseFFTable>(loadFFTable());
  let mounted = $state(false);

  onMount(() => {
    if (!id) return;
    fuelTotal = getNum(missionKey(id, 'fuelTotal'), 800);
    playtime = getNum(missionKey(id, 'playtime'), 30);
    reserve = getNum(missionKey(id, 'reserve'), 250);
    distOut = getNum(missionKey(id, 'distOut'), 50);
    distIn = getNum(missionKey(id, 'distIn'), 50);
    gsOut = getNum(missionKey(id, 'gsOut'), 120);
    gsIn = getNum(missionKey(id, 'gsIn'), 120);
    manualOverride = getBool(missionKey(id, 'fuelManualOverride'), false);
    unit = parseDistanceUnit(
      localStorage.getItem(missionKey(id, 'distanceUnit')),
    );
    cruiseFFTable = loadFFTable();
    mounted = true;
  });

  // ── Derived figures ─────────────────────────────────────────────────────
  const fuelWayOut = $derived(
    legCruiseFuel(distOut, gsOut, cruiseFFTable),
  );
  const fuelWayIn = $derived(legCruiseFuel(distIn, gsIn, cruiseFFTable));
  const playtimeFuel = $derived((vyFF(cruiseFFTable) / 60) * playtime);
  const requiredFuel = $derived(
    fuelWayOut + fuelWayIn + playtimeFuel + reserve,
  );
  const timeWayOut = $derived(gsOut > 0 ? distOut / gsOut : 0);
  const timeWayIn = $derived(gsIn > 0 ? distIn / gsIn : 0);

  // ── Auto-track required fuel when override is off ───────────────────────
  $effect(() => {
    if (mounted && !manualOverride) {
      fuelTotal = requiredFuel;
    }
  });

  // ── Persistence ─────────────────────────────────────────────────────────
  $effect(() => {
    if (mounted) setNum(missionKey(id, 'fuelTotal'), fuelTotal);
  });
  $effect(() => {
    if (mounted) setBool(missionKey(id, 'fuelManualOverride'), manualOverride);
  });
  $effect(() => {
    if (mounted) setNum(missionKey(id, 'playtime'), playtime);
  });
  $effect(() => {
    if (mounted) setNum(missionKey(id, 'reserve'), reserve);
  });

  // ── UI handlers ─────────────────────────────────────────────────────────
  function onFuelInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v >= 0) {
      fuelTotal = v;
      manualOverride = true; // typing flips into manual mode
    }
  }

  function resetOverride() {
    manualOverride = false;
    // Effect above will snap fuelTotal back to requiredFuel.
  }

  /** Caption listing only the contributors that are actually in play. */
  const breakdownCaption = $derived.by(() => {
    const parts: string[] = [];
    if (distOut > 0) parts.push('in');
    if (playtime > 0) parts.push('playtime');
    if (distIn > 0) parts.push('out');
    parts.push('reserve');
    return parts.join(' + ');
  });

  /** "+12 kg over required" / "-25 kg below required" / null when ~equal. */
  const excessText = $derived.by(() => {
    const diff = fuelTotal - requiredFuel;
    if (Math.abs(diff) < 0.5) return null;
    return diff > 0
      ? `+${diff.toFixed(0)} kg over required`
      : `${diff.toFixed(0)} kg below required`;
  });
</script>

<div class="page">
  <!-- ── FUEL HEADLINE ────────────────────────────────────────────── -->
  <section
    class="headline"
    class:manual={manualOverride}
    class:auto={!manualOverride}
  >
    <div class="headline-top">
      <span class="headline-label">FUEL</span>
      <span class="badge" aria-live="polite">
        <span class="badge-icon" aria-hidden="true">
          {manualOverride ? '✎' : '↻'}
        </span>
        {manualOverride ? 'Manual' : 'Auto-tracking required'}
      </span>
    </div>

    <div class="fuel-input-row">
      <input
        type="number"
        inputmode="decimal"
        min="0"
        step="1"
        value={fuelTotal.toFixed(0)}
        oninput={onFuelInput}
        class="fuel-input"
        aria-label="Fuel total"
      />
      <span class="fuel-unit">kg</span>
      {#if manualOverride}
        <button class="reset-btn" onclick={resetOverride}>Reset</button>
      {/if}
    </div>

    <div class="headline-meta">
      Required {requiredFuel.toFixed(0)} kg
      {#if excessText}
        · {excessText}
      {/if}
    </div>
    <div class="headline-caption">{breakdownCaption}</div>
  </section>

  <!-- ── ROUTE LEGS ───────────────────────────────────────────────── -->
  <section class="legs">
    <div class="leg leg-in">
      <span class="leg-label">IN</span>
      <span class="leg-line">
        {distFromNm(unit, distOut).toFixed(0)} {distLabel(unit)}
      </span>
      <span class="leg-line">{formatFlightTime(timeWayOut)}</span>
      <span class="leg-line">{fuelWayOut.toFixed(0)} kg</span>
    </div>
    <div class="leg leg-out">
      <span class="leg-label">OUT</span>
      <span class="leg-line">
        {distFromNm(unit, distIn).toFixed(0)} {distLabel(unit)}
      </span>
      <span class="leg-line">{formatFlightTime(timeWayIn)}</span>
      <span class="leg-line">{fuelWayIn.toFixed(0)} kg</span>
    </div>
  </section>
  <p class="hint">
    Legs come from Mission page. Cruise FF table comes from Configuration.
  </p>

  <!-- ── PLAYTIME + RESERVE ──────────────────────────────────────── -->
  <section class="sliders">
    <PreciseSlider
      label="Playtime"
      bind:value={playtime}
      min={0}
      max={240}
      step={5}
      unit="min"
    />
    <PreciseSlider
      label="Reserve"
      bind:value={reserve}
      min={0}
      max={1000}
      step={10}
      unit="kg"
    />
  </section>

  <!-- ── BREAKDOWN ───────────────────────────────────────────────── -->
  <section class="breakdown">
    <div class="row">
      <span class="row-label">
        Playtime ({Math.round(playtime)} min @ {Math.round(vyFF(cruiseFFTable))}
        kg/h)
      </span>
      <span class="row-value">{playtimeFuel.toFixed(0)} kg</span>
    </div>
    <div class="row">
      <span class="row-label">Reserve</span>
      <span class="row-value row-reserve">{reserve.toFixed(0)} kg</span>
    </div>
    <div class="divider"></div>
    <div class="row total">
      <span class="row-label">REQUIRED FUEL</span>
      <span class="row-value row-required">{requiredFuel.toFixed(0)} kg</span>
    </div>
  </section>
</div>

<style>
  .page {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Headline card ──────────────────────────────────────────────── */
  .headline {
    padding: 16px;
    border-radius: 12px;
    border: 2px solid;
    background-color: rgba(68, 138, 255, 0.06);
  }
  .headline.auto {
    border-color: #448aff;
    background-color: rgba(68, 138, 255, 0.06);
  }
  .headline.manual {
    border-color: #ffa726;
    background-color: rgba(255, 167, 38, 0.06);
  }
  .headline-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .headline-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.04em;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
  }
  .headline.auto .badge { color: #448aff; }
  .headline.manual .badge { color: #ffa726; }
  .badge-icon { font-size: 12px; }

  .fuel-input-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 8px 0 6px;
  }
  .fuel-input {
    width: 140px;
    flex: 0 0 auto;
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    text-align: right;
    /* 28px is way over the iOS 16-min so no zoom; bold for headline weight. */
    font-size: 32px;
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    padding: 0;
    /* Hide native number spinners — they look bad on dark themes. */
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .fuel-input::-webkit-outer-spin-button,
  .fuel-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .headline.auto .fuel-input { color: #448aff; }
  .headline.manual .fuel-input { color: #ffa726; }
  .fuel-unit {
    font-size: 18px;
    color: inherit;
    opacity: 0.85;
  }
  .headline.auto .fuel-unit { color: #448aff; }
  .headline.manual .fuel-unit { color: #ffa726; }
  .reset-btn {
    margin-left: auto;
    min-height: 44px;
    padding: 8px 14px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .reset-btn:active { background: rgba(255, 255, 255, 0.06); }

  .headline-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }
  .headline-caption {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.38);
    margin-top: 2px;
  }

  /* ── Legs ───────────────────────────────────────────────────────── */
  .legs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .leg {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .leg-in { border-color: rgba(105, 240, 174, 0.4); }
  .leg-out { border-color: rgba(64, 196, 255, 0.4); }
  .leg-label {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .leg-in .leg-label { color: #69f0ae; }
  .leg-out .leg-label { color: #40c4ff; }
  .leg-line {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }
  .hint {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.38);
    margin: -8px 0 0;
  }

  /* ── Sliders ────────────────────────────────────────────────────── */
  .sliders {
    background: #1e1e1e;
    border-radius: 8px;
    padding: 8px 12px;
  }

  /* ── Breakdown ──────────────────────────────────────────────────── */
  .breakdown {
    background: #1e1e1e;
    border-radius: 8px;
    padding: 8px 16px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
  }
  .row-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-value {
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    font-size: 14px;
  }
  .row-reserve { color: #ffa726; }
  .row-required { color: #448aff; font-size: 16px; }
  .row.total { padding-top: 12px; }
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 -16px;
  }
</style>
