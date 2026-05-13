<!--
  Equipment cell in the Configuration page grid. Mirrors WeightItemButton
  from lib/utils/ui_utils.dart: name + weight on top, ± with current count
  in the middle. Inactive (count = 0) is dimmed blue-grey; active is blue.

  Tap on the count chip prompts for a manual count (window.prompt) — quick
  to type "8" rather than tapping + eight times.
-->
<script lang="ts">
  export interface EquipmentItem {
    name: string;
    weightKg: number;
  }

  let {
    item,
    count,
    onIncrement,
    onDecrement,
    onSetCount,
  }: {
    item: EquipmentItem;
    count: number;
    onIncrement: () => void;
    onDecrement: () => void;
    onSetCount: (n: number) => void;
  } = $props();

  function promptForCount() {
    const raw = window.prompt(`${item.name} count`, String(count));
    if (raw === null) return;
    const v = parseInt(raw.trim(), 10);
    if (Number.isFinite(v) && v >= 0) onSetCount(v);
  }

  const active = $derived(count > 0);
</script>

<div class="cell" class:active>
  <span class="name">{item.name}</span>
  <span class="weight">{item.weightKg} kg</span>
  <div class="controls">
    <button
      class="step"
      type="button"
      onclick={onDecrement}
      disabled={count === 0}
      aria-label={`Decrease ${item.name}`}
    >−</button>
    <button class="count" type="button" onclick={promptForCount}>
      × {count}
    </button>
    <button
      class="step"
      type="button"
      onclick={onIncrement}
      aria-label={`Increase ${item.name}`}
    >+</button>
  </div>
</div>

<style>
  .cell {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
    padding: 6px 4px;
    border-radius: 4px;
    background: #37474f; /* Material blueGrey 800 */
    border: 1px solid transparent;
    color: #fff;
    min-height: 96px;
    text-align: center;
  }
  .cell.active {
    background: #1565c0; /* Material blue 700 */
    border-color: #448aff;
  }
  .name {
    font-size: 10px;
    font-weight: 700;
    line-height: 1.1;
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
  }
  .weight {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
  }
  .controls {
    display: grid;
    grid-template-columns: 28px 1fr 28px;
    gap: 2px;
    align-items: center;
    margin-top: 2px;
  }
  .step {
    background: rgba(0, 0, 0, 0.25);
    border: none;
    border-radius: 4px;
    color: #fff;
    width: 28px;
    height: 28px;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }
  .step:active { background: rgba(0, 0, 0, 0.4); }
  .step:disabled {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(255, 255, 255, 0.25);
    cursor: default;
  }
  .count {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    padding: 4px;
    cursor: pointer;
    min-height: 28px;
  }
  .count:active { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
</style>
