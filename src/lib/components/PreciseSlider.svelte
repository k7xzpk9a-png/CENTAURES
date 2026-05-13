<!--
  Slider input with -/+ buttons, range bar, and an inline-editable value
  chip. Port of buildPreciseSlider in lib/utils/ui_utils.dart.

  Tapping the value chip focuses a real <input>, so the OS numeric keyboard
  pops up and the user types directly into the chip — same UX as the fuel
  headline on the Fuel page, no prompt() dialog.

  Mobile: 36×44 touch targets on -/+, 44pt chip, 32-tall range bar. Chip
  font-size is 16 so iOS doesn't auto-zoom on focus.
-->
<script lang="ts">
  let {
    label,
    value = $bindable(),
    min,
    max,
    step,
    unit,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
  } = $props();

  function clamp(v: number): number {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function snap(v: number): number {
    return Math.round(v / step) * step;
  }

  function dec() {
    value = clamp(value - step);
  }
  function inc() {
    value = clamp(value + step);
  }

  function onSlide(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) value = clamp(snap(v));
  }

  function onValueInput(e: Event) {
    // Manual entry: clamp but don't snap — the pilot may want a non-step
    // value (e.g. 47 min playtime with step=5). Matches the Flutter manual
    // dialog behavior (clamp only).
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '') return;
    const v = parseFloat(raw);
    if (Number.isFinite(v)) value = clamp(v);
  }
</script>

<div class="row">
  <span class="label">{label}</span>

  <button class="step" aria-label={`Decrease ${label}`} onclick={dec}>−</button>

  <input
    class="slider"
    type="range"
    {min}
    {max}
    {step}
    value={clamp(value)}
    oninput={onSlide}
    aria-label={label}
  />

  <button class="step" aria-label={`Increase ${label}`} onclick={inc}>+</button>

  <div class="value-wrap">
    <input
      class="value-input"
      type="number"
      inputmode="decimal"
      {min}
      {max}
      value={Math.round(value)}
      oninput={onValueInput}
      aria-label={`${label} value`}
    />
    <span class="value-unit">{unit}</span>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 90px 36px 1fr 36px 80px;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
  }
  .label {
    font-size: 13px;
    color: #b0b0b0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .step {
    width: 36px;
    height: 44px;
    background: transparent;
    border: 1px solid #424242;
    border-radius: 6px;
    color: #fff;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }
  .step:active { background: rgba(255, 255, 255, 0.06); }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 32px; /* large hit area; only the bar inside is visible */
    background: transparent;
    margin: 0;
  }
  .slider::-webkit-slider-runnable-track {
    height: 3px;
    background: #424242;
    border-radius: 2px;
  }
  .slider::-moz-range-track {
    height: 3px;
    background: #424242;
    border-radius: 2px;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #448aff;
    margin-top: -8px;
    cursor: pointer;
  }
  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #448aff;
    border: none;
    cursor: pointer;
  }

  .value-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    padding: 4px 6px;
    background: rgba(68, 138, 255, 0.15);
    border: 1px solid rgba(68, 138, 255, 0.3);
    border-radius: 6px;
    transition: border-color 0.15s, background 0.15s;
  }
  .value-wrap:focus-within {
    border-color: #448aff;
    background: rgba(68, 138, 255, 0.22);
  }
  .value-input {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    color: #448aff;
    font-size: 16px; /* keep ≥16 so iOS doesn't zoom in on focus */
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    text-align: right;
    /* Hide native number spinners. */
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .value-input::-webkit-outer-spin-button,
  .value-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .value-unit {
    color: #448aff;
    font-size: 12px;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    flex: 0 0 auto;
  }
</style>
