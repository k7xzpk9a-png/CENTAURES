<!--
  Phase 5a sanity check. Temporarily replaces the Performance placeholder.
  Boots the AssetResolver, constructs PerfCalculator + PerfSnapshotEngine,
  runs a known input set, and displays every cell so we can compare against
  the Flutter app side by side.

  Replaced by the real Performance page in Phase 5c.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { AssetResolver } from '$lib/perf/assetResolver';
  import { PerfCalculator } from '$lib/perf/perfCalculator';
  import { defaultPerfConfig } from '$lib/perf/perfConfig';
  import {
    perfLabel,
    type PerfResult,
  } from '$lib/perf/perfResult';
  import {
    PerfSnapshotEngine,
    paFromInputs,
    type PerfSnapshot,
  } from '$lib/perf/perfSnapshot';

  let snap = $state<PerfSnapshot | null>(null);
  let err = $state<string | null>(null);
  let elapsed = $state<number | null>(null);
  let registeredCount = $state<number | null>(null);

  onMount(async () => {
    try {
      const t0 = performance.now();
      const resolver = await AssetResolver.create();
      registeredCount = Array.from(resolver.registeredFiles()).length;
      const calc = new PerfCalculator({ resolver });
      const engine = new PerfSnapshotEngine(calc);
      snap = await engine.compute({
        qnh: 1013,
        oat: 15,
        indicatedAltitude: 250,
        wind: 0,
        gw: 9000,
        config: defaultPerfConfig(),
      });
      elapsed = performance.now() - t0;
    } catch (e) {
      err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
  });

  const inputs = {
    qnh: 1013,
    oat: 15,
    indicatedAltitude: 250,
    wind: 0,
    gw: 9000,
  };

  function pa(): number {
    return paFromInputs({
      ...inputs,
      config: defaultPerfConfig(),
    });
  }

  function lbl(r: PerfResult): string {
    return perfLabel(r);
  }
</script>

<div class="page">
  <h2>Phase 5a — engine sanity check</h2>

  <section class="card">
    <div class="row">
      <span class="k">Inputs</span>
      <span class="v">
        QNH={inputs.qnh}, OAT={inputs.oat}°C, IA={inputs.indicatedAltitude} ft,
        wind={inputs.wind} kt, GW={inputs.gw} kg
      </span>
    </div>
    <div class="row">
      <span class="k">PA (derived)</span>
      <span class="v mono">{pa().toFixed(0)} ft</span>
    </div>
    <div class="row">
      <span class="k">DATA manifest</span>
      <span class="v mono">{registeredCount ?? '…'} entries</span>
    </div>
    <div class="row">
      <span class="k">Compute time</span>
      <span class="v mono">
        {elapsed == null ? '…' : `${elapsed.toFixed(0)} ms`}
      </span>
    </div>
  </section>

  {#if err}
    <section class="card err">
      <strong>Error:</strong>
      <pre>{err}</pre>
    </section>
  {:else if snap == null}
    <p class="muted">Loading…</p>
  {:else}
    <section class="card">
      <h3>Mass envelope</h3>
      <div class="grid">
        <div><span class="k">Drag index</span><span class="v mono">{snap.dragIndex.toFixed(1)}</span></div>
        <div><span class="k">Weight index</span><span class="v mono">{lbl(snap.weightIndex)}</span></div>
        <div><span class="k">ROC de-rating</span><span class="v mono">{lbl(snap.rocDeRating)}</span></div>
        <div><span class="k">MTOW</span><span class="v mono">{lbl(snap.mtow)}</span></div>
        <div><span class="k">T/O-Landing weight</span><span class="v mono">{lbl(snap.takeoffLandingWeight)}</span></div>
      </div>
    </section>

    <section class="card">
      <h3>Hover</h3>
      <div class="grid">
        <div><span class="k">IGE AEO max weight</span><span class="v mono">{lbl(snap.hoverIgeAeo.maxWeight)}</span></div>
        <div><span class="k">IGE AEO max alt</span><span class="v mono">{lbl(snap.hoverIgeAeo.maxAltitudeIsa)}</span></div>
        <div><span class="k">IGE OEI max weight</span><span class="v mono">{lbl(snap.hoverIgeOei.maxWeight)}</span></div>
        <div><span class="k">IGE OEI max alt</span><span class="v mono">{lbl(snap.hoverIgeOei.maxAltitudeIsa)}</span></div>
        <div><span class="k">OGE AEO max weight</span><span class="v mono">{lbl(snap.hoverOgeAeo.maxWeight)}</span></div>
        <div><span class="k">OGE AEO max alt</span><span class="v mono">{lbl(snap.hoverOgeAeo.maxAltitudeIsa)}</span></div>
        <div><span class="k">OGE OEI max weight</span><span class="v mono">{lbl(snap.hoverOgeOei.maxWeight)}</span></div>
        <div><span class="k">OGE OEI max alt</span><span class="v mono">{lbl(snap.hoverOgeOei.maxAltitudeIsa)}</span></div>
      </div>
    </section>

    <section class="card">
      <h3>Rate of climb (ft/min)</h3>
      <div class="grid">
        <div><span class="k">AEO MTOP Vy</span><span class="v mono">{lbl(snap.rocAeoMtopVy.roc)}</span></div>
        <div><span class="k">AEO MTOP 45kt</span><span class="v mono">{lbl(snap.rocAeoMtop45.roc)}</span></div>
        <div><span class="k">AEO MCP 80kt</span><span class="v mono">{lbl(snap.rocAeoMcp80.roc)}</span></div>
        <div><span class="k">OEI Low 80kt</span><span class="v mono">{lbl(snap.rocOeiLow80.roc)}</span></div>
        <div><span class="k">OEI Low 45kt</span><span class="v mono">{lbl(snap.rocOeiLow45.roc)}</span></div>
        <div><span class="k">OEI MCP 80kt</span><span class="v mono">{lbl(snap.rocOeiMcp80.roc)}</span></div>
        <div><span class="k">Training Low 80kt</span><span class="v mono">{lbl(snap.rocTrainingOeiLow80.roc)}</span></div>
        <div><span class="k">Training Low 45kt</span><span class="v mono">{lbl(snap.rocTrainingOeiLow45.roc)}</span></div>
        <div><span class="k">Training MCP 80kt</span><span class="v mono">{lbl(snap.rocTrainingOeiMcp80.roc)}</span></div>
      </div>
    </section>

    <section class="card">
      <h3>Higher-order</h3>
      <div class="grid">
        <div><span class="k">Critical OEI FL</span><span class="v mono">{lbl(snap.criticalOeiFl)}</span></div>
        <div><span class="k">Height loss</span><span class="v mono">{lbl(snap.heightLoss)}</span></div>
        <div><span class="k">Height loss training</span><span class="v mono">{lbl(snap.heightLossTraining)}</span></div>
        <div><span class="k">Decision matrix</span><span class="v mono">{snap.decisionMatrix.category}</span></div>
      </div>
    </section>
  {/if}
</div>

<style>
  .page {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    color: #448aff;
  }
  h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .muted {
    color: #888;
    text-align: center;
    padding: 24px;
  }
  .card {
    background: #1e1e1e;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .card.err {
    background: rgba(239, 83, 80, 0.12);
    border: 1px solid rgba(239, 83, 80, 0.5);
  }
  pre {
    margin: 8px 0 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 4px 0;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px 14px;
  }
  @media (min-width: 480px) {
    .grid { grid-template-columns: 1fr 1fr; }
  }
  .grid > div {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 4px 0;
    font-size: 13px;
  }
  .k {
    color: rgba(255, 255, 255, 0.6);
  }
  .v {
    color: #fff;
    text-align: right;
  }
  .mono {
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
  }
</style>
