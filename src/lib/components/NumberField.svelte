<!--
  Labeled outline number field. Uses native <fieldset>/<legend> so the label
  sits cleanly in the border notch the way Material's OutlineInputBorder does
  in the Flutter version — no absolute positioning gymnastics.

  Bound value is always a string. Callers parseFloat() externally because the
  field has to tolerate intermediate states like "" or "12." while the user
  is mid-typing. (Same approach Flutter takes with TextEditingController.text.)

  Optional onJump renders a trailing icon button (used by the Configuration
  fuel field to jump to the Fuel tab).
-->
<script lang="ts">
  import Icon from '$lib/Icon.svelte';

  let {
    label,
    value = $bindable(),
    accent = false,
    onJump,
  }: {
    label: string;
    value: string;
    /** Blue text + border instead of white/grey. Used for the fuel field. */
    accent?: boolean;
    /** Optional secondary action; renders a trailing "open" icon button. */
    onJump?: () => void;
  } = $props();
</script>

<fieldset class="field" class:accent>
  <legend>{label}</legend>
  <div class="row">
    <input
      type="text"
      inputmode="decimal"
      bind:value
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck={false}
      aria-label={label}
    />
    {#if onJump}
      <button
        class="jump"
        type="button"
        onclick={onJump}
        aria-label={`Open ${label}`}
      >
        <Icon name="open" size={16} />
      </button>
    {/if}
  </div>
</fieldset>

<style>
  .field {
    border: 1px solid #555;
    border-radius: 4px;
    padding: 0 8px;
    margin: 0;
    min-width: 0;
    background: #424242;
    transition: border-color 0.15s;
  }
  .field.accent {
    border-color: #448aff;
    background: rgba(68, 138, 255, 0.06);
  }
  .field:focus-within { border-color: #448aff; }

  legend {
    padding: 0 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.02em;
    font-family: inherit;
  }
  .field.accent legend { color: #448aff; }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 0 6px;
  }
  input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    /* font-size 16 already enforced globally via +layout.svelte */
    font-weight: 600;
    font-family: ui-monospace, 'SF Mono', 'Roboto Mono', monospace;
    padding: 4px 0;
  }
  .field.accent input { color: #448aff; }
  .jump {
    flex: 0 0 auto;
    background: transparent;
    border: none;
    color: #448aff;
    padding: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    min-height: 32px;
  }
  .jump:active { opacity: 0.7; }
</style>
