<script lang="ts">
  import { onMount } from 'svelte';
  import { isUnlocked } from '$lib/passwordGate';
  import PasswordScreen from '$lib/PasswordScreen.svelte';

  let { children } = $props();
  let unlocked = $state(false);
  let ready = $state(false);

  onMount(() => {
    unlocked = isUnlocked();
    ready = true;
  });
</script>

{#if !ready}
  <div class="splash"></div>
{:else if !unlocked}
  <PasswordScreen onUnlocked={() => (unlocked = true)} />
{:else}
  {@render children()}
{/if}

<style>
  /* Global mobile-PWA defaults. Applied everywhere so individual components
     don't have to repeat them. */
  :global(html) {
    /* viewport-fit:cover is set in app.html via the manifest; pair it with
       safe-area-inset-* on chrome containers (strip, tabs). */
    height: 100%;
    background: #303030;
  }
  :global(body) {
    margin: 0;
    padding: 0;
    min-height: 100%;
    min-height: 100dvh;
    background: #303030;
    color: #ffffff;
    font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    /* No accidental selection on chrome (nav, headers). Text inputs and
       content areas opt back in below. */
    -webkit-user-select: none;
    user-select: none;
    /* Suppress iOS / Android pull-to-refresh and overscroll bounce so the
       PWA feels app-like instead of webpage-like in standalone mode. */
    overscroll-behavior: contain;
  }
  :global(input, textarea) {
    /* Re-enable selection on form fields. */
    -webkit-user-select: auto;
    user-select: auto;
    /* iOS auto-zooms on focus if the input font-size is <16px. Force it. */
    font-size: 16px;
  }
  :global(button) {
    /* Remove the iOS double-tap blue flash; we add explicit :active styles. */
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    font-family: inherit;
  }
  :global(a) {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    color: inherit;
    text-decoration: none;
  }
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  .splash {
    min-height: 100dvh;
    background: #303030;
  }
</style>
