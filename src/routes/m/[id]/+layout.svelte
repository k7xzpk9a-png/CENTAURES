<!-- Mission shell: strip at top, tab bar at bottom, page content in between.
     Layout uses 100dvh + flex column so the tab bar always sits at the
     viewport bottom even when iOS Safari's URL bar collapses on scroll. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { missionStore } from '$lib/missionStore.svelte';
  import Icon from '$lib/Icon.svelte';
  import type { IconName } from '$lib/Icon.svelte';

  let { children } = $props();
  let mounted = $state(false);

  let mission = $derived(missionStore.findById(page.params.id ?? ''));

  onMount(() => {
    missionStore.ensureLoaded();
    mounted = true;
    // The redirect (mission not found) needs the store loaded first.
    // After mount, if the URL points at a missing mission, bounce home.
    if (!missionStore.findById(page.params.id ?? '')) {
      goto('/', { replaceState: true });
    } else {
      // Treat URL as authoritative: viewing a mission sets it as active.
      missionStore.setActive(page.params.id ?? '');
    }
  });

  type Tab = { path: string; label: string; icon: IconName };
  const tabs: Tab[] = [
    { path: 'configuration', label: 'Config', icon: 'settings' },
    { path: 'fuel', label: 'Fuel', icon: 'fuel' },
    { path: 'mission', label: 'Mission', icon: 'route' },
    { path: 'performance', label: 'Perf', icon: 'stats' },
  ];

  let basePath = $derived(`/m/${page.params.id}`);
  let currentTab = $derived(
    tabs.find((t) => page.url.pathname.startsWith(`${basePath}/${t.path}`))
      ?.path ?? null,
  );
</script>

<div class="shell">
  <header class="strip">
    <a class="back" href="/" data-sveltekit-replacestate aria-label="Back to missions">
      <Icon name="arrow_back" size={22} />
    </a>
    <span class="title">
      {mission?.name ?? '…'}
    </span>
  </header>

  <main class="content">
    {#if mounted && mission}
      {@render children()}
    {/if}
  </main>

  <nav class="tabs" aria-label="Mission sections">
    {#each tabs as t (t.path)}
      <a
        href={`${basePath}/${t.path}`}
        class="tab"
        class:active={currentTab === t.path}
        data-sveltekit-replacestate
        aria-current={currentTab === t.path ? 'page' : undefined}
      >
        <Icon name={t.icon} size={22} />
        <span class="label">{t.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: #303030;
    overflow: hidden;
  }

  /* Top strip: thin sticky header. Padded for iPhone notch / Dynamic Island. */
  .strip {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: #1e1e1e;
    border-bottom: 1px solid #424242;
    padding-top: env(safe-area-inset-top);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  .back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: #ffffff;
    flex: 0 0 48px;
  }
  .back:active { background: rgba(255, 255, 255, 0.08); }
  .title {
    flex: 1 1 auto;
    min-width: 0;
    padding-right: 12px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Scrollable middle. */
  .content {
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }

  /* Bottom tab bar: always visible, padded for Android nav bar / iPhone
     home indicator. */
  .tabs {
    flex: 0 0 auto;
    display: flex;
    background: #1e1e1e;
    border-top: 1px solid #424242;
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
  .tab {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px 6px;
    min-height: 56px;
    color: #8a8a8a;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    position: relative;
  }
  .tab:active { background: rgba(255, 255, 255, 0.04); }
  .tab.active { color: #448aff; }
  .tab.active::before {
    /* Active-tab indicator: a thin bar at the top of the cell. */
    content: '';
    position: absolute;
    top: 0;
    left: 12%;
    right: 12%;
    height: 2px;
    background: #448aff;
    border-radius: 0 0 2px 2px;
  }
  .label { line-height: 1; }
</style>
