<!--
  Modal bottom sheet. Backdrop tap closes; an "X" close button is provided
  in the header slot via the title prop. Internal scroll, max-height 80vh.
  No animation library — CSS transitions handle slide-up + fade.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/Icon.svelte';

  let {
    open = $bindable(),
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: Snippet;
  } = $props();

  function close() {
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="backdrop"
    onclick={close}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') close();
    }}
    role="button"
    tabindex="-1"
    aria-label="Close"
  ></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header class="header">
      <span class="title">{title}</span>
      <button
        type="button"
        class="close"
        onclick={close}
        aria-label="Close"
      >
        <Icon name="add" size={20} class="rotate-45" />
      </button>
    </header>
    <div class="body">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    animation: fade 0.18s ease;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 101;
    max-height: 80vh;
    max-height: 80dvh;
    background: #1e1e1e;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);
    animation: slide-up 0.22s ease-out;
  }
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 8px 8px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .title {
    font-size: 16px;
    font-weight: 700;
  }
  .close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  /* The "X" icon: we re-use the "add" plus and rotate 45° rather than ship
     a separate close-cross icon. */
  :global(.close svg.rotate-45) { transform: rotate(45deg); }
  .close:active { background: rgba(255, 255, 255, 0.06); border-radius: 50%; }
  .body {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
</style>
